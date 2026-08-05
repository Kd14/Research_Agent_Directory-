import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { TechDocument } from '../../client/types';
import { ProviderError } from '../errors/AppError';
import type { GenerateOptions, GenerateResult, LLMProvider, StreamChunk } from '../llm/LLMProvider';
import { ResilientLLMProvider } from '../llm/ResilientLLMProvider';
import { Err, Ok, type Result } from '../result';
import { DocumentService } from '../services/DocumentService';
import { ExecutionService } from '../services/ExecutionService';
import { PlannerService } from '../services/PlannerService';
import { ReflectionService } from '../services/ReflectionService';
import { SessionService } from '../services/SessionService';
import { ToolService } from '../services/ToolService';
import { SessionStore } from '../storage/SessionStore';
import { createToolExecutor, createToolRegistry } from '../tools';
import { ResearchPipeline, type ReflectionConfig } from './ResearchPipeline';

const DISABLED_REFLECTION: ReflectionConfig = { enabled: false, maxIterations: 2, confidenceThreshold: 0.6 };

class InMemoryDocumentStore {
  private documents: TechDocument[] = [];
  list(): readonly TechDocument[] { return this.documents; }
  add(doc: TechDocument): void { this.documents.unshift(doc); }
  remove(id: string): number {
    this.documents = this.documents.filter(d => d.id !== id);
    return this.documents.length;
  }
}

// Returns queued responses in order (repeating the last one once exhausted) so a single fake can
// stand in for the plan call, then per-step tool-selection + analysis calls, in sequence.
class QueuedLLMProvider implements LLMProvider {
  readonly name = 'fake';
  private callIndex = 0;
  constructor(private readonly responses: GenerateResult[], private readonly streamText: string = 'Final report body.') {}

