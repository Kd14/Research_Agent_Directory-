import { describe, expect, it } from 'vitest';
import { BM25Index } from './bm25';

describe('BM25Index', () => {
  it('ranks documents containing query terms above those that do not', () => {
    const index = new BM25Index();
    index.build([
      { id: 'a', text: 'insulin regulates blood glucose levels in the body' },
      { id: 'b', text: 'completely unrelated content about gpu clusters' }
    ]);

    const results = index.score('insulin glucose');
    expect(results[0]?.id).toBe('a');
    expect(results.find(r => r.id === 'b')).toBeUndefined();
  });

  it('returns no results for a query with no matching terms', () => {
    const index = new BM25Index();
    index.build([{ id: 'a', text: 'insulin regulates glucose' }]);
    expect(index.score('quantum entanglement')).toEqual([]);
  });

  it('scores documents with higher term frequency more highly, all else equal', () => {
    const index = new BM25Index();
    index.build([
      { id: 'high-freq', text: 'gpu gpu gpu cluster topology unrelated padding words here to equalize length' },
      { id: 'low-freq', text: 'gpu cluster topology unrelated padding words here to equalize length more' }
    ]);

    const results = index.score('gpu');
    const highFreqScore = results.find(r => r.id === 'high-freq')?.score ?? 0;
    const lowFreqScore = results.find(r => r.id === 'low-freq')?.score ?? 0;
    expect(highFreqScore).toBeGreaterThan(lowFreqScore);
  });

  it('round-trips through toJSON/fromJSON', () => {
    const index = new BM25Index();
    index.build([{ id: 'a', text: 'insulin regulates glucose' }]);

    const restored = BM25Index.fromJSON(index.toJSON());
    expect(restored.score('insulin')).toEqual(index.score('insulin'));
  });

  it('respects topK', () => {
    const index = new BM25Index();
    index.build([
      { id: 'a', text: 'insulin glucose' },
      { id: 'b', text: 'insulin metabolism' },
      { id: 'c', text: 'insulin signaling' }
    ]);
    expect(index.score('insulin', 2)).toHaveLength(2);
  });
});
