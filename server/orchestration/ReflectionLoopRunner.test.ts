import { describe, expect, it } from 'vitest';
import type { AgentNode, InstructionStep, TechDocument } from '../../client/types';
import type { ProviderError } from '../errors/AppError';
import type { GenerateResult, LLMProvider, StreamChunk } from '../llm/LLMProvider';
import { Ok, type Result } from '../result';
import { DocumentService } from '../services/DocumentService';
import { ExecutionService } from '../services/ExecutionService';
import { ReflectionService } from '../services/ReflectionService';
import { ToolService } from '../services/ToolService';
import { createToolExecutor, createToolRegistry } from '../tools';
import { ProgressEmitter } from './ProgressEmitter';
import { runCritiqueRound, runReviewRound } from './ReflectionLoopRunner';

class InMemoryDocumentStore {
  private documents: TechDocument[] = [];
  list(): readonly TechDocument[] { return this.documents; }
  add(doc: TechDocument): void { this.documents.unshift(doc); }
  remove(id: string): number {
    this.documents = this.documents.filter(d => d.id !== id);
    return this.documents.length;
  }
}

// Routes by a distinguishing substring in each prompt template (critic.md vs reflection.md vs
// research.md/tool_selection.md), since ExecutionService and ReflectionService each make their own
// generate() calls with different expected JSON shapes - a single canned response can't serve both.
class RoutingLLMProvider implements LLMProvider {
  readonly name = 'fake';
  critiqueCalls = 0;
  reviewCalls = 0;

  constructor(
    private readonly analysisResponse: GenerateResult,
    private readonly critiqueResponse: GenerateResult,
    private readonly reviewResponse: GenerateResult
  ) {}

