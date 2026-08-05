import type { AgentNode, CitationRecord, InstructionStep } from '../../client/types';
import type { ExecuteStepOutput, ExecutionService } from '../services/ExecutionService';
import type { ReflectionResult, ReflectionService, ReflectionStepSuggestion } from '../services/ReflectionService';
import { buildInstructionSteps } from './instructionStepFactory';
import type { ProgressEmitter } from './ProgressEmitter';
import { StepRunner } from './StepRunner';

export interface StepOutcome {
  readonly step: InstructionStep;
  readonly stepIndex: number;
  readonly result: ExecuteStepOutput;
}

interface RunAdditionalStepsContext {
  readonly steps: readonly InstructionStep[];
  readonly agentOutputs: Record<string, string>;
  readonly citations: readonly CitationRecord[];
  readonly selectedDocIds?: readonly string[];
  readonly availableAgentIds: readonly string[];
  readonly agentRoster: Record<string, AgentNode>;
  readonly executionService: ExecutionService;
  readonly progress: ProgressEmitter;
  readonly signal?: AbortSignal;
}

interface RunAdditionalStepsResult {
  readonly steps: InstructionStep[];
  readonly agentOutputs: Record<string, string>;
  readonly citations: CitationRecord[];
  readonly newStepOutcomes: StepOutcome[];
  readonly cancelled?: { stepIndex: number };
  readonly failed?: { stepIndex: number; message: string; code: string };
}

// Shared by both runCritiqueRound and runReviewRound: converts a reflection's suggested follow-up
// steps into real InstructionSteps appended after the existing set, then actually runs them via
// StepRunner (the same tool-select/execute/analyze machinery every other step uses).
async function runAdditionalSteps(
  suggestions: readonly ReflectionStepSuggestion[],
  ctx: RunAdditionalStepsContext
): Promise<RunAdditionalStepsResult> {
  const newSteps = buildInstructionSteps(suggestions, ctx.availableAgentIds, ctx.agentRoster, ctx.steps.length + 1);
  const combinedSteps = [...ctx.steps, ...newSteps];
  const startIndex = ctx.steps.length;

  const agentOutputs: Record<string, string> = { ...ctx.agentOutputs };
  const citations: CitationRecord[] = [...ctx.citations];
  const newStepOutcomes: StepOutcome[] = [];

  const stepRunner = new StepRunner(ctx.executionService, ctx.progress);
  const stepsResult = await stepRunner.run({
    steps: combinedSteps,
    startIndex,
    selectedDocIds: ctx.selectedDocIds,
    signal: ctx.signal,
    onStepComplete: (i, value) => {
      const step = combinedSteps[i];
      agentOutputs[step.id] = value.agentOutput;
      citations.push(...value.citations);
      newStepOutcomes.push({ step, stepIndex: i, result: value });
    }
  });

  if (!stepsResult.ok) {
    return {
      steps: combinedSteps,
      agentOutputs,
      citations,
      newStepOutcomes,
      ...(stepsResult.cancelled
        ? { cancelled: { stepIndex: stepsResult.stepIndex } }
        : { failed: { stepIndex: stepsResult.stepIndex, message: stepsResult.message, code: stepsResult.code } })
    };
  }

  return { steps: combinedSteps, agentOutputs, citations, newStepOutcomes };
}

function sufficientFallback(notes: string): ReflectionResult {
  return {
    missingEvidence: [],
    weakArguments: [],
    conflictingSources: [],
    hallucinationRiskScore: 0,
    confidenceScore: 1,
    verdict: 'sufficient',
    notes,
    additionalStepsNeeded: []
  };
}

function buildFindingsSummary(steps: readonly InstructionStep[], agentOutputs: Record<string, string>): string {
  return steps.map((step, i) => {
    const out = agentOutputs[step.id] || 'Step executed successfully.';
    return `### Step ${i + 1}: ${step.title} (${step.agentName})\n\n**Instruction**: ${step.instruction}\n\n**Findings**:\n${out}`;
  }).join('\n\n---\n\n');
}

export interface CritiqueRoundInput {
  readonly userPrompt: string;
  readonly steps: readonly InstructionStep[];
  readonly agentOutputs: Record<string, string>;
  readonly citations: readonly CitationRecord[];
  readonly docTitles?: string;
  readonly selectedDocIds?: readonly string[];
  readonly availableAgentIds: readonly string[];
  readonly agentRoster: Record<string, AgentNode>;
  readonly confidenceThreshold: number;
  readonly reflectionService: ReflectionService;
  readonly executionService: ExecutionService;
  readonly progress: ProgressEmitter;
  readonly signal?: AbortSignal;
}

export interface CritiqueRoundResult {
  readonly reflection: ReflectionResult;
  readonly needsMoreResearch: boolean;
  readonly steps: InstructionStep[];
  readonly agentOutputs: Record<string, string>;
  readonly citations: CitationRecord[];
  readonly newStepOutcomes: StepOutcome[];
  readonly cancelled?: { stepIndex: number };
  readonly failed?: { stepIndex: number; message: string; code: string };
}

