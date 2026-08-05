import type { AgentNode, CitationRecord, InstructionStep } from '../../client/types';
import type { LLMProvider } from '../llm/LLMProvider';
import type { PlanInput, PlannerService } from '../services/PlannerService';
import type { ExecutionService } from '../services/ExecutionService';
import type { ReflectionResult, ReflectionService } from '../services/ReflectionService';
import type { SessionService } from '../services/SessionService';
import { renderMarkdownReportToPdf } from '../services/PdfReportRenderer';
import { renderMarkdownReportToDocx } from '../services/DocxReportRenderer';
import { renderMarkdownReportToPptxOutline } from '../services/PresentationOutlineRenderer';
import { getPipelineStageAgents } from './PipelineStageRoster';
import { ProgressEmitter } from './ProgressEmitter';
import { runCritiqueRound, runReviewRound, type StepOutcome } from './ReflectionLoopRunner';
import { StepRunner } from './StepRunner';

export interface PipelineCallbacks {
  readonly onEvent: (event: string, data: unknown) => void;
  readonly signal?: AbortSignal;
  /** Per-run override for ReflectionConfig.enabled (e.g. from a saved user preference) - undefined
   *  falls back to the server's configured default. Only honored by run(), not resume(): a resumed
   *  session continues with whatever the pipeline was actually built with, not a value re-supplied
   *  on a later reconnect. */
  readonly reflectionOverride?: boolean;
}

export interface ReflectionConfig {
  readonly enabled: boolean;
  readonly maxIterations: number;
  readonly confidenceThreshold: number;
}

interface RunState {
  steps: InstructionStep[];
  agentOutputs: Record<string, string>;
  citations: CitationRecord[];
  reflections: ReflectionResult[];
  /** ONE cumulative budget shared across both the pre-synthesis Critic loop and the post-synthesis
   *  Reviewer loop (not maxIterations each) - if the Critic loop consumes the whole budget, the
   *  Reviewer still runs a first pass (it always gets to review the report once via
   *  synthesizeAndFinish's initial streamSynthesis call), it just can't request further iteration.
   *  Persisted so a resume() can't reset it and loop forever across a dropped connection. */
  reflectionIterationCount: number;
}

interface SynthesizeAndFinishInput {
  readonly sessionId: string;
  readonly title: string;
  readonly userPrompt: string;
  readonly agents: Record<string, AgentNode>;
  readonly selectedDocIds?: readonly string[];
  readonly availableAgentIds: readonly string[];
  readonly onEvent: (event: string, data: unknown) => void;
  readonly progress: ProgressEmitter;
  readonly signal?: AbortSignal;
  readonly state: RunState;
  readonly reflectionEnabled: boolean;
}

/** Every agent id except the always-on orchestrator and the two pipeline-stage judges - the only
 *  ids a follow-up research step (from a Critic/Reviewer suggestion) can actually be assigned to. */
function getAvailableAgentIdsForSteps(agents: Record<string, AgentNode>): string[] {
  return Object.keys(agents).filter(id => id !== 'lead' && id !== 'critic' && id !== 'reviewer');
}

function buildCitationSummary(citations: readonly CitationRecord[]): string {
  if (citations.length === 0) return 'No citation graph recorded for this run.';
  return citations.map(c => `- [${c.toolName || 'source'}] ${c.claim}${c.sourceUrl ? ` (${c.sourceUrl})` : ''}`).join('\n');
}

// Drives a full 'auto' research run end-to-end over SSE: plan -> per-step tool-select/execute/analyze
// -> Critic pass -> streamed synthesis -> Reviewer pass (both bounded by reflectionConfig.maxIterations,
// which persists as SessionHistory.reflectionIterationCount so a resume() can't reset the budget).
// Persists to SessionService after every phase transition so a dropped connection can always be
// recovered via resume().
export class ResearchPipeline {
  constructor(
    private readonly plannerService: PlannerService,
    private readonly executionService: ExecutionService,
    private readonly sessionService: SessionService,
    private readonly llmProvider: LLMProvider,
    private readonly reflectionService: ReflectionService,
    private readonly reflectionConfig: ReflectionConfig
  ) {}