  async generate(): Promise<Result<GenerateResult, ProviderError>> {
    const response = this.responses[Math.min(this.callIndex, this.responses.length - 1)];
    this.callIndex++;
    return Ok(response);
  }
  async *stream(): AsyncIterable<StreamChunk> {
    yield { type: 'text', textDelta: this.streamText };
    yield { type: 'done' };
  }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

const tempDirs: string[] = [];

function buildPipeline(llmProvider: LLMProvider, reflectionConfig: ReflectionConfig = DISABLED_REFLECTION) {
  const documentService = new DocumentService(new InMemoryDocumentStore() as any);
  const toolRegistry = createToolRegistry();
  const toolExecutor = createToolExecutor(toolRegistry);
  const toolService = new ToolService(toolRegistry, toolExecutor, documentService, llmProvider);
  const plannerService = new PlannerService(llmProvider, documentService);
  const executionService = new ExecutionService(llmProvider, toolService, documentService);
  const reflectionService = new ReflectionService(llmProvider);

  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-pipeline-'));
  tempDirs.push(sessionsDir);
  const sessionService = new SessionService(new SessionStore(sessionsDir));

  const pipeline = new ResearchPipeline(plannerService, executionService, sessionService, llmProvider, reflectionService, reflectionConfig);
  return { pipeline, sessionService };
}

function collectEvents() {
  const events: { event: string; data: unknown }[] = [];
  const onEvent = (event: string, data: unknown) => events.push({ event, data });
  return { events, onEvent };
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

const emptyPlanResponse: GenerateResult = {
  text: JSON.stringify({ title: 'Empty Plan Session', researchGoal: 'Goal', instructionSet: [] })
};

const onePlanResponse: GenerateResult = {
  text: JSON.stringify({
    title: 'One Step Session',
    researchGoal: 'Goal',
    instructionSet: [
      { stepNumber: 1, assignedAgentId: 'literature', agentName: 'Agent Hypatia', title: 'Step 1', instruction: 'Investigate', requiredTools: ['mcp_doc_search'] }
    ]
  })
};

const analysisResponse: GenerateResult = {
  text: JSON.stringify({ thoughtTrace: ['thinking'], agentOutput: 'Findings.', keyTakeaways: ['takeaway'] })
};

// Routes by a distinguishing substring in each prompt template rather than call order, so a single
// provider can stand in for the plan call, tool-selection, analysis, AND the Critic/Reviewer's
// structured-JSON calls (which have entirely different response shapes) across a full run.
class RoutingLLMProvider implements LLMProvider {
  readonly name = 'fake';
  critiqueCalls = 0;
  reviewCalls = 0;

  constructor(
    private readonly planResponse: GenerateResult,
    private readonly analysisResp: GenerateResult,
    private readonly critiqueResponse: GenerateResult,
    private readonly reviewResponse: GenerateResult,
    private readonly streamText: string = 'Final report body.'
  ) {}

  async generate(prompt: string): Promise<Result<GenerateResult, ProviderError>> {
    if (prompt.includes('Step 0 - before writing any steps')) return Ok(this.planResponse);
    if (prompt.includes('Call exactly one of the available tools')) return Ok({ text: '{}' });
    if (prompt.includes('Formulate 3-5 step-by-step technical thoughts')) return Ok(this.analysisResp);
    if (prompt.includes('You are Agent Critic')) { this.critiqueCalls++; return Ok(this.critiqueResponse); }
    if (prompt.includes('You are Agent Reviewer')) { this.reviewCalls++; return Ok(this.reviewResponse); }
    return Ok({ text: '{}' });
  }
  async *stream(): AsyncIterable<StreamChunk> {
    yield { type: 'text', textDelta: this.streamText };
    yield { type: 'done' };
  }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

// Fails the very first generate() call (the plan call, always the first one made in a fresh run)
// with a transient-looking error, then delegates everything else to the wrapped provider - used to
// exercise ResilientLLMProvider's standby/retry against a full pipeline run rather than in isolation.
class FailFirstCallProvider implements LLMProvider {
  readonly name = 'fake';
  private failed = false;
  constructor(private readonly inner: LLMProvider) {}

  async generate(prompt: string, options?: GenerateOptions): Promise<Result<GenerateResult, ProviderError>> {
    if (!this.failed) {
      this.failed = true;
      return Err(new ProviderError('got status: 503 Service Unavailable', 'fake'));
    }
    return this.inner.generate(prompt, options);
  }
  stream(prompt: string, options?: GenerateOptions): AsyncIterable<StreamChunk> {
    return this.inner.stream(prompt, options);
  }
  async countTokens(text: string): Promise<number> { return this.inner.countTokens(text); }
  supportsThinking(): boolean { return this.inner.supportsThinking(); }
  supportsTools(): boolean { return this.inner.supportsTools(); }
}

const sufficientReflection: GenerateResult = {
  text: JSON.stringify({
    missingEvidence: [], weakArguments: [], conflictingSources: [],
    hallucinationRiskScore: 0.1, confidenceScore: 0.9, verdict: 'sufficient', notes: 'Looks solid.'
  })
};

const needsIterationReflection: GenerateResult = {
  text: JSON.stringify({
    missingEvidence: ['gap'], weakArguments: [], conflictingSources: [],
    hallucinationRiskScore: 0.5, confidenceScore: 0.1, verdict: 'needs_iteration', notes: 'Keep digging.',
    additionalStepsNeeded: [{ title: 'Dig deeper', instruction: 'Find more evidence', requiredTools: ['mcp_doc_search'] }]
  })
};

const ENABLED_REFLECTION: ReflectionConfig = { enabled: true, maxIterations: 2, confidenceThreshold: 0.6 };

describe('ResearchPipeline.run', () => {
  it('plans, skips an empty step loop, and streams synthesis through to completion', async () => {
    const { pipeline, sessionService } = buildPipeline(new QueuedLLMProvider([emptyPlanResponse]));
    const { events, onEvent } = collectEvents();

    await pipeline.run({ userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] }, { onEvent });

    const sessionEvent = events.find(e => e.event === 'session');
    expect(sessionEvent).toBeDefined();
    const sessionId = (sessionEvent!.data as any).id;

    expect(events.some(e => e.event === 'report' && (e.data as any).report === 'Final report body.')).toBe(true);
    expect(events.some(e => e.event === 'progress' && (e.data as any).phase === 'finished')).toBe(true);

    const loaded = sessionService.load(sessionId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.metadata.status).toBe('completed');
      expect(loaded.value.history.finalReportArtifact).toBe('report.md');
    }
  });

  it('persists status "paused" at the cancelled stepIndex when the client aborts mid-run', async () => {
    const { pipeline, sessionService } = buildPipeline(new QueuedLLMProvider([onePlanResponse, analysisResponse]));
    const controller = new AbortController();
    const { events, onEvent } = collectEvents();

    // Abort as soon as the session is created and persisted, before the (single) step actually runs -
    // deterministic without needing to race real async work.
    const onEventThenAbort = (event: string, data: unknown) => {
      onEvent(event, data);
      if (event === 'session') controller.abort();
    };

    await pipeline.run(
      { userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] },
      { onEvent: onEventThenAbort, signal: controller.signal }
    );

    const sessionEvent = events.find(e => e.event === 'session');
    const sessionId = (sessionEvent!.data as any).id;

    expect(events.some(e => e.event === 'step_result')).toBe(false);
    expect(events.some(e => e.event === 'report')).toBe(false);

    const loaded = sessionService.load(sessionId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.metadata.status).toBe('paused');
      expect(loaded.value.history.currentStepIndex).toBe(0);
    }
  });
});

