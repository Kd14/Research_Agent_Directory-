import type { FunctionDeclaration } from '@google/genai';
import type { MCPTool } from '../../client/types';
import type { ToolError, ValidationError } from '../errors/AppError';
import { noopLogger, withTiming, type LoggerLike } from '../observability/logger';
import { Ok, type Result } from '../result';
import type { LLMProvider } from '../llm/LLMProvider';
import type { SearchIndexService } from '../search/SearchIndexService';
import type { ToolExecutor, ToolRegistry } from '../tools';
import type { RecordCitationInput } from '../tools/types';
import type { DocumentService } from './DocumentService';
import type { MemoryService } from './MemoryService';

interface CachedToolPayload {
  readonly result: unknown;
  readonly citations: RecordCitationInput[];
}

const DISPLAY_TOOLS: MCPTool[] = [
  {
    name: 'mcp_doc_search',
    description: 'Queries the user\'s uploaded documents via hybrid semantic/keyword retrieval, whatever their subject matter.',
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
    description: 'Searches the live web via Google Search Grounding for current sources, reporting, research, and documentation on any topic.',
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
  },
  {
    name: 'mcp_pdf_report_generator',
    description: 'Converts the finished markdown report into a polished, paginated PDF with mermaid diagrams rendered as vector graphics via headless Chromium.',
    category: 'Report Engine',
    callCount: 0,
    status: 'idle',
    schema: {
      inputs: ['markdown: string', 'title?: string'],
      output: 'PDF binary document with rendered diagrams and print-ready layout'
    }
  },
  {
    name: 'mcp_document_pdf_converter',
    description: 'Standalone PDF conversion for any markdown document: renders LaTeX math via KaTeX and converts plain-text/ASCII diagram blocks to real SVG via one LLM call per diagram. Independent of the research pipeline.',
    category: 'Report Engine',
    callCount: 0,
    status: 'idle',
    schema: {
      inputs: ['markdown: string', 'title?: string', 'renderDiagramsWithLlm?: boolean'],
      output: 'PDF binary document with rendered math, mermaid diagrams, and LLM-converted SVG diagrams'
    }
  },
  {
    name: 'mcp_html_report_exporter',
    description: 'Converts a finished markdown report into a self-contained standalone HTML document (math, mermaid, and diagrams inlined) - viewable offline with no server round-trip.',
    category: 'Report Engine',
    callCount: 0,
    status: 'idle',
    schema: {
      inputs: ['markdown: string', 'title?: string', 'renderDiagramsWithLlm?: boolean'],
      output: 'Self-contained standalone HTML document'
    }
  },
  {
    name: 'mcp_docx_report_generator',
    description: 'Converts a finished markdown report into an editable DOCX document (headings, prose, lists, tables, blockquotes) for hand-editing in Word or Google Docs.',
    category: 'Report Engine',
    callCount: 0,
    status: 'idle',
    schema: {
      inputs: ['markdown: string', 'title?: string'],
      output: 'DOCX binary document'
    }
  },
  {
    name: 'mcp_presentation_outline_generator',
    description: 'Converts a finished markdown report into a presentation outline (PPTX) - a title slide plus one content slide per top-level section, with prose and lists flattened into bullets.',
    category: 'Report Engine',
    callCount: 0,
    status: 'idle',
    schema: {
      inputs: ['markdown: string', 'title?: string'],
      output: 'PPTX binary presentation outline'
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
    private readonly searchIndexService?: SearchIndexService,
    private readonly memoryService?: MemoryService
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

  /** Pure execution with no display-metadata side effects; used by the research pipeline. A
   *  cacheable tool's result (and any citations it recorded) is memoized via MemoryService so an
   *  identical call later in the same reflection loop doesn't repeat the real work - citations are
   *  replayed on a cache hit so the citation graph stays correct even without re-executing. */
  async run(
    toolName: string,
    args: unknown,
    recordCitation?: (record: RecordCitationInput) => void
  ): Promise<Result<unknown, ToolError | ValidationError>> {
    const tool = this.registry.get(toolName);
    const cacheable = Boolean(this.memoryService) && tool?.cacheable !== false;

    if (cacheable) {
      const cached = this.memoryService!.getCachedToolResult(toolName, args) as CachedToolPayload | undefined;
      if (cached) {
        this.logger.log({ level: 'info', event: 'tool_cache_hit', tool: toolName });
        cached.citations.forEach(record => recordCitation?.(record));
        return Ok(cached.result);
      }
    }

    const capturedCitations: RecordCitationInput[] = [];
    const result = await withTiming(this.logger, { event: 'tool_execute', tool: toolName }, () =>
      this.executor.run(toolName, args, {
        documents: this.documentService.list(),
        llmProvider: this.llmProvider,
        searchIndexService: this.searchIndexService,
        recordCitation: record => {
          capturedCitations.push(record);
          recordCitation?.(record);
        }
      })
    );

    if (result.ok && cacheable) {
      this.memoryService!.setCachedToolResult(toolName, args, { result: result.value, citations: capturedCitations });
    }

    return result;
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