// Runs ONE Critic pass over the aggregated step findings so far. The caller (ResearchPipeline) is
// responsible for looping this up to config.reflection.maxIterations and persisting/emitting the
// result of each round - this function only does a single round so the iteration budget can be
// tracked in one place (and survive a resume()).
export async function runCritiqueRound(input: CritiqueRoundInput): Promise<CritiqueRoundResult> {
  const passthrough = {
    steps: [...input.steps],
    agentOutputs: { ...input.agentOutputs },
    citations: [...input.citations],
    newStepOutcomes: []
  };

  const critiqueResult = await input.reflectionService.critique(
    {
      userPrompt: input.userPrompt,
      aggregatedAgentFindings: buildFindingsSummary(input.steps, input.agentOutputs),
      docTitles: input.docTitles
    },
    event => input.progress.emit('standby', event.message)
  );

  if (!critiqueResult.ok) {
    return { reflection: sufficientFallback('Critique call failed; proceeding without further iteration.'), needsMoreResearch: false, ...passthrough };
  }

  const needsMoreResearch = critiqueResult.value.additionalStepsNeeded.length > 0 &&
    (critiqueResult.value.verdict === 'needs_iteration' || critiqueResult.value.confidenceScore < input.confidenceThreshold);

  if (!needsMoreResearch) {
    return { reflection: critiqueResult.value, needsMoreResearch: false, ...passthrough };
  }

  const runResult = await runAdditionalSteps(critiqueResult.value.additionalStepsNeeded, {
    steps: input.steps,
    agentOutputs: input.agentOutputs,
    citations: input.citations,
    selectedDocIds: input.selectedDocIds,
    availableAgentIds: input.availableAgentIds,
    agentRoster: input.agentRoster,
    executionService: input.executionService,
    progress: input.progress,
    signal: input.signal
  });

  return { reflection: critiqueResult.value, needsMoreResearch: !runResult.cancelled && !runResult.failed, ...runResult };
}

export interface ReviewRoundInput {
  readonly userPrompt: string;
  readonly finalReport: string;
  readonly citationSummary?: string;
  readonly steps: readonly InstructionStep[];
  readonly agentOutputs: Record<string, string>;
  readonly citations: readonly CitationRecord[];
  readonly selectedDocIds?: readonly string[];
  readonly availableAgentIds: readonly string[];
  readonly agentRoster: Record<string, AgentNode>;
  readonly confidenceThreshold: number;
  readonly reflectionService: ReflectionService;
  readonly executionService: ExecutionService;
  readonly progress: ProgressEmitter;
  readonly signal?: AbortSignal;
}

export interface ReviewRoundResult {
  readonly reflection: ReflectionResult;
  readonly needsResynthesis: boolean;
  readonly steps: InstructionStep[];
  readonly agentOutputs: Record<string, string>;
  readonly citations: CitationRecord[];
  readonly newStepOutcomes: StepOutcome[];
  readonly cancelled?: { stepIndex: number };
  readonly failed?: { stepIndex: number; message: string; code: string };
}

// Runs ONE Reviewer pass over the finished report. On needs_iteration it runs the suggested
// follow-up steps and signals the caller to re-synthesize with the enlarged findings set before
// reviewing again - re-synthesis itself (streaming a new report) stays in ResearchPipeline since
// that's the only place already doing SSE token streaming.
export async function runReviewRound(input: ReviewRoundInput): Promise<ReviewRoundResult> {
  const passthrough = {
    steps: [...input.steps],
    agentOutputs: { ...input.agentOutputs },
    citations: [...input.citations],
    newStepOutcomes: []
  };

  const reviewResult = await input.reflectionService.review(
    {
      userPrompt: input.userPrompt,
      finalReport: input.finalReport,
      citationSummary: input.citationSummary
    },
    event => input.progress.emit('standby', event.message)
  );

  if (!reviewResult.ok) {
    return { reflection: sufficientFallback('Review call failed; proceeding without further iteration.'), needsResynthesis: false, ...passthrough };
  }

  const needsResynthesis = reviewResult.value.additionalStepsNeeded.length > 0 &&
    (reviewResult.value.verdict === 'needs_iteration' || reviewResult.value.confidenceScore < input.confidenceThreshold);

  if (!needsResynthesis) {
    return { reflection: reviewResult.value, needsResynthesis: false, ...passthrough };
  }

  const runResult = await runAdditionalSteps(reviewResult.value.additionalStepsNeeded, {
    steps: input.steps,
    agentOutputs: input.agentOutputs,
    citations: input.citations,
    selectedDocIds: input.selectedDocIds,
    availableAgentIds: input.availableAgentIds,
    agentRoster: input.agentRoster,
    executionService: input.executionService,
    progress: input.progress,
    signal: input.signal
  });

  return { reflection: reviewResult.value, needsResynthesis: !runResult.cancelled && !runResult.failed, ...runResult };
}