describe('ResearchPipeline.resume', () => {
  it('continues from the persisted currentStepIndex and completes synthesis', async () => {
    const { pipeline, sessionService } = buildPipeline(new QueuedLLMProvider([analysisResponse]));

    const metadata = sessionService.create({
      title: 'Paused Session',
      userPrompt: 'Investigate X',
      selectedDocIds: [],
      executionMode: 'auto'
    });
    sessionService.save(metadata.id, {
      instructionSet: [
        {
          id: 'step_1',
          stepNumber: 1,
          assignedAgentId: 'literature',
          agentName: 'Agent Hypatia',
          title: 'Step 1',
          instruction: 'Investigate',
          requiredTools: ['mcp_doc_search'],
          status: 'pending'
        }
      ],
      agents: {},
      logs: [],
      agentOutputs: {},
      currentStepIndex: 0,
      status: 'paused'
    } as any);

    const { events, onEvent } = collectEvents();
    await pipeline.resume(metadata.id, { onEvent });

    expect(events.some(e => e.event === 'step_result')).toBe(true);
    expect(events.some(e => e.event === 'report' && (e.data as any).report === 'Final report body.')).toBe(true);

    const loaded = sessionService.load(metadata.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.metadata.status).toBe('completed');
      expect(loaded.value.history.agentOutputs['step_1']).toBe('Findings.');
    }
  });

  it('replays an already-completed session without re-running the pipeline', async () => {
    const { pipeline, sessionService } = buildPipeline(new QueuedLLMProvider([analysisResponse]));

    const metadata = sessionService.create({
      title: 'Done Session',
      userPrompt: 'Investigate X',
      selectedDocIds: [],
      executionMode: 'auto'
    });
    sessionService.save(metadata.id, { instructionSet: [], agents: {}, logs: [], agentOutputs: {}, currentStepIndex: 0 });
    sessionService.writeArtifact(metadata.id, 'report.md', 'Already-finished report.');
    sessionService.save(metadata.id, { finalReportArtifact: 'report.md', status: 'completed' });

    const { events, onEvent } = collectEvents();
    await pipeline.resume(metadata.id, { onEvent });

    expect(events.some(e => e.event === 'report' && (e.data as any).report === 'Already-finished report.')).toBe(true);
    expect(events.some(e => e.event === 'step_result')).toBe(false);
  });
});

// The most important tests in this file: an LLM judge that NEVER says "sufficient" must not be able
// to loop the pipeline forever. Both the pre-synthesis Critic loop and the post-synthesis Reviewer
// loop are exercised with a provider that always returns needs_iteration, verifying each is capped
// at reflectionConfig.maxIterations and the run still completes (a 'report' event still fires).
describe('ResearchPipeline reflection loop iteration cap', () => {
  it('stops the Critic loop at maxIterations even when the critic always says needs_iteration', async () => {
    const provider = new RoutingLLMProvider(onePlanResponse, analysisResponse, needsIterationReflection, sufficientReflection);
    const { pipeline, sessionService } = buildPipeline(provider, { ...ENABLED_REFLECTION, maxIterations: 2 });
    const { events, onEvent } = collectEvents();

    await pipeline.run({ userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] }, { onEvent });

    expect(provider.critiqueCalls).toBe(2);
    expect(events.some(e => e.event === 'report')).toBe(true);
    expect(events.some(e => e.event === 'progress' && (e.data as any).phase === 'finished')).toBe(true);

    const stepResultEvents = events.filter(e => e.event === 'step_result');
    // 1 original step + 2 critic-requested follow-up steps (one per allowed iteration).
    expect(stepResultEvents).toHaveLength(3);

    const sessionEvent = events.find(e => e.event === 'session');
    const sessionId = (sessionEvent!.data as any).id;
    const loaded = sessionService.load(sessionId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.metadata.status).toBe('completed');
      expect(loaded.value.history.reflectionIterationCount).toBe(2);
      expect(loaded.value.history.reflections.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('stops the Reviewer loop at maxIterations even when the reviewer always says needs_iteration', async () => {
    const provider = new RoutingLLMProvider(onePlanResponse, analysisResponse, sufficientReflection, needsIterationReflection);
    const { pipeline, sessionService } = buildPipeline(provider, { ...ENABLED_REFLECTION, maxIterations: 2 });
    const { events, onEvent } = collectEvents();

    await pipeline.run({ userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] }, { onEvent });

    expect(provider.reviewCalls).toBe(2);
    expect(events.some(e => e.event === 'report')).toBe(true);
    expect(events.some(e => e.event === 'progress' && (e.data as any).phase === 'finished')).toBe(true);

    const sessionEvent = events.find(e => e.event === 'session');
    const sessionId = (sessionEvent!.data as any).id;
    const loaded = sessionService.load(sessionId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.metadata.status).toBe('completed');
      expect(loaded.value.history.reflectionIterationCount).toBe(2);
    }
  });

  it('skips both stages entirely when reflection is disabled (the pre-P2 cheap default)', async () => {
    const provider = new RoutingLLMProvider(onePlanResponse, analysisResponse, needsIterationReflection, needsIterationReflection);
    const { pipeline, sessionService } = buildPipeline(provider, DISABLED_REFLECTION);
    const { events, onEvent } = collectEvents();

    await pipeline.run({ userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] }, { onEvent });

    expect(provider.critiqueCalls).toBe(0);
    expect(provider.reviewCalls).toBe(0);
    expect(events.some(e => e.event === 'report')).toBe(true);

    const sessionEvent = events.find(e => e.event === 'session');
    const sessionId = (sessionEvent!.data as any).id;
    const loaded = sessionService.load(sessionId);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.history.reflectionIterationCount).toBe(0);
      expect(loaded.value.history.reflections).toEqual([]);
    }
  });
});

