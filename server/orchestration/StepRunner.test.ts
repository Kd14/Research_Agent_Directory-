import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstructionStep, TechDocument } from '../../client/types';
import type { ProviderError } from '../errors/AppError';
import type { GenerateResult, LLMProvider, StreamChunk } from '../llm/LLMProvider';
import { Ok, type Result } from '../result';
import { DocumentService } from '../services/DocumentService';
import { ExecutionService } from '../services/ExecutionService';
import { ToolService } from '../services/ToolService';
import { createToolExecutor, createToolRegistry } from '../tools';
import { ProgressEmitter } from './ProgressEmitter';
import { StepRunner } from './StepRunner';

class InMemoryDocumentStore {
  private documents: TechDocument[] = [];
  list(): readonly TechDocument[] { return this.documents; }
  add(doc: TechDocument): void { this.documents.unshift(doc); }
  remove(id: string): number {
    this.documents = this.documents.filter(d => d.id !== id);
    return this.documents.length;
  }
}

class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';
  constructor(private readonly responseText: string) {}

  async generate(): Promise<Result<GenerateResult, ProviderError>> {
    return Ok({ text: this.responseText });
  }
  async *stream(): AsyncIterable<StreamChunk> {
    yield { type: 'done' };
  }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

function buildStepRunner(responseText: string) {
  const documentService = new DocumentService(new InMemoryDocumentStore() as any);
  const llmProvider = new FakeLLMProvider(responseText);
  const toolRegistry = createToolRegistry();
  const toolExecutor = createToolExecutor(toolRegistry);
  const toolService = new ToolService(toolRegistry, toolExecutor, documentService, llmProvider);
  const executionService = new ExecutionService(llmProvider, toolService, documentService);
  const events: unknown[] = [];
  const progress = new ProgressEmitter(e => events.push(e));
  return { stepRunner: new StepRunner(executionService, progress), events };
}

function makeStep(id: string, title: string): InstructionStep {
  return {
    id,
    stepNumber: 1,
    assignedAgentId: 'literature',
    agentName: 'Agent Hypatia',
    title,
    instruction: `Investigate ${title}`,
    requiredTools: ['mcp_doc_search'],
    status: 'pending'
  };
}

const validAnalysis = JSON.stringify({ thoughtTrace: ['t'], agentOutput: 'Findings', keyTakeaways: ['k'] });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StepRunner', () => {
  it('runs all steps from startIndex 0 and reports ok', async () => {
    const { stepRunner, events } = buildStepRunner(validAnalysis);
    const steps = [makeStep('step_1', 'A'), makeStep('step_2', 'B')];
    const completed: number[] = [];

    const result = await stepRunner.run({ steps, startIndex: 0, onStepComplete: i => completed.push(i) });

    expect(result.ok).toBe(true);
    expect(completed).toEqual([0, 1]);
    expect(events.some(e => (e as any).phase === 'running_tools')).toBe(true);
  });

  it('resumes from a non-zero startIndex, skipping earlier steps', async () => {
    const { stepRunner } = buildStepRunner(validAnalysis);
    const steps = [makeStep('step_1', 'A'), makeStep('step_2', 'B'), makeStep('step_3', 'C')];
    const completed: number[] = [];

    const result = await stepRunner.run({ steps, startIndex: 2, onStepComplete: i => completed.push(i) });

    expect(result.ok).toBe(true);
    expect(completed).toEqual([2]);
  });

  it('reports a cancelled result immediately when the signal is already aborted', async () => {
    const { stepRunner } = buildStepRunner(validAnalysis);
    const controller = new AbortController();
    controller.abort();
    const steps = [makeStep('step_1', 'A')];

    const result = await stepRunner.run({ steps, startIndex: 0, signal: controller.signal, onStepComplete: () => {} });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cancelled).toBe(true);
    }
  });

  it('propagates a step execution failure as a non-cancelled error at the failing stepIndex', async () => {
    const { stepRunner } = buildStepRunner('not valid json');
    const steps = [makeStep('step_1', 'A'), makeStep('step_2', 'B')];
    const completed: number[] = [];

    const result = await stepRunner.run({ steps, startIndex: 0, onStepComplete: i => completed.push(i) });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cancelled).toBeUndefined();
      expect(result.stepIndex).toBe(0);
      expect(result.code).toBe('EXECUTION_ERROR');
    }
    expect(completed).toEqual([]);
  });
});
