import type { LLMProvider } from '../llm/LLMProvider';
import type { PlanInput, PlannerService } from '../services/PlannerService';
import type { ExecutionService } from '../services/ExecutionService';
import type { SessionService } from '../services/SessionService';
import { renderMarkdownReportToPdf } from '../services/PdfReportRenderer';
import { ProgressEmitter } from './ProgressEmitter';

export interface PipelineCallbacks {
  readonly onEvent: (event: string, data: unknown) => void;
  readonly signal?: AbortSignal;
}

// Drives a full 'auto' research run end-to-end over SSE: plan -> per-step tool-select/execute/analyze
// -> streamed synthesis. Persists to SessionService after every phase transition so a dropped
// connection can always be recovered via GET /api/sessions/:id.
export class ResearchPipeline {
  constructor(
    private readonly plannerService: PlannerService,
    private readonly executionService: ExecutionService,
    private readonly sessionService: SessionService,
    private readonly llmProvider: LLMProvider
  ) {}

  async run(input: PlanInput, { onEvent, signal }: PipelineCallbacks): Promise<void> {
    const progress = new ProgressEmitter(event => onEvent('progress', event));

    progress.emit('planning', 'Decomposing research query into an instruction set...');

    const planResult = await this.plannerService.plan(input);
    if (!planResult.ok) {
      onEvent('error', { code: planResult.error.code, message: planResult.error.message });
      return;
    }
    const plan = planResult.value;

    const metadata = this.sessionService.create({
      title: plan.title,
      userPrompt: plan.userPrompt,
      selectedDocIds: plan.selectedDocIds,
      executionMode: plan.executionMode
    });
    this.sessionService.save(metadata.id, {
      instructionSet: plan.instructionSet,
      agents: plan.agents,
      logs: plan.logs,
      agentOutputs: {},
      currentStepIndex: 0
    });

    onEvent('session', { id: metadata.id, ...plan });

    const agentOutputs: Record<string, string> = {};
    const steps = plan.instructionSet;

    for (let i = 0; i < steps.length; i++) {
      if (signal?.aborted) {
        this.sessionService.save(metadata.id, { status: 'paused', currentStepIndex: i });
        progress.emit('error', 'Run cancelled by client.');
        return;
      }

      const step = steps[i];
      progress.emit('running_tools', `Running step ${i + 1} of ${steps.length}: ${step.title}`, {
        stepIndex: i,
        stepTitle: step.title
      });

      const stepResult = await this.executionService.executeStep({
        step,
        selectedDocIds: input.docIds,
        userFeedback: undefined,
        onPhase: phase => {
          if (phase === 'analyzing') {
            progress.emit('analyzing', `Analyzing findings for step ${i + 1}: ${step.title}`, {
              stepIndex: i,
              stepTitle: step.title
            });
          }
        }
      });

      if (!stepResult.ok) {
        this.sessionService.save(metadata.id, { status: 'error' });
        progress.emit('error', stepResult.error.message, { stepIndex: i, stepTitle: step.title });
        onEvent('error', { code: stepResult.error.code, message: stepResult.error.message });
        return;
      }

      agentOutputs[step.id] = stepResult.value.agentOutput;
      this.sessionService.save(metadata.id, { agentOutputs, currentStepIndex: i + 1, status: 'executing' });
      onEvent('step_result', { stepIndex: i, ...stepResult.value });
    }

    if (signal?.aborted) {
      this.sessionService.save(metadata.id, { status: 'paused' });
      progress.emit('error', 'Run cancelled by client.');
      return;
    }

    progress.emit('synthesizing', 'Compiling the final synthesized report...');

    const synthesisPrompt = this.executionService.buildSynthesisPrompt({
      userPrompt: plan.userPrompt,
      instructionSet: steps,
      agentOutputs,
      selectedDocIds: input.docIds
    });

    let fullReport = '';
    try {
      for await (const chunk of this.llmProvider.stream(synthesisPrompt, { signal })) {
        if (signal?.aborted) {
          this.sessionService.save(metadata.id, { status: 'paused' });
          progress.emit('error', 'Run cancelled during synthesis.');
          return;
        }
        if (chunk.type === 'text' && chunk.textDelta) {
          fullReport += chunk.textDelta;
          onEvent('token', { textDelta: chunk.textDelta });
        }
      }
    } catch (err) {
      this.sessionService.save(metadata.id, { status: 'error' });
      progress.emit('error', err instanceof Error ? err.message : 'Synthesis streaming failed');
      onEvent('error', { message: err instanceof Error ? err.message : 'Synthesis streaming failed' });
      return;
    }

    this.sessionService.writeArtifact(metadata.id, 'report.md', fullReport);
    this.sessionService.save(metadata.id, { finalReportArtifact: 'report.md' });

    progress.emit('exporting_pdf', 'Rendering the polished PDF document with vector diagrams...');
    try {
      const pdf = await renderMarkdownReportToPdf({ markdown: fullReport, title: plan.title });
      this.sessionService.writeBinaryArtifact(metadata.id, 'report.pdf', pdf);
      this.sessionService.save(metadata.id, { finalReportPdfArtifact: 'report.pdf' });
    } catch (err) {
      // PDF export is a best-effort local post-processing step - a failure here shouldn't discard
      // the already-synthesized report, so the run still completes with the markdown artifact.
      progress.emit('pdf_export_failed', err instanceof Error ? err.message : 'PDF export failed');
    }

    this.sessionService.save(metadata.id, { status: 'completed' });
    onEvent('report', { report: fullReport });
    progress.emit('finished', 'Research complete.');
  }
}
