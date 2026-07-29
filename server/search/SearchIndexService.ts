import type { AppConfig } from '../config';
import type { DocumentService } from '../services/DocumentService';
import { BM25Index } from './bm25';
import { chunkDocument, type DocumentChunk } from './chunking';
import type { EmbeddingCache, EmbeddingProvider } from './embeddings';
import { cosineSimilarity } from './embeddings';
import { combineScores } from './hybridRetrieval';
import type { Reranker } from './rerank';

export interface SearchResult {
  readonly docId: string;
  readonly docTitle: string;
  readonly chunkId: string;
  readonly chunkText: string;
  readonly offsetStart: number;
  readonly offsetEnd: number;
  readonly bm25Score: number;
  readonly embeddingScore: number;
  readonly finalScore: number;
}

export interface SearchOptions {
  readonly docIds?: readonly string[];
  readonly topK?: number;
}

// No new infrastructure service - chunking/BM25/embeddings all run in-process, with a flat JSON
// embedding cache under data/index/. The in-memory BM25 index is rebuilt (fast, no I/O) whenever
// the document set changes; that's cheap enough at personal-document-set scale to skip persisting
// it separately.
export class SearchIndexService {
  private bm25Index: BM25Index | null = null;
  private chunksById = new Map<string, DocumentChunk>();
  private indexedRevision = '';

  constructor(
    private readonly config: AppConfig,
    private readonly documentService: DocumentService,
    private readonly embeddingProvider: EmbeddingProvider | undefined,
    private readonly embeddingCache: EmbeddingCache | undefined,
    private readonly reranker: Reranker | undefined
  ) {}

  private rebuildIfStale(): void {
    const documents = this.documentService.list();
    const revision = documents.map(d => `${d.id}:${d.contentHash ?? d.sizeBytes}`).join('|');
    if (revision === this.indexedRevision && this.bm25Index) return;

    this.chunksById = new Map();
    const allChunks: DocumentChunk[] = [];
    for (const doc of documents) {
      for (const chunk of chunkDocument(doc.id, doc.content)) {
        this.chunksById.set(chunk.chunkId, chunk);
        allChunks.push(chunk);
      }
    }

    const index = new BM25Index();
    index.build(allChunks.map(c => ({ id: c.chunkId, text: c.chunkText })));
    this.bm25Index = index;
    this.indexedRevision = revision;
  }

  // Failures degrade gracefully internally (e.g. embedding errors fall back to BM25-only) rather
  // than propagating as an error the caller must branch on, so this returns the result directly.
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.rebuildIfStale();
    const topK = options.topK ?? 5;

    const scopedChunkIds = options.docIds?.length
      ? new Set(Array.from(this.chunksById.values()).filter(c => options.docIds!.includes(c.docId)).map(c => c.chunkId))
      : undefined;

    if (!this.bm25Index || this.chunksById.size === 0) {
      return [];
    }

    const bm25Index = scopedChunkIds
      ? this.buildScopedIndex(scopedChunkIds)
      : this.bm25Index;

    const bm25Results = bm25Index.score(query, Math.max(topK * 4, 20));
    const bm25ScoreByChunk = new Map(bm25Results.map(r => [r.id, r.score]));
    const embeddingScoreByChunk = await this.computeEmbeddingScores(query, bm25Results.map(r => r.id));

    const candidateChunkIds = new Set([...bm25ScoreByChunk.keys(), ...embeddingScoreByChunk.keys()]);
    let ranked = combineScores(
      Array.from(candidateChunkIds).map(chunkId => ({
        chunkId,
        bm25Score: bm25ScoreByChunk.get(chunkId) || 0,
        embeddingScore: embeddingScoreByChunk.get(chunkId) || 0
      })),
      { bm25Weight: this.config.search.bm25Weight, embeddingWeight: this.config.search.embeddingWeight }
    );

    if (this.reranker && this.config.search.rerankEnabled && ranked.length > 0) {
      const rerankPool = ranked.slice(0, topK * 2);
      const rerankedOrder = await this.reranker.rerank(
        query,
        rerankPool.map(r => ({ chunkId: r.chunkId, chunkText: this.chunksById.get(r.chunkId)!.chunkText }))
      );
      const byChunkId = new Map(rerankPool.map(r => [r.chunkId, r]));
      const reordered = rerankedOrder.map(id => byChunkId.get(id)).filter((r): r is typeof rerankPool[number] => Boolean(r));
      ranked = [...reordered, ...ranked.slice(topK * 2)];
    }

    const documents = this.documentService.list();
    const results: SearchResult[] = ranked.slice(0, topK).map(r => {
      const chunk = this.chunksById.get(r.chunkId)!;
      const doc = documents.find(d => d.id === chunk.docId);
      return {
        docId: chunk.docId,
        docTitle: doc?.title || chunk.docId,
        chunkId: chunk.chunkId,
        chunkText: chunk.chunkText,
        offsetStart: chunk.offsetStart,
        offsetEnd: chunk.offsetEnd,
        bm25Score: bm25ScoreByChunk.get(r.chunkId) || 0,
        embeddingScore: embeddingScoreByChunk.get(r.chunkId) || 0,
        finalScore: r.finalScore
      };
    });

    return results;
  }

  private buildScopedIndex(scopedChunkIds: Set<string>): BM25Index {
    const index = new BM25Index();
    index.build(
      Array.from(this.chunksById.values())
        .filter(c => scopedChunkIds.has(c.chunkId))
        .map(c => ({ id: c.chunkId, text: c.chunkText }))
    );
    return index;
  }

  // Graceful degradation: no embedding provider (e.g. no API key configured) -> BM25-only, no
  // network call, app stays usable offline.
  private async computeEmbeddingScores(query: string, candidateChunkIds: readonly string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    if (!this.embeddingProvider || !this.embeddingCache || candidateChunkIds.length === 0) {
      return scores;
    }

    try {
      const documents = this.documentService.list();
      const [queryVector] = await this.embeddingProvider.embed([query]);
      if (!queryVector) return scores;

      const vectors = new Map<string, number[]>();
      const toEmbed: DocumentChunk[] = [];

      for (const chunkId of candidateChunkIds) {
        const chunk = this.chunksById.get(chunkId);
        if (!chunk) continue;
        const contentHash = documents.find(d => d.id === chunk.docId)?.contentHash ?? chunkId;
        const cached = this.embeddingCache.get(chunkId, contentHash);
        if (cached) {
          vectors.set(chunkId, cached);
        } else {
          toEmbed.push(chunk);
        }
      }

      if (toEmbed.length > 0) {
        const embedded = await this.embeddingProvider.embed(toEmbed.map(c => c.chunkText));
        toEmbed.forEach((chunk, i) => {
          const vector = embedded[i];
          if (!vector) return;
          vectors.set(chunk.chunkId, vector);
          const contentHash = documents.find(d => d.id === chunk.docId)?.contentHash ?? chunk.chunkId;
          this.embeddingCache!.set(chunk.chunkId, contentHash, vector);
        });
      }

      for (const [chunkId, vector] of vectors) {
        scores.set(chunkId, cosineSimilarity(queryVector, vector));
      }
    } catch (err) {
      console.error('Embedding-assisted search failed, falling back to BM25-only:', err);
    }

    return scores;
  }
}
