import { Type } from '@google/genai';
import type { LLMProvider } from '../llm/LLMProvider';

export interface RerankCandidate {
  readonly chunkId: string;
  readonly chunkText: string;
}

export interface Reranker {
  /** Returns chunkIds reordered most-relevant-first. */
  rerank(query: string, candidates: readonly RerankCandidate[]): Promise<string[]>;
}

// Reuses the existing LLMProvider for a cheap one-call relevance pass rather than a dedicated
// ML reranking service - toggleable via config.search.rerankEnabled for users who'd rather skip
// the extra round-trip.
export class LLMReranker implements Reranker {
  constructor(private readonly llmProvider: LLMProvider) {}

  async rerank(query: string, candidates: readonly RerankCandidate[]): Promise<string[]> {
    if (candidates.length === 0) return [];
    const originalOrder = candidates.map(c => c.chunkId);

    const prompt = `Query: "${query}"\n\nRank the following passages by relevance to the query, most relevant first. Return only a JSON array of passage IDs, most relevant first.\n\n${candidates
      .map(c => `[${c.chunkId}]: ${c.chunkText.slice(0, 300)}`)
      .join('\n\n')}`;

    const result = await this.llmProvider.generate(prompt, {
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    });

    if (!result.ok) return originalOrder;

    try {
      const ranked = JSON.parse((result.value.text ?? '').trim()) as string[];
      const validIds = new Set(originalOrder);
      const filtered = ranked.filter(id => validIds.has(id));
      const missing = originalOrder.filter(id => !filtered.includes(id));
      return [...filtered, ...missing];
    } catch {
      return originalOrder;
    }
  }
}
