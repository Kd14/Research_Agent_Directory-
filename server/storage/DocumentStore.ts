import fs from 'fs';
import type { TechDocument } from '../../client/types';
import { INITIAL_DOCUMENTS } from '../../client/data/sampleDocuments';

export class DocumentStore {
  private documents: TechDocument[];

  constructor(private readonly documentsFile: string, private readonly dataDir: string) {
    this.documents = this.loadFromDisk();
  }

  private loadFromDisk(): TechDocument[] {
    try {
      if (fs.existsSync(this.documentsFile)) {
        return JSON.parse(fs.readFileSync(this.documentsFile, 'utf-8'));
      }
    } catch (err) {
      console.error('Failed to load persisted documents, falling back to samples:', err);
    }
    return [...INITIAL_DOCUMENTS];
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(this.documentsFile, JSON.stringify(this.documents, null, 2));
    } catch (err) {
      console.error('Failed to persist documents:', err);
    }
  }

  list(): readonly TechDocument[] {
    return this.documents;
  }

  add(doc: TechDocument): void {
    this.documents.unshift(doc);
    this.saveToDisk();
  }

  remove(id: string): number {
    this.documents = this.documents.filter(d => d.id !== id);
    this.saveToDisk();
    return this.documents.length;
  }
}

