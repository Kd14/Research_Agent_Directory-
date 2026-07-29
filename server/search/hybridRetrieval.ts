export interface RetrievalCandidate {
  readonly chunkId: string;
  readonly bm25Score: number;
  readonly embeddingScore: number;
}

export interface HybridScore extends RetrievalCandidate {
  readonly finalScore: number;
}

export interface HybridWeights {
  readonly bm25Weight: number;
  readonly embeddingWeight: number;
}

// Min-max normalizes each score dimension across the candidate set, then combines via a
// configurable weighted sum - simple and transparent, no learned ranker needed at this scale.
export function combineScores(candidates: readonly RetrievalCandidate[], weights: HybridWeights): HybridScore[] {
  if (candidates.length === 0) return [];

  const maxBm25 = Math.max(1e-9, ...candidates.map(c => c.bm25Score));
  const maxEmbedding = Math.max(1e-9, ...candidates.map(c => c.embeddingScore));

  return candidates
    .map(c => ({
      ...c,
      finalScore:
        weights.bm25Weight * (c.bm25Score / maxBm25) +
        weights.embeddingWeight * (c.embeddingScore / maxEmbedding)
    }))
    .sort((a, b) => b.finalScore - a.finalScore);
}