// reflectionOverride (e.g. from a saved user preference) lets a single run() call flip reflection
// on/off regardless of the server's configured default - resume() intentionally has no such
// parameter (see the PipelineCallbacks doc comment), so it isn't covered here.
describe('ResearchPipeline reflectionOverride', () => {
  it('runs the Critic/Reviewer loops when the server default is disabled but the run explicitly opts in', async () => {
    const provider = new RoutingLLMProvider(onePlanResponse, analysisResponse, sufficientReflection, sufficientReflection);
    const { pipeline } = buildPipeline(provider, DISABLED_REFLECTION);
    const { events, onEvent } = collectEvents();

    await pipeline.run(
      { userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] },
      { onEvent, reflectionOverride: true }
    );

    expect(provider.critiqueCalls).toBe(1);
    expect(provider.reviewCalls).toBe(1);
    expect(events.some(e => e.event === 'report')).toBe(true);
  });

  it('skips the Critic/Reviewer loops when the server default is enabled but the run explicitly opts out', async () => {
    const provider = new RoutingLLMProvider(onePlanResponse, analysisResponse, needsIterationReflection, needsIterationReflection);
    const { pipeline } = buildPipeline(provider, ENABLED_REFLECTION);
    const { events, onEvent } = collectEvents();

    await pipeline.run(
      { userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] },
      { onEvent, reflectionOverride: false }
    );

    expect(provider.critiqueCalls).toBe(0);
    expect(provider.reviewCalls).toBe(0);
    expect(events.some(e => e.event === 'report')).toBe(true);
  });
});

// End-to-end check that a provider wrapped in ResilientLLMProvider (as it is in server/index.ts)
// surfaces a live 'standby' progress event when the LLM is transiently unavailable, then completes
// the run normally once it recovers - not just that ResilientLLMProvider itself retries in isolation.
describe('ResearchPipeline standby/retry', () => {
  it('emits a standby progress event and still completes the run when the LLM is transiently unavailable', async () => {
    const inner = new RoutingLLMProvider(onePlanResponse, analysisResponse, sufficientReflection, sufficientReflection);
    const flaky = new FailFirstCallProvider(inner);
    const resilientProvider = new ResilientLLMProvider(flaky, { pollIntervalMs: 1, maxWaitMs: 0 });

    const { pipeline } = buildPipeline(resilientProvider, DISABLED_REFLECTION);
    const { events, onEvent } = collectEvents();

    await pipeline.run({ userPrompt: 'Investigate X', docIds: [], activeAgentIds: ['literature'] }, { onEvent });

    const standbyEvents = events.filter(e => e.event === 'progress' && (e.data as any).phase === 'standby');
    expect(standbyEvents.length).toBeGreaterThan(0);
    expect((standbyEvents[0].data as any).message).toMatch(/standing by/i);
    expect(events.some(e => e.event === 'report')).toBe(true);
    expect(events.some(e => e.event === 'progress' && (e.data as any).phase === 'finished')).toBe(true);
  });
});
