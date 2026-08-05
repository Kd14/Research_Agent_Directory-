import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionStore } from './SessionStore';
import type { SessionHistory, SessionMetadata } from './sessionTypes';

let sessionsDir: string;
let store: SessionStore;

const metadata: SessionMetadata = {
  schemaVersion: 1,
  id: 'session_test',
  title: 'Test Session',
  userPrompt: 'test prompt',
  selectedDocIds: [],
  executionMode: 'auto',
  status: 'planning',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const history: SessionHistory = {
  schemaVersion: 1,
  instructionSet: [],
  agents: {},
  logs: [],
  agentOutputs: {},
  currentStepIndex: 0,
  citations: [],
  reflections: [],
  reflectionIterationCount: 0
};

beforeEach(() => {
  sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-sessionstore-'));
  store = new SessionStore(sessionsDir);
});

afterEach(() => {
  fs.rmSync(sessionsDir, { recursive: true, force: true });
});

describe('SessionStore', () => {
  it('round-trips metadata and history', () => {
    store.create('session_test', metadata, history);

    expect(store.exists('session_test')).toBe(true);
    expect(store.readMetadata('session_test')).toEqual(metadata);
    expect(store.readHistory('session_test')).toEqual(history);
  });

  it('creates artifacts and documents subdirectories', () => {
    store.create('session_test', metadata, history);

    expect(fs.existsSync(path.join(sessionsDir, 'session_test', 'artifacts'))).toBe(true);
    expect(fs.existsSync(path.join(sessionsDir, 'session_test', 'documents'))).toBe(true);
  });

  it('writes and reads artifacts', () => {
    store.create('session_test', metadata, history);
    store.writeArtifact('session_test', 'report.md', '# Report');

    expect(store.readArtifact('session_test', 'report.md')).toBe('# Report');
  });

  it('lists sessions sorted by updatedAt descending', () => {
    store.create('session_a', { ...metadata, id: 'session_a', updatedAt: '2026-01-01T00:00:00.000Z' }, history);
    store.create('session_b', { ...metadata, id: 'session_b', updatedAt: '2026-01-02T00:00:00.000Z' }, history);

    const listed = store.list();
    expect(listed.map(m => m.id)).toEqual(['session_b', 'session_a']);
  });

  it('removes a session directory entirely', () => {
    store.create('session_test', metadata, history);
    store.remove('session_test');

    expect(store.exists('session_test')).toBe(false);
  });

  it('copies a session to a new id', () => {
    store.create('session_test', metadata, history);
    store.writeArtifact('session_test', 'report.md', '# Report');
    store.copy('session_test', 'session_copy');

    expect(store.exists('session_copy')).toBe(true);
    expect(store.readArtifact('session_copy', 'report.md')).toBe('# Report');
  });

  it('returns an empty list when the sessions directory does not exist yet', () => {
    const freshDir = path.join(sessionsDir, 'does-not-exist');
    const freshStore = new SessionStore(freshDir);
    expect(freshStore.list()).toEqual([]);
  });
});
