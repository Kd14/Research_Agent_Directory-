import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { ToolDefinition, ToolExecutionContext } from './types';

interface HypothesisTesterArgs {
  readonly hypothesis: string;
  readonly givenFacts: readonly string[];
}

const hypothesisTesterTool: ToolDefinition<HypothesisTesterArgs, unknown> = {
  name: 'mcp_hypothesis_tester',
  description: 'Runs formal logical/mathematical verification of a claim against a set of given facts.',
  category: 'Logic Verification',
  parameters: {
    type: Type.OBJECT,
    properties: {
      hypothesis: { type: Type.STRING, description: 'The claim to verify.' },
      givenFacts: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Known facts to verify the hypothesis against.' }
    },
    required: ['hypothesis']
  },
  examples: [
    {
      input: { hypothesis: 'Larger batch sizes always reduce training time', givenFacts: ['Gradient noise decreases with batch size'] },
      output: { status: 'INSUFFICIENT_EVIDENCE', confidenceScore: 0.5 },
      description: 'Verify a claim against a set of known facts.'
    }
  ],

  validate(args: unknown): Result<HypothesisTesterArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (a.hypothesis !== undefined && typeof a.hypothesis !== 'string') {
      return Err(new ValidationError('mcp_hypothesis_tester: "hypothesis" must be a string if provided'));
    }
    if (a.givenFacts !== undefined && !Array.isArray(a.givenFacts)) {
      return Err(new ValidationError('mcp_hypothesis_tester: "givenFacts" must be an array if provided'));
    }
    return Ok({
      hypothesis: typeof a.hypothesis === 'string' ? a.hypothesis : '',
      givenFacts: Array.isArray(a.givenFacts) ? (a.givenFacts as string[]) : []
    });
  },

  async execute(args: HypothesisTesterArgs, ctx: ToolExecutionContext): Promise<Result<unknown, ToolError>> {
    const { hypothesis, givenFacts } = args;

    const prompt = `You are a rigorous logic and mathematics verification engine embedded in an MCP tool server.

Evaluate the following hypothesis strictly against the given facts. Do not assume anything not stated or directly derivable.

Hypothesis: "${hypothesis}"

Given Facts:
${givenFacts.length ? givenFacts.map(f => `- ${f}`).join('\n') : 'None provided - evaluate using only the hypothesis text itself.'}

Return a JSON object with:
- status: one of "VERIFIED", "VERIFIED_WITH_BOUNDS", "REFUTED", "INSUFFICIENT_EVIDENCE"
- confidenceScore: number 0 to 1 reflecting evidentiary strength, not fluency
- proofSummary: concise explanation of the reasoning/derivation that led to the verdict
- riskFactors: array of specific conditions or edge cases that could invalidate the hypothesis`;

    try {
      const result = await ctx.llmProvider.generate(prompt, {
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            proofSummary: { type: Type.STRING },
            riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['status', 'confidenceScore', 'proofSummary', 'riskFactors']
        }
      });
      if (!result.ok) throw result.error;

      const parsed = JSON.parse((result.value.text ?? '').trim());
      return Ok({ hypothesis, ...parsed });
    } catch (err: any) {
      console.error('mcp_hypothesis_tester error:', err);
      return Ok({
        hypothesis,
        status: 'INSUFFICIENT_EVIDENCE',
        confidenceScore: 0,
        proofSummary: `Verification failed due to a tool error (${err.message || 'unknown error'}); no verdict could be produced.`,
        riskFactors: ['Verification engine unavailable']
      });
    }
  }
};

export default hypothesisTesterTool;
