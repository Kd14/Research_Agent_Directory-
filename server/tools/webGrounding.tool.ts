import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { ToolDefinition, ToolExecutionContext } from './types';

interface WebGroundingArgs {
  readonly searchQuery: string;
}

const webGroundingTool: ToolDefinition<WebGroundingArgs, unknown> = {
  name: 'mcp_web_grounding',
  description: 'Searches the live web for current research, benchmarks, or documentation.',
  category: 'Web Intelligence',
  parameters: {
    type: Type.OBJECT,
    properties: {
      searchQuery: { type: Type.STRING, description: 'The web search query.' }
    },
    required: ['searchQuery']
  },
  examples: [
    {
      input: { searchQuery: 'transformer scaling laws' },
      output: { searchQuery: 'transformer scaling laws', summary: '...', sources: [] },
      description: 'Search the live web for current research on a topic.'
    }
  ],

  validate(args: unknown): Result<WebGroundingArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (a.searchQuery !== undefined && typeof a.searchQuery !== 'string') {
      return Err(new ValidationError('mcp_web_grounding: "searchQuery" must be a string if provided'));
    }
    return Ok({
      searchQuery: typeof a.searchQuery === 'string' && a.searchQuery
        ? a.searchQuery
        : 'Large Language Model Context Window Scaling'
    });
  },

  async execute(args: WebGroundingArgs, ctx: ToolExecutionContext): Promise<Result<unknown, ToolError>> {
    const { searchQuery } = args;
    const result = await ctx.llmProvider.generate(
      `Provide 3 key research points or citations for: ${searchQuery}`,
      { enableWebGrounding: true }
    );

    if (!result.ok) {
      console.error('mcp_web_grounding error:', result.error);
      return Ok({
        searchQuery,
        summary: `Web grounding request failed (${result.error.message || 'unknown error'}). No live search results available.`,
        sources: [],
        error: true
      });
    }

    return Ok({
      searchQuery,
      summary: result.value.text,
      sources: (result.value.groundingSources || []).map(s => ({ title: s.title, url: s.url }))
    });
  }
};

export default webGroundingTool;
