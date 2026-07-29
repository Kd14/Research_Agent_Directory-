import { describe, expect, it, vi } from 'vitest';
import hypothesisTesterTool from './hypothesisTester.tool';
import { Ok, Err } from '../result';
import { ProviderError } from '../errors/AppError';
import type { ToolExecutionContext } from './types';

describe('hypothesisTesterTool.validate', () => {
  it('rejects a non-array givenFacts', () => {
    const result = hypothesisTesterTool.validate({ hypothesis: 'x', givenFacts: 'not-an-array' });
    expect(result.ok).toBe(false);
  });

  it('defaults missing fields', () => {
    const result = hypothesisTesterTool.validate({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hypothesis).toBe('');
      expect(result.value.givenFacts).toEqual([]);
    }
  });
});

describe('hypothesisTesterTool.execute', () => {
  it('parses a verified JSON response', async () => {
    const generate = vi.fn().mockResolvedValue(Ok({
      text: JSON.stringify({ status: 'VERIFIED', confidenceScore: 0.9, proofSummary: 'ok', riskFactors: [] })
    }));
    const ctx = { documents: [], llmProvider: { generate } } as unknown as ToolExecutionContext;

    const result = await hypothesisTesterTool.execute({ hypothesis: 'x', givenFacts: [] }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { status: string };
      expect(value.status).toBe('VERIFIED');
    }
  });

  it('degrades to INSUFFICIENT_EVIDENCE when the provider fails', async () => {
    const generate = vi.fn().mockResolvedValue(Err(new ProviderError('down', 'gemini')));
    const ctx = { documents: [], llmProvider: { generate } } as unknown as ToolExecutionContext;

    const result = await hypothesisTesterTool.execute({ hypothesis: 'x', givenFacts: [] }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { status: string };
      expect(value.status).toBe('INSUFFICIENT_EVIDENCE');
    }
  });
});
