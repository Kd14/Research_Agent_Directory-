import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from './SessionService';
import { SessionStore } from '../storage/SessionStore';

let sessionsDir: string;
let service: SessionService;

beforeEach(() => {
  sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-sessionservice-'));
  service = new SessionService(new SessionStore(sessionsDir));
});

afterEach(() => {
  fs.rmSync(sessionsDir, { recursive: true, force: true });
});

describe('SessionService', () => {
  it('creates a session with a generated id and default history', () => {
    const metadata = service.create({
      title: 'My Session',
      userPrompt: 'test',
      selectedDocIds: [],
      executionMode: 'auto'
    });

    expect(metadata.id).toMatch(/^session_/);
    expect(metadata.status).toBe('planning');

    const loaded = service.load(metadata.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.history.instructionSet).toEqual([]);
    }
  });

  it('returns a ValidationError when loading a nonexistent session', () => {
    const result = service.load('session_does_not_exist');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('saves a patch and bumps updatedAt', async () => {
    const metadata = service.create({ title: 'X', userPrompt: 'x', selectedDocIds: [], executionMode: 'auto' });
    await new Promise(r => setTimeout(r, 5));

    const saveResult = service.save(metadata.id, { currentStepIndex: 2, status: 'executing' });
    expect(saveResult.ok).toBe(true);

    const loaded = service.load(metadata.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.history.currentStepIndex).toBe(2);
      expect(loaded.value.metadata.status).toBe('executing');
      expect(loaded.value.metadata.updatedAt).not.toBe(metadata.updatedAt);
    }
  });

  it('renames a session', () => {
    const metadata = service.create({ title: 'Old', userPrompt: 'x', selectedDocIds: [], executionMode: 'auto' });
    const result = service.rename(metadata.id, 'New Title');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('New Title');
    }
  });

  it('duplicates a session with a new id and copies its artifacts', () => {
    const metadata = service.create({ title: 'Original', userPrompt: 'x', selectedDocIds: [], executionMode: 'auto' });
    service.writeArtifact(metadata.id, 'report.md', '# Report');

    const result = service.duplicate(metadata.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).not.toBe(metadata.id);
      expect(result.value.title).toBe('Original (Copy)');

      const loaded = service.load(result.value.id);
      expect(loaded.ok).toBe(true);
    }
  });

  it('is idempotent-safe: removing an existing session succeeds, removing again fails cleanly', () => {
    const metadata = service.create({ title: 'X', userPrompt: 'x', selectedDocIds: [], executionMode: 'auto' });

    const first = service.remove(metadata.id);
    expect(first.ok).toBe(true);

    const second = service.remove(metadata.id);
    expect(second.ok).toBe(false);
  });

  it('lists sessions after creation', () => {
    service.create({ title: 'A', userPrompt: 'x', selectedDocIds: [], executionMode: 'auto' });
    service.create({ title: 'B', userPrompt: 'x', selectedDocIds: [], executionMode: 'auto' });

    expect(service.list()).toHaveLength(2);
  });
});
