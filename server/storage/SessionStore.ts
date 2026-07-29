import fs from 'fs';
import path from 'path';
import type { SessionHistory, SessionMetadata } from './sessionTypes';

export class SessionStore {
  constructor(private readonly sessionsDir: string) {}

  private sessionDir(id: string): string {
    return path.join(this.sessionsDir, id);
  }

  private metadataPath(id: string): string {
    return path.join(this.sessionDir(id), 'metadata.json');
  }

  private historyPath(id: string): string {
    return path.join(this.sessionDir(id), 'history.json');
  }

  private artifactsDir(id: string): string {
    return path.join(this.sessionDir(id), 'artifacts');
  }

  private documentsDir(id: string): string {
    return path.join(this.sessionDir(id), 'documents');
  }

  exists(id: string): boolean {
    return fs.existsSync(this.metadataPath(id));
  }

  create(id: string, metadata: SessionMetadata, history: SessionHistory): void {
    fs.mkdirSync(this.artifactsDir(id), { recursive: true });
    fs.mkdirSync(this.documentsDir(id), { recursive: true });
    this.writeMetadata(id, metadata);
    this.writeHistory(id, history);
  }

  readMetadata(id: string): SessionMetadata | undefined {
    try {
      return JSON.parse(fs.readFileSync(this.metadataPath(id), 'utf-8'));
    } catch {
      return undefined;
    }
  }

  readHistory(id: string): SessionHistory | undefined {
    try {
      return JSON.parse(fs.readFileSync(this.historyPath(id), 'utf-8'));
    } catch {
      return undefined;
    }
  }

  writeMetadata(id: string, metadata: SessionMetadata): void {
    fs.mkdirSync(this.sessionDir(id), { recursive: true });
    fs.writeFileSync(this.metadataPath(id), JSON.stringify(metadata, null, 2));
  }

  writeHistory(id: string, history: SessionHistory): void {
    fs.mkdirSync(this.sessionDir(id), { recursive: true });
    fs.writeFileSync(this.historyPath(id), JSON.stringify(history, null, 2));
  }

  writeArtifact(id: string, relativeName: string, content: string): void {
    fs.mkdirSync(this.artifactsDir(id), { recursive: true });
    fs.writeFileSync(path.join(this.artifactsDir(id), relativeName), content);
  }

  readArtifact(id: string, relativeName: string): string | undefined {
    try {
      return fs.readFileSync(path.join(this.artifactsDir(id), relativeName), 'utf-8');
    } catch {
      return undefined;
    }
  }

  list(): SessionMetadata[] {
    if (!fs.existsSync(this.sessionsDir)) return [];
    return fs.readdirSync(this.sessionsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => this.readMetadata(entry.name))
      .filter((m): m is SessionMetadata => Boolean(m))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  remove(id: string): void {
    fs.rmSync(this.sessionDir(id), { recursive: true, force: true });
  }

  /** Copies an entire session directory (metadata, history, artifacts) to a new id. */
  copy(sourceId: string, targetId: string): void {
    fs.cpSync(this.sessionDir(sourceId), this.sessionDir(targetId), { recursive: true });
  }
}
