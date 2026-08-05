import { Type } from '@google/genai';
import { ReflectionError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { LLMProvider, StandbyEvent } from '../llm/LLMProvider';
import { loadPrompt, renderPrompt } from '../prompts/PromptRenderer';

export interface ReflectionStepSuggestion {
  readonly title: string;
  readonly instruction: string;
  readonly requiredTools: string[];
}

export interface ReflectionResult {
  readonly missingEvidence: string[];
  readonly weakArguments: string[];
  readonly conflictingSources: string[];
  readonly hallucinationRiskScore: number;
  readonly confidenceScore: number;
  readonly verdict: 'sufficient' | 'needs_iteration';
  readonly notes: string;
  readonly additionalStepsNeeded: ReflectionStepSuggestion[];
}

export interface CritiqueInput {
  readonly userPrompt: string;
  readonly aggregatedAgentFindings: string;
  readonly docTitles?: string;
}

export interface ReviewInput {
  readonly userPrompt: string;
  readonly finalReport: string;
  readonly citationSummary?: string;
}

const REFLECTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    missingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
    weakArguments: { type: Type.ARRAY, items: { type: Type.STRING } },
    conflictingSources: { type: Type.ARRAY, items: { type: Type.STRING } },
    hallucinationRiskScore: { type: Type.NUMBER },
    confidenceScore: { type: Type.NUMBER },
    verdict: { type: Type.STRING },
    notes: { type: Type.STRING },
    additionalStepsNeeded: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          instruction: { type: Type.STRING },
          requiredTools: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['title', 'instruction', 'requiredTools']
      }
    }
  },
  required: ['missingEvidence', 'weakArguments', 'conflictingSources', 'hallucinationRiskScore', 'confidenceScore', 'verdict', 'notes']
};

function parseReflectionResult(text: string): ReflectionResult {
  const parsed = JSON.parse(text.trim());
  return {
    missingEvidence: parsed.missingEvidence || [],
    weakArguments: parsed.weakArguments || [],
    conflictingSources: parsed.conflictingSources || [],
    hallucinationRiskScore: typeof parsed.hallucinationRiskScore === 'number' ? parsed.hallucinationRiskScore : 0,
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 1,
    verdict: parsed.verdict === 'needs_iteration' ? 'needs_iteration' : 'sufficient',
    notes: parsed.notes || '',
    additionalStepsNeeded: parsed.additionalStepsNeeded || []
  };
}

// The Critic (pre-synthesis) and Reviewer (post-synthesis) pipeline stages: both are single
// structured-JSON LLM judge calls over already-gathered text, with no tool access of their own -
// the actual iteration control flow (bounded re-running of additionalStepsNeeded) lives in
// ReflectionLoopRunner, which is the only caller of these two methods.
export class ReflectionService {
  constructor(private readonly llmProvider: LLMProvider) {}

  async critique(input: CritiqueInput, onStandby?: (event: StandbyEvent) => void): Promise<Result<ReflectionResult, ReflectionError>> {
    const prompt = renderPrompt(loadPrompt('critic'), {
      userPrompt: input.userPrompt,
      aggregatedAgentFindings: input.aggregatedAgentFindings,
      docTitles: input.docTitles || 'No specific documents selected.'
    });

    const result = await this.llmProvider.generate(prompt, { responseSchema: REFLECTION_RESPONSE_SCHEMA, onStandby });
    if (!result.ok) {
      return Err(new ReflectionError(result.error.message, result.error));
    }

    try {
      return Ok(parseReflectionResult(result.value.text ?? ''));
    } catch (err) {
      return Err(new ReflectionError(err instanceof Error ? err.message : 'Failed to parse critique result', err));
    }
  }

  async review(input: ReviewInput, onStandby?: (event: StandbyEvent) => void): Promise<Result<ReflectionResult, ReflectionError>> {
    const prompt = renderPrompt(loadPrompt('reflection'), {
      userPrompt: input.userPrompt,
      finalReport: input.finalReport,
      citationSummary: input.citationSummary || 'No citation graph recorded for this run.'
    });

    const result = await this.llmProvider.generate(prompt, { responseSchema: REFLECTION_RESPONSE_SCHEMA, onStandby });
    if (!result.ok) {
      return Err(new ReflectionError(result.error.message, result.error));
    }

    try {
      return Ok(parseReflectionResult(result.value.text ?? ''));
    } catch (err) {
      return Err(new ReflectionError(err instanceof Error ? err.message : 'Failed to parse review result', err));
    }
  }
}
