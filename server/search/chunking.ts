export interface DocumentChunk {
  readonly docId: string;
  readonly chunkId: string;
  readonly chunkText: string;
  readonly offsetStart: number;
  readonly offsetEnd: number;
}

const CHUNK_SIZE = 600;
const OVERLAP_RATIO = 0.15;

// Overlapping fixed-size chunks (not sentence/paragraph-aware) - simple, deterministic, and
// sufficient for BM25 + embedding retrieval over a personal document set. Retains offsets so
// search results can point back to the exact source span (source attribution).
export function chunkDocument(docId: string, content: string): DocumentChunk[] {
  if (content.length === 0) return [];

  const overlap = Math.floor(CHUNK_SIZE * OVERLAP_RATIO);
  const step = CHUNK_SIZE - overlap;
  const chunks: DocumentChunk[] = [];
  let index = 0;

  for (let start = 0; start < content.length; start += step) {
    const end = Math.min(start + CHUNK_SIZE, content.length);
    chunks.push({
      docId,
      chunkId: `${docId}#${index}`,
      chunkText: content.slice(start, end),
      offsetStart: start,
      offsetEnd: end
    });
    index++;
    if (end >= content.length) break;
  }

  return chunks;
}
