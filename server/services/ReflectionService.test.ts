import { describe, expect, it } from 'vitest';
import type { ProviderError } from '../errors/AppError';
import type { GenerateResult, LLMProvider, StreamChunk } from '../llm/LLMProvider';
import { Ok, type Result } from '../result';
import { ReflectionService } from './ReflectionService';

class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';
  constructor(private readonly response: GenerateResult) {}

  async generate(): Promise<Result<GenerateResult, ProviderError>> {
    return Ok(this.response);
  }
  async *stream(): AsyncIterable<StreamChunk> {
    yield { type: 'done' };
  }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

describe('ReflectionService.critique', () => {
  it('parses a "sufficient" verdict with defaults for omitted optional fields', async () => {
    const service = new ReflectionService(new FakeLLMProvider({
      text: JSON.stringify({
        missingEvidence: [],
        weakArguments: [],
        conflictingSources: [],
        hallucinationRiskScore: 0.1,
        confidenceScore: 0.9,
        verdict: 'sufficient',
        notes: 'Findings look solid.'
      })
    }));

    const result = await service.critique({ userPrompt: 'Investigate X', aggregatedAgentFindings: 'Step 1: found Y.' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.verdict).toBe('sufficient');
      expect(result.value.additionalStepsNeeded).toEqual([]);
      expect(result.value.confidenceScore).toBe(0.9);
    }
  });

  it('parses a "needs_iteration" verdict with suggested additional steps', async () => {
    const service = new ReflectionService(new FakeLLMProvider({
      text: JSON.stringify({
        missingEvidence: ['No benchmark numbers gathered'],
        weakArguments: [],
        conflictingSources: [],
        hallucinationRiskScore: 0.4,
        confidenceScore: 0.3,
        verdict: 'needs_iteration',
        notes: 'Missing quantitative evidence.',
        additionalStepsNeeded: [
          { title: 'Gather benchmarks', instruction: 'Find throughput benchmarks', requiredTools: ['mcp_doc_search'] }
        ]
      })
    }));

    const result = await service.critique({ userPrompt: 'Investigate X', aggregatedAgentFindings: 'Step 1: found Y.' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.verdict).toBe('needs_iteration');
      expect(result.value.additionalStepsNeeded).toHaveLength(1);
      expect(result.value.additionalStepsNeeded[0].title).toBe('Gather benchmarks');
    }
  });

  it('returns a ReflectionError when the provider response is not valid JSON', async () => {
    const service = new ReflectionService(new FakeLLMProvider({ text: 'not valid json' }));

    const result = await service.critique({ userPrompt: 'Investigate X', aggregatedAgentFindings: 'Step 1: found Y.' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('REFLECTION_ERROR');
    }
  });
});

describe('ReflectionService.review', () => {
  it('parses a post-synthesis review result', async () => {
    const service = new ReflectionService(new FakeLLMProvider({
      text: JSON.stringify({
        missingEvidence: [],
        weakArguments: ['Overstates confidence in section 3'],
        conflictingSources: [],
        hallucinationRiskScore: 0.2,
        confidenceScore: 0.75,
        verdict: 'sufficient',
        notes: 'Ready to publish with minor caveats.'
      })
    }));

    const result = await service.review({ userPrompt: 'Investigate X', finalReport: '# Report\n...' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.verdict).toBe('sufficient');
      expect(result.value.weakArguments).toHaveLength(1);
    }
  });
});
