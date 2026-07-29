import { describe, expect, it, vi } from 'vitest';
import webGroundingTool from './webGrounding.tool';
import { Ok, Err } from '../result';
import { ProviderError } from '../errors/AppError';
import type { ToolExecutionContext } from './types';

describe('webGroundingTool.validate', () => {
  it('rejects a non-string searchQuery', () => {
    const result = webGroundingTool.validate({ searchQuery: 42 });
    expect(result.ok).toBe(false);
  });

  it('defaults a missing searchQuery', () => {
    const result = webGroundingTool.validate({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.searchQuery).toBe('Large Language Model Context Window Scaling');
    }
  });
});

describe('webGroundingTool.execute', () => {
  it('returns a summary and sources on success', async () => {
    const generate = vi.fn().mockResolvedValue(Ok({
      text: 'Three key points',
      groundingSources: [{ title: 'Paper A', url: 'https://example.com' }]
    }));
    const ctx = { documents: [], llmProvider: { generate } } as unknown as ToolExecutionContext;

    const result = await webGroundingTool.execute({ searchQuery: 'scaling laws' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { summary: string; sources: unknown[] };
      expect(value.summary).toBe('Three key points');
      expect(value.sources).toEqual([{ title: 'Paper A', url: 'https://example.com' }]);
    }
  });

  it('degrades gracefully when the provider fails', async () => {
    const generate = vi.fn().mockResolvedValue(Err(new ProviderError('network down', 'gemini')));
    const ctx = { documents: [], llmProvider: { generate } } as unknown as ToolExecutionContext;

    const result = await webGroundingTool.execute({ searchQuery: 'scaling laws' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { error: boolean; sources: unknown[] };
      expect(value.error).toBe(true);
      expect(value.sources).toEqual([]);
    }
  });
});
