import type { FunctionDeclaration } from '@google/genai';
import type { MCPTool } from '../../client/types';
import type { ToolError, ValidationError } from '../errors/AppError';
import { noopLogger, withTiming, type LoggerLike } from '../observability/logger';
import type { Result } from '../result';
import type { LLMProvider } from '../llm/LLMProvider';
import type { SearchIndexService } from '../search/SearchIndexService';
import type { ToolExecutor, ToolRegistry } from '../tools';
import type { DocumentService } from './DocumentService';

const DISPLAY_TOOLS: MCPTool[] = [
  {
    name: 'mcp_doc_search',
    description: 'Queries uploaded technical documents, pipeline specs, and architecture sheets via semantic/keyword retrieval.',
    category: 'Document Storage',
    callCount: 24,
    status: 'idle',
    schema: {
      inputs: ['query: string', 'docIds?: string[]', 'topK?: number'],
      output: 'Relevant text snippets, table metrics, and file references'
    }
  },
  {
    name: 'mcp_web_grounding',
    description: 'Searches the web via Google Search Grounding for current arXiv papers, SOTA benchmarks, and library docs.',
    category: 'Web Intelligence',
    callCount: 18,
    status: 'idle',
    schema: {
      inputs: ['searchQuery: string'],
      output: 'Live web search grounding chunks with source URLs'
    }
  },
  {
    name: 'mcp_spec_analyzer',
    description: 'Calculates VRAM memory budgets, FLOPs throughput, tensor parallelism latency, and GPU cluster sizing.',
    category: 'Compute & Spec',
    callCount: 12,
    status: 'idle',
    schema: {
      inputs: ['batchSize: number', 'seqLen: number', 'paramCountBillion: number', 'precision: string'],
      output: 'Memory breakdown (KV cache, weights, activation), throughput, and latency estimates'
    }
  },
  {
    name: 'mcp_hypothesis_tester',
    description: 'Runs formal mathematical, algorithmic, and logic validation on claims made in documents or by agents.',
    category: 'Logic Verification',
    callCount: 9,
    status: 'idle',
    schema: {
      inputs: ['hypothesis: string', 'givenFacts: string[]'],
      output: 'Verification matrix, contradiction alerts, confidence score, and mathematical proof/refutation'
    }
  },
  {
    name: 'mcp_synthesis_engine',
    description: 'Compiles multi-agent outputs, code snippets, and citations into a unified technical report markdown structure.',
    category: 'Report Engine',
    callCount: 15,
    status: 'idle',
    schema: {
      inputs: ['sections: Array<{title: string, content: string}>', 'citations: string[]'],
      output: 'Rendered report tree with executive summary and diagrams'
    }
  }
];

export class ToolService {
  private readonly displayTools: MCPTool[] = DISPLAY_TOOLS.map(t => ({ ...t }));

  constructor(
    private readonly registry: ToolRegistry,
    private readonly executor: ToolExecutor,
    private readonly documentService: DocumentService,
    private readonly llmProvider: LLMProvider,
    private readonly logger: LoggerLike = noopLogger,
    private readonly searchIndexService?: SearchIndexService
  ) {}

  listDisplayTools(): readonly MCPTool[] {
    return this.displayTools;
  }

  findDisplayTool(name: string): MCPTool | undefined {
    return this.displayTools.find(t => t.name === name);
  }

  toFunctionDeclarations(names?: readonly string[]): FunctionDeclaration[] {
    return this.registry.toFunctionDeclarations(names);
  }

  /** Pure execution with no display-metadata side effects; used by the research pipeline. */
  async run(toolName: string, args: unknown): Promise<Result<unknown, ToolError | ValidationError>> {
    return withTiming(this.logger, { event: 'tool_execute', tool: toolName }, () =>
      this.executor.run(toolName, args, {
        documents: this.documentService.list(),
        llmProvider: this.llmProvider,
        searchIndexService: this.searchIndexService
      })
    );
  }

  /** Execution that also tracks the display metadata (callCount/status) shown by GET /api/mcp/tools. */
  async executeDirect(toolName: string, args: unknown): Promise<Result<unknown, ToolError | ValidationError>> {
    const displayTool = this.findDisplayTool(toolName);
    if (displayTool) {
      displayTool.callCount++;
      displayTool.status = 'busy';
    }

    const result = await this.run(toolName, args);

    if (displayTool) {
      displayTool.status = 'idle';
    }

    return result;
  }
}