  async run(input: PlanInput, { onEvent, signal, reflectionOverride }: PipelineCallbacks): Promise<void> {
    const progress = new ProgressEmitter(event => onEvent('progress', event));
    const stepRunner = new StepRunner(this.executionService, progress);
    const reflectionEnabled = reflectionOverride ?? this.reflectionConfig.enabled;

    progress.emit('planning', 'Decomposing research query into an instruction set...');

    const planResult = await this.plannerService.plan(input, event => progress.emit('standby', event.message));
    if (!planResult.ok) {
      onEvent('error', { code: planResult.error.code, message: planResult.error.message });
      return;
    }
    const plan = planResult.value;
    const agents: Record<string, AgentNode> = { ...plan.agents, ...getPipelineStageAgents() };

    const metadata = this.sessionService.create({
      title: plan.title,
      userPrompt: plan.userPrompt,
      selectedDocIds: plan.selectedDocIds,
      executionMode: plan.executionMode
    });
    this.sessionService.save(metadata.id, {
      instructionSet: plan.instructionSet,
      agents,
      logs: plan.logs,
      agentOutputs: {},
      currentStepIndex: 0
    });

    onEvent('session', { id: metadata.id, ...plan, agents });

    const state: RunState = { steps: plan.instructionSet, agentOutputs: {}, citations: [], reflections: [], reflectionIterationCount: 0 };
    const availableAgentIds = getAvailableAgentIdsForSteps(agents);

    const stepsResult = await stepRunner.run({
      steps: state.steps,
      startIndex: 0,
      selectedDocIds: input.docIds,
      signal,
      onStepComplete: (i, value) => {
        state.agentOutputs[state.steps[i].id] = value.agentOutput;
        state.citations.push(...value.citations);
        this.sessionService.save(metadata.id, { agentOutputs: state.agentOutputs, citations: state.citations, currentStepIndex: i + 1, status: 'executing' });
        onEvent('step_result', { stepIndex: i, ...value });
      }
    });

    if (!this.handleStepsResult(metadata.id, state.steps, stepsResult, progress, onEvent)) return;

    if (reflectionEnabled) {
      progress.emit('critiquing', 'Auditing findings before synthesis...');
      const cancelledOrFailed = await this.runCritiqueLoop({
        sessionId: metadata.id,
        userPrompt: plan.userPrompt,
        selectedDocIds: input.docIds,
        availableAgentIds,
        agents,
        onEvent,
        progress,
        signal,
        state
      });
      if (cancelledOrFailed) return;
    }

    await this.synthesizeAndFinish({
      sessionId: metadata.id,
      title: plan.title,
      userPrompt: plan.userPrompt,
      agents,
      selectedDocIds: input.docIds,
      availableAgentIds,
      onEvent,
      progress,
      signal,
      state,
      reflectionEnabled
    });
  }

  // Continues an existing session from its persisted currentStepIndex - used when a client resumes
  // a run that was previously paused (client-initiated cancel) or dropped (connection loss). Skips
  // planning entirely since the instructionSet/agents are already persisted (and may have been
  // edited via PATCH /api/sessions/:id/instruction-set while paused). Does not attempt to resume
  // mid-critique/synthesis/review - a pause during those phases resumes by redoing them from the
  // (already-persisted) completed step set, carrying forward the existing reflectionIterationCount
  // budget rather than resetting it.
  async resume(sessionId: string, { onEvent, signal }: PipelineCallbacks): Promise<void> {
    const progress = new ProgressEmitter(event => onEvent('progress', event));
    const stepRunner = new StepRunner(this.executionService, progress);

    const loaded = this.sessionService.load(sessionId);
    if (!loaded.ok) {
      onEvent('error', { code: loaded.error.code, message: loaded.error.message });
      return;
    }
    const { metadata, history } = loaded.value;
    const agents: Record<string, AgentNode> = { ...history.agents, ...getPipelineStageAgents() };

    if (metadata.status === 'completed') {
      const report = history.finalReportArtifact ? this.sessionService.readArtifact(sessionId, history.finalReportArtifact) : undefined;
      onEvent('session', {
        id: metadata.id,
        title: metadata.title,
        userPrompt: metadata.userPrompt,
        selectedDocIds: metadata.selectedDocIds,
        executionMode: metadata.executionMode,
        currentStepIndex: history.currentStepIndex,
        instructionSet: history.instructionSet,
        status: metadata.status,
        logs: history.logs,
        agents,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        agentOutputs: history.agentOutputs,
        citations: history.citations
      });
      if (report) onEvent('report', { report });
      progress.emit('finished', 'Session already completed.');
      return;
    }

    this.sessionService.save(sessionId, { status: 'executing' });

    onEvent('session', {
      id: metadata.id,
      title: metadata.title,
      userPrompt: metadata.userPrompt,
      selectedDocIds: metadata.selectedDocIds,
      executionMode: metadata.executionMode,
      currentStepIndex: history.currentStepIndex,
      instructionSet: history.instructionSet,
      status: 'executing',
      logs: history.logs,
      agents,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      agentOutputs: history.agentOutputs,
      citations: history.citations
    });

    const state: RunState = {
      steps: [...history.instructionSet],
      agentOutputs: { ...history.agentOutputs },
      citations: [...history.citations],
      reflections: [...history.reflections],
      reflectionIterationCount: history.reflectionIterationCount
    };
    const availableAgentIds = getAvailableAgentIdsForSteps(agents);

    const stepsResult = await stepRunner.run({
      steps: state.steps,
      startIndex: history.currentStepIndex,
      selectedDocIds: metadata.selectedDocIds,
      signal,
      onStepComplete: (i, value) => {
        state.agentOutputs[state.steps[i].id] = value.agentOutput;
        state.citations.push(...value.citations);
        this.sessionService.save(sessionId, { agentOutputs: state.agentOutputs, citations: state.citations, currentStepIndex: i + 1, status: 'executing' });
        onEvent('step_result', { stepIndex: i, ...value });
      }
    });

    if (!this.handleStepsResult(sessionId, state.steps, stepsResult, progress, onEvent)) return;

    if (this.reflectionConfig.enabled) {
      progress.emit('critiquing', 'Auditing findings before synthesis...');
      const cancelledOrFailed = await this.runCritiqueLoop({
        sessionId,
        userPrompt: metadata.userPrompt,
        selectedDocIds: metadata.selectedDocIds,
        availableAgentIds,
        agents,
        onEvent,
        progress,
        signal,
        state
      });
      if (cancelledOrFailed) return;
    }

    await this.synthesizeAndFinish({
      sessionId,
      title: metadata.title,
      userPrompt: metadata.userPrompt,
      agents,
      selectedDocIds: metadata.selectedDocIds,
      availableAgentIds,
      onEvent,
      progress,
      signal,
      state,
      reflectionEnabled: this.reflectionConfig.enabled
    });
  }

