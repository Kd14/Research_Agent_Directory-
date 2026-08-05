import { describe, expect, it } from 'vitest';
import type { InstructionStep, TechDocument } from '../../client/types';
import type { ProviderError } from '../errors/AppError';
import type { GenerateOptions, GenerateResult, LLMProvider, StreamChunk } from '../llm/LLMProvider';
import { Ok, type Result } from '../result';
import { createToolExecutor, createToolRegistry } from '../tools';
import { DocumentService } from './DocumentService';
import { ExecutionService } from './ExecutionService';
import { ToolService } from './ToolService';

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
  async *stream(): AsyncIterable<StreamChunk> { yield { type: 'done' }; }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

// Simulates a model that chains two real tool calls (different search queries) before declining a
// third, so the multi-hop loop in ExecutionService.executeStep gets exercised end-to-end rather than
// only ever hitting the single-fallback-call path the other fakes in this file take.
class ScriptedToolChainProvider implements LLMProvider {
  readonly name = 'fake';
  private toolSelectionCalls = 0;
  constructor(private readonly analysisText: string) {}

  async generate(_prompt: string, options: GenerateOptions = {}): Promise<Result<GenerateResult, ProviderError>> {
    if (!options.functionDeclarations?.length) {
      return Ok({ text: this.analysisText });
    }
    this.toolSelectionCalls++;
    if (this.toolSelectionCalls === 1) {
      return Ok({ text: '', toolCalls: [{ name: 'mcp_doc_search', args: { query: 'insulin resistance mechanisms' } }] });
    }
    if (this.toolSelectionCalls === 2) {
      return Ok({ text: '', toolCalls: [{ name: 'mcp_doc_search', args: { query: 'insulin resistance treatment' } }] });
    }
    return Ok({ text: 'No further evidence needed.' }); // declines a third call
  }
  async *stream(): AsyncIterable<StreamChunk> { yield { type: 'done' }; }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

const fakeSearchIndexService = {
  search: async () => [
    { docId: 'doc1', docTitle: 'Insulin Paper', chunkId: 'doc1#0', chunkText: 'Insulin regulates glucose uptake.', offsetStart: 0, offsetEnd: 34, bm25Score: 1, embeddingScore: 0, finalScore: 1 }
  ]
};

function buildExecutionService(responseText: string, withSearchIndex: boolean) {
  const documentService = new DocumentService(new InMemoryDocumentStore() as any);
  const llmProvider = new FakeLLMProvider(responseText);
  const toolRegistry = createToolRegistry();
  const toolExecutor = createToolExecutor(toolRegistry);
  const toolService = new ToolService(
    toolRegistry,
    toolExecutor,
    documentService,
    llmProvider,
    undefined,
    withSearchIndex ? (fakeSearchIndexService as any) : undefined
  );
  return new ExecutionService(llmProvider, toolService, documentService);
}

function makeStep(): InstructionStep {
  return {
    id: 'step_1',
    stepNumber: 1,
    assignedAgentId: 'literature',
    agentName: 'Agent Hypatia',
    title: 'Insulin Pathways',
    instruction: 'Investigate insulin signaling pathways',
    requiredTools: ['mcp_doc_search'],
    status: 'pending'
  };
}

const validAnalysis = JSON.stringify({ thoughtTrace: ['t1', 't2'], agentOutput: 'Findings on insulin.', keyTakeaways: ['k1'] });

describe('ExecutionService.executeStep', () => {
  it('falls back to the step\'s declared tool when the model declines a function call, and returns the analysis', async () => {
    const executionService = buildExecutionService(validAnalysis, false);
    const step = makeStep();

    const result = await executionService.executeStep({ step });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolCallUsed).toBe('mcp_doc_search');
      expect(result.value.agentOutput).toBe('Findings on insulin.');
      expect(result.value.citations).toEqual([]);
    }
  });

  it('collects citations recorded by the tool and tags each with the step id as consumedBy', async () => {
    const executionService = buildExecutionService(validAnalysis, true);
    const step = makeStep();

    const result = await executionService.executeStep({ step });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.citations).toHaveLength(1);
      const citation = result.value.citations[0];
      expect(citation.toolName).toBe('mcp_doc_search');
      expect(citation.docId).toBe('doc1');
      expect(citation.consumedBy).toEqual(['step_1']);
      expect(citation.id).toMatch(/^citation_/);
      expect(typeof citation.createdAt).toBe('string');
    }
  });

  it('returns an ExecutionError with the failing stepId when the analysis response is not valid JSON', async () => {
    const executionService = buildExecutionService('not valid json', false);
    const step = makeStep();

    const result = await executionService.executeStep({ step });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stepId).toBe('step_1');
      expect(result.error.code).toBe('EXECUTION_ERROR');
    }
  });

  it('chains multiple tool calls in one step when the model keeps requesting evidence, then stops once it declines', async () => {
    const documentService = new DocumentService(new InMemoryDocumentStore() as any);
    const llmProvider = new ScriptedToolChainProvider(validAnalysis);
    const toolRegistry = createToolRegistry();
    const toolExecutor = createToolExecutor(toolRegistry);
    const toolService = new ToolService(toolRegistry, toolExecutor, documentService, llmProvider, undefined, fakeSearchIndexService as any);
    const executionService = new ExecutionService(llmProvider, toolService, documentService);
    const step = makeStep();

    const result = await executionService.executeStep({ step });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolCallUsed).toBe('mcp_doc_search, mcp_doc_search');
      expect((result.value.toolResult as unknown[])).toHaveLength(2);
      expect(result.value.citations).toHaveLength(2);
      expect(result.value.agentOutput).toBe('Findings on insulin.');
    }
  });

  it('skips the tool-selection phase entirely when the step declares no requiredTools', async () => {
    const executionService = buildExecutionService(validAnalysis, true);
    const step: InstructionStep = { ...makeStep(), requiredTools: [] };

    const result = await executionService.executeStep({ step });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toolCallUsed).toBeNull();
      expect(result.value.citations).toEqual([]);
    }
  });
});
