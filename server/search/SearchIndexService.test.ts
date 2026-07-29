import { describe, expect, it, vi } from 'vitest';
import { SearchIndexService } from './SearchIndexService';
import type { AppConfig } from '../config';
import type { EmbeddingProvider } from './embeddings';

const testConfig = {
  search: { rerankEnabled: false, bm25Weight: 0.5, embeddingWeight: 0.5 }
} as unknown as AppConfig;

function makeDocumentService(docs: any[]) {
  return { list: () => docs } as any;
}

function makeEmbeddingCache() {
  const store = new Map<string, number[]>();
  return {
    get: (chunkId: string, hash: string) => store.get(`${chunkId}::${hash}`),
    set: (chunkId: string, hash: string, vector: number[]) => store.set(`${chunkId}::${hash}`, vector)
  } as any;
}

describe('SearchIndexService (BM25-only, no embedding provider)', () => {
  it('returns keyword-matched results without making any network call', async () => {
    const documents = [
      { id: 'doc1', title: 'Insulin Paper', contentHash: 'h1', content: 'Insulin regulates blood glucose levels in the human body.' },
      { id: 'doc2', title: 'Unrelated Paper', contentHash: 'h2', content: 'GPU clusters use NVLink for high bandwidth interconnects.' }
    ];
    const service = new SearchIndexService(testConfig, makeDocumentService(documents), undefined, undefined, undefined);

    const results = await service.search('insulin glucose');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].docId).toBe('doc1');
    expect(results.every(r => r.embeddingScore === 0)).toBe(true);
  });

  it('returns correct chunkId/offsets for source attribution', async () => {
    const documents = [{ id: 'doc1', title: 'Doc', contentHash: 'h1', content: 'Insulin regulates glucose.' }];
    const service = new SearchIndexService(testConfig, makeDocumentService(documents), undefined, undefined, undefined);

    const results = await service.search('insulin');
    expect(results[0].chunkId).toBe('doc1#0');
    expect(results[0].chunkText).toBe(documents[0].content.slice(results[0].offsetStart, results[0].offsetEnd));
  });

  it('scopes results to the provided docIds', async () => {
    const documents = [
      { id: 'doc1', title: 'A', contentHash: 'h1', content: 'insulin glucose metabolism' },
      { id: 'doc2', title: 'B', contentHash: 'h2', content: 'insulin glucose regulation' }
    ];
    const service = new SearchIndexService(testConfig, makeDocumentService(documents), undefined, undefined, undefined);

    const results = await service.search('insulin', { docIds: ['doc2'] });
    expect(results.every(r => r.docId === 'doc2')).toBe(true);
  });

  it('returns an empty array when there are no documents', async () => {
    const service = new SearchIndexService(testConfig, makeDocumentService([]), undefined, undefined, undefined);
    expect(await service.search('anything')).toEqual([]);
  });
});

describe('SearchIndexService (with embedding provider)', () => {
  it('surfaces a paraphrased query match via embeddings even with no literal keyword overlap', async () => {
    const documents = [
      { id: 'doc1', title: 'Insulin Paper', contentHash: 'h1', content: 'Insulin regulates blood glucose levels.' },
      { id: 'doc2', title: 'Unrelated', contentHash: 'h2', content: 'GPU clusters use NVLink interconnects.' }
    ];

    // Fake embedding space: doc1's vector is close to the paraphrased query vector; doc2's is far.
    const embeddingProvider: EmbeddingProvider = {
      embed: vi.fn(async (texts: readonly string[]) =>
        texts.map(t => {
          if (t.includes('pancreatic hormone that lowers blood sugar')) return [1, 0, 0];
          if (t.includes('Insulin regulates blood glucose')) return [0.95, 0.1, 0];
          if (t.includes('GPU clusters')) return [0, 0, 1];
          return [0, 1, 0];
        })
      )
    };

    const service = new SearchIndexService(
      testConfig,
      makeDocumentService(documents),
      embeddingProvider,
      makeEmbeddingCache(),
      undefined
    );

    // No literal keyword overlap with the document text - only embeddings can surface doc1.
    const results = await service.search('pancreatic hormone that lowers blood sugar');

    expect(results[0]?.docId).toBe('doc1');
    expect(results[0]?.embeddingScore).toBeGreaterThan(0);
  });

  it('falls back to BM25-only when the embedding call fails', async () => {
    const documents = [{ id: 'doc1', title: 'Doc', contentHash: 'h1', content: 'insulin glucose metabolism' }];
    const embeddingProvider: EmbeddingProvider = { embed: vi.fn().mockRejectedValue(new Error('network down')) };

    const service = new SearchIndexService(
      testConfig,
      makeDocumentService(documents),
      embeddingProvider,
      makeEmbeddingCache(),
      undefined
    );

    const results = await service.search('insulin');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].embeddingScore).toBe(0);
  });

  it('caches embeddings by chunkId+contentHash and does not re-embed on the second search', async () => {
    const documents = [{ id: 'doc1', title: 'Doc', contentHash: 'h1', content: 'insulin glucose metabolism' }];
    const embed = vi.fn(async (texts: readonly string[]) => texts.map(() => [1, 0]));
    const cache = makeEmbeddingCache();

    const service = new SearchIndexService(testConfig, makeDocumentService(documents), { embed }, cache, undefined);

    await service.search('insulin');
    const callsAfterFirst = embed.mock.calls.length;
    await service.search('insulin');

    // Only the query itself should be re-embedded the second time; the chunk should be cached.
    expect(embed.mock.calls.length).toBe(callsAfterFirst + 1);
  });
});
