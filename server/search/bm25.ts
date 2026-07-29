export interface BM25Document {
  readonly id: string;
  readonly text: string;
}

export interface BM25Result {
  readonly id: string;
  readonly score: number;
}

interface Posting {
  readonly docId: string;
  readonly termFreq: number;
}

interface SerializedBM25Index {
  readonly postings: readonly [string, Posting[]][];
  readonly docLengths: readonly [string, number][];
  readonly avgDocLength: number;
  readonly docCount: number;
}

// Hand-rolled inverted index (Okapi BM25, k1=1.5/b=0.75) - no search-engine dependency needed at
// personal-document-set scale. Persisted as flat JSON via toJSON()/fromJSON(), not a database.
export class BM25Index {
  private readonly k1 = 1.5;
  private readonly b = 0.75;
  private postings = new Map<string, Posting[]>();
  private docLengths = new Map<string, number>();
  private avgDocLength = 0;
  private docCount = 0;

  static tokenize(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  }

  build(documents: readonly BM25Document[]): void {
    this.postings = new Map();
    this.docLengths = new Map();
    this.docCount = documents.length;
    let totalLength = 0;

    for (const doc of documents) {
      const tokens = BM25Index.tokenize(doc.text);
      this.docLengths.set(doc.id, tokens.length);
      totalLength += tokens.length;

      const termFreqs = new Map<string, number>();
      for (const t of tokens) termFreqs.set(t, (termFreqs.get(t) || 0) + 1);

      for (const [term, freq] of termFreqs) {
        const list = this.postings.get(term) || [];
        list.push({ docId: doc.id, termFreq: freq });
        this.postings.set(term, list);
      }
    }

    this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 0;
  }

  score(query: string, topK = 10): BM25Result[] {
    const queryTerms = Array.from(new Set(BM25Index.tokenize(query)));
    const scores = new Map<string, number>();

    for (const term of queryTerms) {
      const postingList = this.postings.get(term);
      if (!postingList) continue;

      const df = postingList.length;
      const idf = Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));

      for (const posting of postingList) {
        const docLength = this.docLengths.get(posting.docId) || 0;
        const denominator = posting.termFreq + this.k1 * (1 - this.b + this.b * (docLength / (this.avgDocLength || 1)));
        const termScore = idf * ((posting.termFreq * (this.k1 + 1)) / denominator);
        scores.set(posting.docId, (scores.get(posting.docId) || 0) + termScore);
      }
    }

    return Array.from(scores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  toJSON(): SerializedBM25Index {
    return {
      postings: Array.from(this.postings.entries()),
      docLengths: Array.from(this.docLengths.entries()),
      avgDocLength: this.avgDocLength,
      docCount: this.docCount
    };
  }

  static fromJSON(data: SerializedBM25Index): BM25Index {
    const index = new BM25Index();
    index.postings = new Map(data.postings);
    index.docLengths = new Map(data.docLengths);
    index.avgDocLength = data.avgDocLength;
    index.docCount = data.docCount;
    return index;
  }
}
