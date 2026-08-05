import type { FunctionDeclaration } from '@google/genai';
import type { CitationRecord, TechDocument } from '../../client/types';
import { ToolError, type ValidationError } from '../errors/AppError';
import { Err, type Result } from '../result';
import type { LLMProvider } from '../llm/LLMProvider';
import type { SearchIndexService } from '../search/SearchIndexService';

export interface ToolExample {
  readonly input: Record<string, unknown>;
  readonly output: unknown;
  readonly description: string;
}

/** A tool reports a piece of evidence it produced; ExecutionService fills in id/createdAt/consumedBy. */
export type RecordCitationInput = Omit<CitationRecord, 'id' | 'createdAt' | 'consumedBy'>;

export interface ToolExecutionContext {
  readonly documents: readonly TechDocument[];
  readonly llmProvider: LLMProvider;
  readonly searchIndexService?: SearchIndexService;
  /** Best-effort citation-graph capture (server/services/ExecutionService.ts) - optional so tools
   *  invoked outside the research pipeline (e.g. the MCP Tools Inspector's direct-execute path) don't
   *  need a no-op stub. */
  readonly recordCitation?: (record: RecordCitationInput) => void;
}

export interface ToolDefinition<TArgs = Record<string, unknown>, TResult = unknown> {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  /** JSON-schema-ish shape, reused directly as a Gemini FunctionDeclaration's `parameters`. */
  readonly parameters: Record<string, unknown>;
  readonly examples: readonly ToolExample[];
  /** False for tools with no real Gemini function declaration (e.g. report-only stubs). Defaults to true. */
  readonly supportsFunctionCalling?: boolean;
  /** False for tools whose result shouldn't be memoized by MemoryService (non-idempotent-in-spirit
   *  report generators, or anything whose output should always reflect the latest input state even
   *  when called with identical-looking args). Defaults to true. */
  readonly cacheable?: boolean;
  validate(args: unknown): Result<TArgs, ValidationError>;
  execute(args: TArgs, ctx: ToolExecutionContext): Promise<Result<TResult, ToolError>>;
}

// The registry is intentionally heterogeneous - each tool has its own TArgs/TResult shape - so it
// stores definitions as `ToolDefinition<any, any>` internally. Callers only ever go through
// validate()/execute() by name, never touching a stored definition's generic parameters directly.
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<any, any>>();

  register<TArgs, TResult>(tool: ToolDefinition<TArgs, TResult>): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(name);
  }

  list(): readonly ToolDefinition<any, any>[] {
    return Array.from(this.tools.values());
  }

  toFunctionDeclarations(names?: readonly string[]): FunctionDeclaration[] {
    const source = names
      ? names.map(n => this.tools.get(n)).filter((t): t is ToolDefinition<any, any> => Boolean(t))
      : this.list();

    return source
      .filter(t => t.supportsFunctionCalling !== false)
      .map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }));
  }
}

export class ToolExecutor {
  constructor(private readonly registry: ToolRegistry) {}

  async run(
    name: string,
    rawArgs: unknown,
    ctx: ToolExecutionContext
  ): Promise<Result<unknown, ToolError | ValidationError>> {
    const tool = this.registry.get(name);
    if (!tool) {
      return Err(new ToolError(`Tool ${name} not found in registry`, name));
    }

    const validated = tool.validate(rawArgs);
    if (!validated.ok) {
      return validated;
    }

    return tool.execute(validated.value, ctx);
  }
}