  async generate(prompt: string): Promise<Result<GenerateResult, ProviderError>> {
    if (prompt.includes('Call exactly one of the available tools')) return Ok({ text: '{}' });
    if (prompt.includes('Formulate 3-5 step-by-step technical thoughts')) return Ok(this.analysisResponse);
    if (prompt.includes('You are Agent Critic')) { this.critiqueCalls++; return Ok(this.critiqueResponse); }
    if (prompt.includes('You are Agent Reviewer')) { this.reviewCalls++; return Ok(this.reviewResponse); }
    return Ok({ text: '{}' });
  }
  async *stream(): AsyncIterable<StreamChunk> { yield { type: 'done' }; }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

function makeStep(id: string, title: string): InstructionStep {
  return {
    id, stepNumber: 1, assignedAgentId: 'literature', agentName: 'Agent Hypatia',
    title, instruction: `Investigate ${title}`, requiredTools: ['mcp_doc_search'], status: 'pending'
  };
}

function buildDeps(provider: RoutingLLMProvider) {
  const documentService = new DocumentService(new InMemoryDocumentStore() as any);
  const toolRegistry = createToolRegistry();
  const toolExecutor = createToolExecutor(toolRegistry);
  const toolService = new ToolService(toolRegistry, toolExecutor, documentService, provider);
  const executionService = new ExecutionService(provider, toolService, documentService);
  const reflectionService = new ReflectionService(provider);
  const progress = new ProgressEmitter(() => {});
  return { executionService, reflectionService, progress };
}

const agentRoster: Record<string, AgentNode> = {
  literature: { id: 'literature', role: 'literature', name: 'Agent Hypatia', title: 'X', avatar: '', description: '', status: 'idle', progress: 0, thoughtTrace: [], toolsAccess: [] }
};

const analysisResponse: GenerateResult = { text: JSON.stringify({ thoughtTrace: ['t'], agentOutput: 'More findings.', keyTakeaways: ['k'] }) };

const sufficientResponse: GenerateResult = {
  text: JSON.stringify({
    missingEvidence: [], weakArguments: [], conflictingSources: [],
    hallucinationRiskScore: 0.1, confidenceScore: 0.9, verdict: 'sufficient', notes: 'Looks solid.'
  })
};

const needsIterationResponse: GenerateResult = {
  text: JSON.stringify({
    missingEvidence: ['Missing benchmarks'], weakArguments: [], conflictingSources: [],
    hallucinationRiskScore: 0.5, confidenceScore: 0.2, verdict: 'needs_iteration',
    notes: 'Needs more evidence.',
    additionalStepsNeeded: [{ title: 'Gather benchmarks', instruction: 'Find throughput numbers', requiredTools: ['mcp_doc_search'] }]
  })
};

describe('runCritiqueRound', () => {
  it('reports needsMoreResearch:false and makes no step changes when the critic says sufficient', async () => {
    const provider = new RoutingLLMProvider(analysisResponse, sufficientResponse, sufficientResponse);
    const { executionService, reflectionService, progress } = buildDeps(provider);
    const steps = [makeStep('step_1', 'A')];

    const round = await runCritiqueRound({
      userPrompt: 'Investigate X',
      steps,
      agentOutputs: { step_1: 'Findings.' },
      citations: [],
      availableAgentIds: ['literature'],
      agentRoster,
      confidenceThreshold: 0.6,
      reflectionService,
      executionService,
      progress
    });

    expect(round.needsMoreResearch).toBe(false);
    expect(round.steps).toHaveLength(1);
    expect(round.newStepOutcomes).toHaveLength(0);
  });

  it('appends and runs the suggested follow-up step when the critic says needs_iteration', async () => {
    const provider = new RoutingLLMProvider(analysisResponse, needsIterationResponse, sufficientResponse);
    const { executionService, reflectionService, progress } = buildDeps(provider);
    const steps = [makeStep('step_1', 'A')];

    const round = await runCritiqueRound({
      userPrompt: 'Investigate X',
      steps,
      agentOutputs: { step_1: 'Findings.' },
      citations: [],
      availableAgentIds: ['literature'],
      agentRoster,
      confidenceThreshold: 0.6,
      reflectionService,
      executionService,
      progress
    });

    expect(round.needsMoreResearch).toBe(true);
    expect(round.steps).toHaveLength(2);
    expect(round.steps[1].title).toBe('Gather benchmarks');
    expect(round.newStepOutcomes).toHaveLength(1);
    expect(round.agentOutputs[round.steps[1].id]).toBe('More findings.');
  });

  it('treats a low confidence score as needing iteration even if the verdict says sufficient', async () => {
    const lowConfidenceButSufficient: GenerateResult = {
      text: JSON.stringify({
        missingEvidence: [], weakArguments: [], conflictingSources: [],
        hallucinationRiskScore: 0.5, confidenceScore: 0.3, verdict: 'sufficient', notes: 'Uncertain.',
        additionalStepsNeeded: [{ title: 'Double-check', instruction: 'Re-verify', requiredTools: ['mcp_doc_search'] }]
      })
    };
    const provider = new RoutingLLMProvider(analysisResponse, lowConfidenceButSufficient, sufficientResponse);
    const { executionService, reflectionService, progress } = buildDeps(provider);
    const steps = [makeStep('step_1', 'A')];

    const round = await runCritiqueRound({
      userPrompt: 'Investigate X',
      steps,
      agentOutputs: { step_1: 'Findings.' },
      citations: [],
      availableAgentIds: ['literature'],
      agentRoster,
      confidenceThreshold: 0.6,
      reflectionService,
      executionService,
      progress
    });

    expect(round.needsMoreResearch).toBe(true);
  });
});

describe('runReviewRound', () => {
  it('reports needsResynthesis:false when the reviewer says sufficient', async () => {
    const provider = new RoutingLLMProvider(analysisResponse, sufficientResponse, sufficientResponse);
    const { executionService, reflectionService, progress } = buildDeps(provider);
    const steps = [makeStep('step_1', 'A')];

    const round = await runReviewRound({
      userPrompt: 'Investigate X',
      finalReport: '# Report\nSome content.',
      steps,
      agentOutputs: { step_1: 'Findings.' },
      citations: [],
      availableAgentIds: ['literature'],
      agentRoster,
      confidenceThreshold: 0.6,
      reflectionService,
      executionService,
      progress
    });

    expect(round.needsResynthesis).toBe(false);
  });

  it('runs suggested follow-up steps and reports needsResynthesis:true on needs_iteration', async () => {
    const provider = new RoutingLLMProvider(analysisResponse, sufficientResponse, needsIterationResponse);
    const { executionService, reflectionService, progress } = buildDeps(provider);
    const steps = [makeStep('step_1', 'A')];

    const round = await runReviewRound({
      userPrompt: 'Investigate X',
      finalReport: '# Report\nSome content.',
      steps,
      agentOutputs: { step_1: 'Findings.' },
      citations: [],
      availableAgentIds: ['literature'],
      agentRoster,
      confidenceThreshold: 0.6,
      reflectionService,
      executionService,
      progress
    });

    expect(round.needsResynthesis).toBe(true);
    expect(round.steps).toHaveLength(2);
    expect(round.newStepOutcomes).toHaveLength(1);
  });
});
