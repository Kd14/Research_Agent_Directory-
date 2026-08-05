import { ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { SessionStore } from '../storage/SessionStore';
import type { SessionHistory, SessionMetadata } from '../storage/sessionTypes';

export interface CreateSessionInput {
  readonly title: string;
  readonly userPrompt: string;
  readonly selectedDocIds: readonly string[];
  readonly executionMode: SessionMetadata['executionMode'];
}

export interface LoadedSession {
  readonly metadata: SessionMetadata;
  readonly history: SessionHistory;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class SessionService {
  constructor(private readonly store: SessionStore) {}

  create(input: CreateSessionInput): SessionMetadata {
    const id = generateSessionId();
    const now = new Date().toISOString();
    const metadata: SessionMetadata = {
      schemaVersion: 1,
      id,
      title: input.title,
      userPrompt: input.userPrompt,
      selectedDocIds: input.selectedDocIds,
      executionMode: input.executionMode,
      status: 'planning',
      createdAt: now,
      updatedAt: now
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
    this.store.create(id, metadata, history);
    return metadata;
  }

  load(id: string): Result<LoadedSession, ValidationError> {
    if (!this.store.exists(id)) {
      return Err(new ValidationError(`Session ${id} not found`));
    }
    const metadata = this.store.readMetadata(id);
    const history = this.store.readHistory(id);
    if (!metadata || !history) {
      return Err(new ValidationError(`Session ${id} is corrupted or unreadable`));
    }
    return Ok({ metadata, history });
  }

  save(id: string, patch: Partial<SessionHistory> & { status?: SessionMetadata['status'] }): Result<void, ValidationError> {
    const loaded = this.load(id);
    if (!loaded.ok) return loaded;

    const { status, ...historyPatch } = patch;
    const updatedHistory: SessionHistory = { ...loaded.value.history, ...historyPatch };
    const updatedMetadata: SessionMetadata = {
      ...loaded.value.metadata,
      status: status ?? loaded.value.metadata.status,
      updatedAt: new Date().toISOString()
    };

    this.store.writeHistory(id, updatedHistory);
    this.store.writeMetadata(id, updatedMetadata);
    return Ok(undefined);
  }

  writeArtifact(id: string, relativeName: string, content: string): Result<void, ValidationError> {
    if (!this.store.exists(id)) {
      return Err(new ValidationError(`Session ${id} not found`));
    }
    this.store.writeArtifact(id, relativeName, content);
    return Ok(undefined);
  }

  readArtifact(id: string, relativeName: string): string | undefined {
    return this.store.readArtifact(id, relativeName);
  }

  writeBinaryArtifact(id: string, relativeName: string, content: Buffer): Result<void, ValidationError> {
    if (!this.store.exists(id)) {
      return Err(new ValidationError(`Session ${id} not found`));
    }
    this.store.writeBinaryArtifact(id, relativeName, content);
    return Ok(undefined);
  }

  readBinaryArtifact(id: string, relativeName: string): Buffer | undefined {
    return this.store.readBinaryArtifact(id, relativeName);
  }

  list(): SessionMetadata[] {
    return this.store.list();
  }

  rename(id: string, title: string): Result<SessionMetadata, ValidationError> {
    const loaded = this.load(id);
    if (!loaded.ok) return loaded;

    const updatedMetadata: SessionMetadata = {
      ...loaded.value.metadata,
      title,
      updatedAt: new Date().toISOString()
    };
    this.store.writeMetadata(id, updatedMetadata);
    return Ok(updatedMetadata);
  }

  duplicate(id: string): Result<SessionMetadata, ValidationError> {
    const loaded = this.load(id);
    if (!loaded.ok) return loaded;

    const newId = generateSessionId();
    const now = new Date().toISOString();
    this.store.copy(id, newId);

    const newMetadata: SessionMetadata = {
      ...loaded.value.metadata,
      id: newId,
      title: `${loaded.value.metadata.title} (Copy)`,
      createdAt: now,
      updatedAt: now
    };
    this.store.writeMetadata(newId, newMetadata);
    return Ok(newMetadata);
  }

  exportBundle(id: string): Result<LoadedSession, ValidationError> {
    return this.load(id);
  }

  remove(id: string): Result<void, ValidationError> {
    if (!this.store.exists(id)) {
      return Err(new ValidationError(`Session ${id} not found`));
    }
    this.store.remove(id);
    return Ok(undefined);
  }
}
