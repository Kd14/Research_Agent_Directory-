import { Type } from '@google/genai';
import { ToolError } from '../errors/AppError';
import { Ok, type Result } from '../result';
import type { ToolDefinition } from './types';

interface SynthesisEngineArgs {
  readonly sections?: readonly { title: string; content: string }[];
  readonly citations?: readonly string[];
}

// No real implementation exists yet - this mirrors the pre-refactor stub fallback exactly.
// Real synthesis is handled separately by ResearchPipeline's streamed synthesis (POST /api/research/run|resume).
const synthesisEngineTool: ToolDefinition<SynthesisEngineArgs, unknown> = {
  name: 'mcp_synthesis_engine',
  description: 'Compiles multi-agent outputs, code snippets, and citations into a unified technical report markdown structure.',
  category: 'Report Engine',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          }
        }
      },
      citations: { type: Type.ARRAY, items: { type: Type.STRING } }
    }
  },
  // Never had a real Gemini function declaration pre-refactor; not offered for function-calling.
  supportsFunctionCalling: false,
  cacheable: false,
  examples: [
    {
      input: { sections: [], citations: [] },
      output: { status: 'executed', tool: 'mcp_synthesis_engine', args: {} },
      description: 'Stub tool with no real implementation; real synthesis happens via ResearchPipeline.'
    }
  ],

  validate(args: unknown): Result<SynthesisEngineArgs, never> {
    return Ok((args ?? {}) as SynthesisEngineArgs);
  },

  async execute(args: SynthesisEngineArgs): Promise<Result<unknown, ToolError>> {
    return Ok({ status: 'executed', tool: 'mcp_synthesis_engine', args });
  }
};

export default synthesisEngineTool;
