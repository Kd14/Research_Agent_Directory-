import { describe, expect, it } from 'vitest';
import { combineScores } from './hybridRetrieval';

describe('combineScores', () => {
  it('returns an empty array for no candidates', () => {
    expect(combineScores([], { bm25Weight: 0.5, embeddingWeight: 0.5 })).toEqual([]);
  });

  it('normalizes and combines scores, sorted descending by finalScore', () => {
    const results = combineScores(
      [
        { chunkId: 'a', bm25Score: 10, embeddingScore: 0.1 },
        { chunkId: 'b', bm25Score: 1, embeddingScore: 0.9 }
      ],
      { bm25Weight: 0.5, embeddingWeight: 0.5 }
    );

    // a: 0.5*(10/10) + 0.5*(0.1/0.9) = 0.5 + 0.0556 = 0.5556
    // b: 0.5*(1/10) + 0.5*(0.9/0.9) = 0.05 + 0.5 = 0.55
    expect(results[0].chunkId).toBe('a');
    expect(results[0].finalScore).toBeGreaterThan(results[1].finalScore);
  });

  it('weights embedding-only relevance higher when bm25Weight is 0', () => {
    const results = combineScores(
      [
        { chunkId: 'bm25-only', bm25Score: 10, embeddingScore: 0 },
        { chunkId: 'embedding-only', bm25Score: 0, embeddingScore: 1 }
      ],
      { bm25Weight: 0, embeddingWeight: 1 }
    );
    expect(results[0].chunkId).toBe('embedding-only');
  });
});