  /** Returns false (and has already persisted/emitted the terminal state) if the step loop was
   *  cancelled or failed - callers should return immediately in that case. */
  private handleStepsResult(
    sessionId: string,
    steps: readonly InstructionStep[],
    stepsResult: Awaited<ReturnType<StepRunner['run']>>,
    progress: ProgressEmitter,
    onEvent: (event: string, data: unknown) => void
  ): boolean {
    if (stepsResult.ok) return true;

    if (stepsResult.cancelled) {
      this.sessionService.save(sessionId, { status: 'paused', currentStepIndex: stepsResult.stepIndex });
      progress.emit('error', 'Research run cancelled by client.');
    } else {
      this.sessionService.save(sessionId, { status: 'error' });
      progress.emit('error', stepsResult.message, { stepIndex: stepsResult.stepIndex, stepTitle: steps[stepsResult.stepIndex]?.title });
      onEvent('error', { code: stepsResult.code, message: stepsResult.message });
    }
    return false;
  }

  private emitNewStepOutcomes(onEvent: (event: string, data: unknown) => void, outcomes: readonly StepOutcome[]): void {
    for (const outcome of outcomes) {
      onEvent('step_result', { stepIndex: outcome.stepIndex, ...outcome.result });
    }
  }

  /** Bounded Critic loop, run once before synthesis. Returns true if the caller should stop
   *  (cancelled or failed - already persisted/emitted); false to proceed to synthesis. */
  private async runCritiqueLoop(params: {
    sessionId: string;
    userPrompt: string;
    selectedDocIds?: readonly string[];
    availableAgentIds: readonly string[];
    agents: Record<string, AgentNode>;
    onEvent: (event: string, data: unknown) => void;
    progress: ProgressEmitter;
    signal?: AbortSignal;
    state: RunState;
  }): Promise<boolean> {
    const { sessionId, userPrompt, selectedDocIds, availableAgentIds, agents, onEvent, progress, signal, state } = params;

    // The Critic always gets at least one look at the findings so far, even if a prior
    // interrupted attempt (carried over via a resume()) already used up the whole iteration
    // budget - only *requesting further research* is gated by remaining budget, checked before
    // each round (including whether to run one at all) so a round is never started once the
    // budget is spent.
    let firstRound = true;
    while (firstRound || state.reflectionIterationCount < this.reflectionConfig.maxIterations) {
      firstRound = false;
      const round = await runCritiqueRound({
        userPrompt,
        steps: state.steps,
        agentOutputs: state.agentOutputs,
        citations: state.citations,
        selectedDocIds,
        availableAgentIds,
        agentRoster: agents,
        confidenceThreshold: this.reflectionConfig.confidenceThreshold,
        reflectionService: this.reflectionService,
        executionService: this.executionService,
        progress,
        signal
      });

      state.steps = round.steps;
      state.agentOutputs = round.agentOutputs;
      state.citations = round.citations;
      state.reflections.push(round.reflection);
      this.emitNewStepOutcomes(onEvent, round.newStepOutcomes);
      onEvent('reflection', { kind: 'critique', iteration: state.reflectionIterationCount, ...round.reflection });

      // Increment (if we're about to loop again) BEFORE persisting, so the saved
      // reflectionIterationCount always reflects the budget actually consumed so far - not the
      // value from one round ago.
      const willContinue = round.needsMoreResearch && !round.cancelled && !round.failed;
      if (willContinue) state.reflectionIterationCount += 1;

      const saveResult = this.sessionService.save(sessionId, {
        instructionSet: state.steps,
        agentOutputs: state.agentOutputs,
        citations: state.citations,
        reflections: state.reflections,
        reflectionIterationCount: state.reflectionIterationCount
      });
      if (!saveResult.ok) return true;

      if (round.cancelled) {
        this.sessionService.save(sessionId, { status: 'paused', currentStepIndex: round.cancelled.stepIndex });
        progress.emit('error', 'Research run cancelled by client.');
        return true;
      }
      if (round.failed) {
        this.sessionService.save(sessionId, { status: 'error' });
        progress.emit('error', round.failed.message, { stepIndex: round.failed.stepIndex });
        onEvent('error', { code: round.failed.code, message: round.failed.message });
        return true;
      }
      if (!willContinue) break;
    }

    return false;
  }

