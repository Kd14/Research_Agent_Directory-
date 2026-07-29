import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import type { AppConfig } from '../config';

export interface EmbeddingProvider {
  embed(texts: readonly string[]): Promise<number[][]>;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly client: GoogleGenAI;

  constructor(private readonly config: AppConfig) {
    this.client = new GoogleGenAI({ apiKey: config.llm.apiKey });
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await this.client.models.embedContent({
      model: this.config.llm.embeddingModel,
      contents: texts as string[]
    });
    return (response.embeddings || []).map(e => e.values || []);
  }
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface CachedEmbedding {
  readonly chunkId: string;
  readonly contentHash: string;
  readonly vector: number[];
}

// Keyed by chunkId+contentHash so unchanged chunks are never re-embedded across index rebuilds.
export class EmbeddingCache {
  private entries = new Map<string, CachedEmbedding>();

  constructor(private readonly cacheFile: string) {
    this.load();
  }

  private cacheKey(chunkId: string, contentHash: string): string {
    return `${chunkId}::${contentHash}`;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data: CachedEmbedding[] = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
        this.entries = new Map(data.map(e => [this.cacheKey(e.chunkId, e.contentHash), e]));
      }
    } catch (err) {
      console.error('Failed to load embedding cache, starting fresh:', err);
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify(Array.from(this.entries.values())));
    } catch (err) {
      console.error('Failed to persist embedding cache:', err);
    }
  }

  get(chunkId: string, contentHash: string): number[] | undefined {
    return this.entries.get(this.cacheKey(chunkId, contentHash))?.vector;
  }

  set(chunkId: string, contentHash: string, vector: number[]): void {
    this.entries.set(this.cacheKey(chunkId, contentHash), { chunkId, contentHash, vector });
    this.save();
  }
}
