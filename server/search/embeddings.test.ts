import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EmbeddingCache, cosineSimilarity } from './embeddings';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns 0 for mismatched or empty vectors', () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('is higher for more similar vectors', () => {
    const query = [1, 1, 0];
    const close = [1, 0.9, 0.1];
    const far = [0, 0, 1];
    expect(cosineSimilarity(query, close)).toBeGreaterThan(cosineSimilarity(query, far));
  });
});

describe('EmbeddingCache', () => {
  let cacheFile: string;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-embedcache-'));
    cacheFile = path.join(dir, 'embeddings.json');
  });

  afterEach(() => {
    fs.rmSync(path.dirname(cacheFile), { recursive: true, force: true });
  });

  it('returns undefined for a miss', () => {
    const cache = new EmbeddingCache(cacheFile);
    expect(cache.get('chunk1', 'hash1')).toBeUndefined();
  });

  it('stores and retrieves a vector keyed by chunkId+contentHash', () => {
    const cache = new EmbeddingCache(cacheFile);
    cache.set('chunk1', 'hash1', [0.1, 0.2, 0.3]);
    expect(cache.get('chunk1', 'hash1')).toEqual([0.1, 0.2, 0.3]);
  });

  it('treats a different contentHash for the same chunkId as a miss (invalidates on content change)', () => {
    const cache = new EmbeddingCache(cacheFile);
    cache.set('chunk1', 'hash1', [0.1, 0.2, 0.3]);
    expect(cache.get('chunk1', 'hash2')).toBeUndefined();
  });

  it('persists to disk and reloads in a fresh instance', () => {
    const first = new EmbeddingCache(cacheFile);
    first.set('chunk1', 'hash1', [0.5, 0.5]);

    const second = new EmbeddingCache(cacheFile);
    expect(second.get('chunk1', 'hash1')).toEqual([0.5, 0.5]);
  });
});