  private async synthesizeAndFinish(input: SynthesizeAndFinishInput): Promise<void> {
    const { sessionId, title, userPrompt, agents, selectedDocIds, availableAgentIds, onEvent, progress, signal, state, reflectionEnabled } = input;

    if (signal?.aborted) {
      this.sessionService.save(sessionId, { status: 'paused' });
      progress.emit('error', 'Research run cancelled by client.');
      return;
    }

    let fullReport = await this.streamSynthesis(sessionId, userPrompt, state, selectedDocIds, onEvent, progress, signal);
    if (fullReport === null) return;

    if (reflectionEnabled) {
      progress.emit('reviewing', 'Reviewing the synthesized report for accuracy...');

      // Same "always at least one round, budget gates further ones" shape as the Critic loop -
      // and the same shared reflectionIterationCount budget (see RunState), so a Critic loop that
      // used the whole budget still leaves the Reviewer its guaranteed first pass.
      let firstRound = true;
      while (firstRound || state.reflectionIterationCount < this.reflectionConfig.maxIterations) {
        firstRound = false;
        const round = await runReviewRound({
          userPrompt,
          finalReport: fullReport,
          citationSummary: buildCitationSummary(state.citations),
          steps: state.steps,
          agentOutputs: state.agentOutputs,
          citations: state.citations,
          selectedDocIds,
          availableAgentIds,
          agentRoster: agents,
          confidenceThreshold: this.reflectionConfig.confidenceThreshold,
          reflectionService: this.reflectionService,
          executionService: this.executionService,
          progress,
          signal
        });

        state.steps = round.steps;
        state.agentOutputs = round.agentOutputs;
        state.citations = round.citations;
        state.reflections.push(round.reflection);
        this.emitNewStepOutcomes(onEvent, round.newStepOutcomes);
        onEvent('reflection', { kind: 'review', iteration: state.reflectionIterationCount, ...round.reflection });

        // Increment (if we're about to loop again) BEFORE persisting - see the identical comment
        // in runCritiqueLoop.
        const willResynthesize = round.needsResynthesis && !round.cancelled && !round.failed;
        if (willResynthesize) state.reflectionIterationCount += 1;

        this.sessionService.save(sessionId, {
          instructionSet: state.steps,
          agentOutputs: state.agentOutputs,
          citations: state.citations,
          reflections: state.reflections,
          reflectionIterationCount: state.reflectionIterationCount
        });

        if (round.cancelled) {
          this.sessionService.save(sessionId, { status: 'paused', currentStepIndex: round.cancelled.stepIndex });
          progress.emit('error', 'Research run cancelled by client.');
          return;
        }
        if (round.failed) {
          this.sessionService.save(sessionId, { status: 'error' });
          progress.emit('error', round.failed.message, { stepIndex: round.failed.stepIndex });
          onEvent('error', { code: round.failed.code, message: round.failed.message });
          return;
        }
        if (!willResynthesize) break;

        progress.emit('synthesizing', 'Re-synthesizing the report with the reviewer\'s additional findings...');
        const resynthesized = await this.streamSynthesis(sessionId, userPrompt, state, selectedDocIds, onEvent, progress, signal);
        if (resynthesized === null) return;
        fullReport = resynthesized;
      }
    }

    progress.emit('exporting_pdf', 'Rendering the polished PDF document with vector diagrams...');
    try {
      const pdf = await renderMarkdownReportToPdf({ markdown: fullReport, title, llmProvider: this.llmProvider });
      this.sessionService.writeBinaryArtifact(sessionId, 'report.pdf', pdf);
      this.sessionService.save(sessionId, { finalReportPdfArtifact: 'report.pdf' });
    } catch (err) {
      // PDF export is a best-effort local post-processing step - a failure here shouldn't discard
      // the already-synthesized report, so the run still completes with the markdown artifact.
      progress.emit('pdf_export_failed', err instanceof Error ? err.message : 'PDF export failed');
    }

    progress.emit('exporting_artifacts', 'Rendering DOCX and presentation outline exports...');
    // DOCX/PPTX are cheap, non-browser renders (unlike PDF above) so they run in parallel rather
    // than sequentially - still each independently best-effort, same reasoning as the PDF export.
    const [docxResult, pptxResult] = await Promise.allSettled([
      renderMarkdownReportToDocx({ markdown: fullReport, title }),
      renderMarkdownReportToPptxOutline({ markdown: fullReport, title })
    ]);
    if (docxResult.status === 'fulfilled') {
      this.sessionService.writeBinaryArtifact(sessionId, 'report.docx', docxResult.value);
      this.sessionService.save(sessionId, { finalReportDocxArtifact: 'report.docx' });
    } else {
      progress.emit('docx_export_failed', docxResult.reason instanceof Error ? docxResult.reason.message : 'DOCX export failed');
    }
    if (pptxResult.status === 'fulfilled') {
      this.sessionService.writeBinaryArtifact(sessionId, 'report.pptx', pptxResult.value);
      this.sessionService.save(sessionId, { finalReportPptxArtifact: 'report.pptx' });
    } else {
      progress.emit('pptx_export_failed', pptxResult.reason instanceof Error ? pptxResult.reason.message : 'Presentation outline export failed');
    }

    this.sessionService.save(sessionId, { status: 'completed' });
    onEvent('report', { report: fullReport });
    progress.emit('finished', 'Research complete.');
  }

