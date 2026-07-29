import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { ToolDefinition, ToolExecutionContext } from './types';

interface DocSearchArgs {
  readonly query: string;
  readonly docIds?: readonly string[];
  readonly topK: number;
}

const docSearchTool: ToolDefinition<DocSearchArgs, unknown> = {
  name: 'mcp_doc_search',
  description: 'Searches the uploaded technical documents for passages relevant to a query.',
  category: 'Document Storage',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Keywords or question to search for in the documents.' },
      topK: { type: Type.INTEGER, description: 'Maximum number of matching documents to return.' }
    },
    required: ['query']
  },
  examples: [
    {
      input: { query: 'insulin signaling pathways', topK: 5 },
      output: { query: 'insulin signaling pathways', matchesFound: 1, results: [] },
      description: 'Search the uploaded documents for passages mentioning insulin signaling.'
    }
  ],

  validate(args: unknown): Result<DocSearchArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (a.query !== undefined && typeof a.query !== 'string') {
      return Err(new ValidationError('mcp_doc_search: "query" must be a string if provided'));
    }
    if (a.docIds !== undefined && !Array.isArray(a.docIds)) {
      return Err(new ValidationError('mcp_doc_search: "docIds" must be an array if provided'));
    }
    return Ok({
      query: typeof a.query === 'string' ? a.query : '',
      docIds: Array.isArray(a.docIds) ? (a.docIds as string[]) : undefined,
      topK: Number(a.topK) || 5
    });
  },

  async execute(args: DocSearchArgs, ctx: ToolExecutionContext): Promise<Result<unknown, ToolError>> {
    if (!ctx.searchIndexService) {
      return Ok({ query: args.query, matchesFound: 0, results: [] });
    }

    const results = await ctx.searchIndexService.search(args.query, { docIds: args.docIds, topK: args.topK });
    return Ok({ query: args.query, matchesFound: results.length, results });
  }
};

export default docSearchTool;
