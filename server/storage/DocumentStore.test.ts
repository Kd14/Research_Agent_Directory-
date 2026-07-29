import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentStore } from './DocumentStore';
import type { TechDocument } from '../../client/types';

let dataDir: string;
let documentsFile: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-documentstore-'));
  documentsFile = path.join(dataDir, 'documents.json');
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const sampleDoc: TechDocument = {
  id: 'doc_1',
  title: 'Sample',
  category: 'Technical Architecture',
  fileName: 'sample.txt',
  content: 'hello world',
  sizeBytes: 11,
  uploadedAt: new Date().toISOString(),
  tags: []
};

describe('DocumentStore', () => {
  it('falls back to sample documents when no file exists yet', () => {
    const store = new DocumentStore(documentsFile, dataDir);
    expect(store.list().length).toBeGreaterThan(0);
  });

  it('persists an added document to disk and reloads it on a fresh instance', () => {
    const store = new DocumentStore(documentsFile, dataDir);
    store.add(sampleDoc);

    expect(fs.existsSync(documentsFile)).toBe(true);

    const reloaded = new DocumentStore(documentsFile, dataDir);
    expect(reloaded.list().some(d => d.id === 'doc_1')).toBe(true);
  });

  it('adds new documents to the front of the list', () => {
    const store = new DocumentStore(documentsFile, dataDir);
    const before = store.list().length;
    store.add(sampleDoc);
    expect(store.list()[0].id).toBe('doc_1');
    expect(store.list().length).toBe(before + 1);
  });

  it('removes a document by id and returns the remaining count', () => {
    const store = new DocumentStore(documentsFile, dataDir);
    store.add(sampleDoc);
    const remaining = store.remove('doc_1');

    expect(store.list().some(d => d.id === 'doc_1')).toBe(false);
    expect(remaining).toBe(store.list().length);
  });
});