  /** Streams one synthesis pass (initial or a reviewer-triggered re-synthesis) to completion,
   *  persisting the markdown artifact. Returns the full report text, or null if the caller should
   *  stop immediately (already persisted/emitted a paused/error terminal state). */
  private async streamSynthesis(
    sessionId: string,
    userPrompt: string,
    state: RunState,
    selectedDocIds: readonly string[] | undefined,
    onEvent: (event: string, data: unknown) => void,
    progress: ProgressEmitter,
    signal?: AbortSignal
  ): Promise<string | null> {
    progress.emit('synthesizing', 'Compiling the final synthesized report...');

    const synthesisPrompt = this.executionService.buildSynthesisPrompt({
      userPrompt,
      instructionSet: state.steps,
      agentOutputs: state.agentOutputs,
      selectedDocIds
    });

    let fullReport = '';
    try {
      for await (const chunk of this.llmProvider.stream(synthesisPrompt, { signal, onStandby: event => progress.emit('standby', event.message) })) {
        if (signal?.aborted) {
          this.sessionService.save(sessionId, { status: 'paused' });
          progress.emit('error', 'Research run cancelled during synthesis.');
          return null;
        }
        if (chunk.type === 'text' && chunk.textDelta) {
          fullReport += chunk.textDelta;
          onEvent('token', { textDelta: chunk.textDelta });
        }
      }
    } catch (err) {
      this.sessionService.save(sessionId, { status: 'error' });
      progress.emit('error', err instanceof Error ? err.message : 'Synthesis streaming failed');
      onEvent('error', { message: err instanceof Error ? err.message : 'Synthesis streaming failed' });
      return null;
    }

    this.sessionService.writeArtifact(sessionId, 'report.md', fullReport);
    this.sessionService.save(sessionId, { finalReportArtifact: 'report.md' });

    return fullReport;
  }
}
