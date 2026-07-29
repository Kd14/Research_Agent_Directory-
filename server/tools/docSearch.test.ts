import { describe, expect, it, vi } from 'vitest';
import docSearchTool from './docSearch.tool';
import type { ToolExecutionContext } from './types';

const ctx = { documents: [], llmProvider: {} as any } as ToolExecutionContext;

describe('docSearchTool.validate', () => {
  it('rejects a non-string query', () => {
    const result = docSearchTool.validate({ query: 123 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-array docIds', () => {
    const result = docSearchTool.validate({ query: 'x', docIds: 'not-an-array' });
    expect(result.ok).toBe(false);
  });

  it('defaults missing fields', () => {
    const result = docSearchTool.validate({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.query).toBe('');
      expect(result.value.topK).toBe(5);
    }
  });
});

describe('docSearchTool.execute', () => {
  it('delegates to the search index service and reports matchesFound', async () => {
    const searchResults = [
      { docId: 'doc1', docTitle: 'Insulin Paper', chunkId: 'doc1#0', chunkText: 'Insulin regulates glucose.', offsetStart: 0, offsetEnd: 27, bm25Score: 1, embeddingScore: 0, finalScore: 1 }
    ];
    const searchIndexService = { search: vi.fn().mockResolvedValue(searchResults) };

    const result = await docSearchTool.execute(
      { query: 'insulin glucose', docIds: undefined, topK: 5 },
      { ...ctx, searchIndexService: searchIndexService as any }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { matchesFound: number; results: unknown[] };
      expect(value.matchesFound).toBe(1);
      expect(value.results).toEqual(searchResults);
    }
    expect(searchIndexService.search).toHaveBeenCalledWith('insulin glucose', { docIds: undefined, topK: 5 });
  });

  it('returns empty results gracefully when no search index service is configured', async () => {
    const result = await docSearchTool.execute({ query: 'x', docIds: undefined, topK: 5 }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { matchesFound: number };
      expect(value.matchesFound).toBe(0);
    }
  });
});
