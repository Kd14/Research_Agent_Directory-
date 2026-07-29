import { describe, expect, it } from 'vitest';
import { chunkDocument } from './chunking';

describe('chunkDocument', () => {
  it('returns an empty array for empty content', () => {
    expect(chunkDocument('doc1', '')).toEqual([]);
  });

  it('returns a single chunk for short content', () => {
    const chunks = chunkDocument('doc1', 'short text');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ docId: 'doc1', chunkId: 'doc1#0', offsetStart: 0, offsetEnd: 10 });
  });

  it('produces overlapping chunks for long content with correct offsets', () => {
    const content = 'a'.repeat(1500);
    const chunks = chunkDocument('doc1', content);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.chunkText).toBe(content.slice(chunk.offsetStart, chunk.offsetEnd));
    }
    // consecutive chunks overlap
    expect(chunks[1].offsetStart).toBeLessThan(chunks[0].offsetEnd);
    // the last chunk reaches the end of the content
    expect(chunks[chunks.length - 1].offsetEnd).toBe(content.length);
  });

  it('assigns chunkIds as docId#index', () => {
    const chunks = chunkDocument('mydoc', 'a'.repeat(1500));
    chunks.forEach((c, i) => expect(c.chunkId).toBe(`mydoc#${i}`));
  });
});
