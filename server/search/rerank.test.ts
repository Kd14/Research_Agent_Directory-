import { describe, expect, it, vi } from 'vitest';
import { LLMReranker } from './rerank';
import { Ok, Err } from '../result';
import { ProviderError } from '../errors/AppError';

describe('LLMReranker', () => {
  it('returns an empty array for no candidates', async () => {
    const reranker = new LLMReranker({ generate: vi.fn() } as any);
    expect(await reranker.rerank('q', [])).toEqual([]);
  });

  it('reorders candidates per the model response', async () => {
    const generate = vi.fn().mockResolvedValue(Ok({ text: JSON.stringify(['b', 'a']) }));
    const reranker = new LLMReranker({ generate } as any);

    const result = await reranker.rerank('q', [
      { chunkId: 'a', chunkText: 'text a' },
      { chunkId: 'b', chunkText: 'text b' }
    ]);

    expect(result).toEqual(['b', 'a']);
  });

  it('falls back to original order when the provider fails', async () => {
    const generate = vi.fn().mockResolvedValue(Err(new ProviderError('down', 'gemini')));
    const reranker = new LLMReranker({ generate } as any);

    const result = await reranker.rerank('q', [
      { chunkId: 'a', chunkText: 'text a' },
      { chunkId: 'b', chunkText: 'text b' }
    ]);

    expect(result).toEqual(['a', 'b']);
  });

  it('appends candidates the model omitted, preserving their original relative order', async () => {
    const generate = vi.fn().mockResolvedValue(Ok({ text: JSON.stringify(['b']) }));
    const reranker = new LLMReranker({ generate } as any);

    const result = await reranker.rerank('q', [
      { chunkId: 'a', chunkText: 'text a' },
      { chunkId: 'b', chunkText: 'text b' },
      { chunkId: 'c', chunkText: 'text c' }
    ]);

    expect(result).toEqual(['b', 'a', 'c']);
  });

  it('falls back to original order on malformed JSON', async () => {
    const generate = vi.fn().mockResolvedValue(Ok({ text: 'not json' }));
    const reranker = new LLMReranker({ generate } as any);

    const result = await reranker.rerank('q', [{ chunkId: 'a', chunkText: 'x' }]);
    expect(result).toEqual(['a']);
  });
});
