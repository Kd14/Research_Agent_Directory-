import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { TechDocument } from '../../client/types';
import { Ok, type Result } from '../result';
import type { ProviderError } from '../errors/AppError';
import type { GenerateResult, LLMProvider, StreamChunk } from '../llm/LLMProvider';
import type { AppConfig } from '../config';
import { ResearchPipeline } from '../orchestration/ResearchPipeline';
import { DocumentService } from '../services/DocumentService';
import { ExecutionService } from '../services/ExecutionService';
import { PlannerService } from '../services/PlannerService';
import { MemoryService } from '../services/MemoryService';
import { ReflectionService } from '../services/ReflectionService';
import { SessionService } from '../services/SessionService';
import { ToolService } from '../services/ToolService';
import { SessionStore } from '../storage/SessionStore';
import { createToolExecutor, createToolRegistry } from '../tools';
import { createApiRouter } from './router';

class InMemoryDocumentStore {
  private documents: TechDocument[] = [];
  list(): readonly TechDocument[] { return this.documents; }
  add(doc: TechDocument): void { this.documents.unshift(doc); }
  remove(id: string): number {
    this.documents = this.documents.filter(d => d.id !== id);
    return this.documents.length;
  }
}

class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';
  constructor(private readonly response: GenerateResult) {}

  async generate(): Promise<Result<GenerateResult, ProviderError>> {
    return Ok(this.response);
  }
  async *stream(): AsyncIterable<StreamChunk> {
    if (this.response.text) {
      const mid = Math.ceil(this.response.text.length / 2);
      yield { type: 'text', textDelta: this.response.text.slice(0, mid) };
      yield { type: 'text', textDelta: this.response.text.slice(mid) };
    }
    yield { type: 'done' };
  }
  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

const testConfig: AppConfig = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'development',
  dataDir: '/tmp/data',
  sessionsDir: '/tmp/data/sessions',
  documentsFile: '/tmp/data/documents.json',
  llm: {
    provider: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-3.6-flash',
    embeddingModel: 'text-embedding-004',
    defaultTemperature: 1,
    maxOutputTokens: 8192
  },
  upload: { maxFileSizeBytes: 20 * 1024 * 1024 },
  documents: { watchDir: undefined },
  search: { rerankEnabled: false, bm25Weight: 0.5, embeddingWeight: 0.5 },
  logging: { level: 'info', logPrompts: false, logDir: '/tmp/data/logs' },
  reflection: { enabled: false, maxIterations: 2, confidenceThreshold: 0.6 },
  memory: { researchCacheTtlMs: 86400000 },
  standby: { pollIntervalMs: 15000, maxWaitMs: 0 }
};

const tempDirs: string[] = [];

function buildApp(llmResponse: GenerateResult) {
  const documentStore = new InMemoryDocumentStore();
  const documentService = new DocumentService(documentStore as any);
  const llmProvider = new FakeLLMProvider(llmResponse);
  const toolRegistry = createToolRegistry();
  const toolExecutor = createToolExecutor(toolRegistry);
  const toolService = new ToolService(toolRegistry, toolExecutor, documentService, llmProvider);
  const plannerService = new PlannerService(llmProvider, documentService);
  const executionService = new ExecutionService(llmProvider, toolService, documentService);

  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-sessions-'));
  tempDirs.push(sessionsDir);
  const sessionService = new SessionService(new SessionStore(sessionsDir));

  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-memory-'));
  tempDirs.push(memoryDir);
  const memoryService = new MemoryService(memoryDir, 60_000);

  const reflectionService = new ReflectionService(llmProvider);
  const researchPipeline = new ResearchPipeline(
    plannerService,
    executionService,
    sessionService,
    llmProvider,
    reflectionService,
    testConfig.reflection
  );

  const app = express();
  app.use(express.json());
  app.use(createApiRouter({ config: testConfig, documentService, toolService, sessionService, researchPipeline, memoryService }));
  return { app, sessionService };
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('POST /api/research/run (SSE)', () => {
  it('returns 400 when userPrompt is missing', async () => {
    const { app } = buildApp({ text: '{}' });
    const res = await request(app).post('/api/research/run').send({});
    expect(res.status).toBe(400);
  });

  it('streams progress/session/token/report events and completes a plan with no steps', async () => {
    // An empty instructionSet skips the per-step loop entirely (tool-selection/analysis need a
    // shape-specific canned response this single-response fake can't provide) and goes straight
    // to streaming synthesis, still exercising the full plan -> session -> SSE -> synthesis path.
    const planJson = JSON.stringify({
      title: 'Streamed Session',
      researchGoal: 'Investigate Y',
      instructionSet: []
    });
    const { app } = buildApp({ text: planJson });

    const res = await request(app)
      .post('/api/research/run')
      .send({ userPrompt: 'Test prompt', docIds: [], activeAgentIds: ['literature'] });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: progress');
    expect(res.text).toContain('event: session');
    expect(res.text).toContain('event: token');
    expect(res.text).toContain('event: report');
    expect(res.text).toMatch(/"phase":"finished"/);
  });
});

describe('POST /api/research/resume/:sessionId (SSE)', () => {
  it('continues a paused session with an empty instructionSet straight to synthesis', async () => {
    const { app, sessionService } = buildApp({ text: 'Resumed report body.' });

    const metadata = sessionService.create({
      title: 'Paused Session',
      userPrompt: 'Investigate Y',
      selectedDocIds: [],
      executionMode: 'auto'
    });
    sessionService.save(metadata.id, {
      instructionSet: [],
      agents: {},
      logs: [],
      agentOutputs: {},
      currentStepIndex: 0,
      status: 'paused'
    } as any);

    const res = await request(app).post(`/api/research/resume/${metadata.id}`).send({});

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: session');
    expect(res.text).toContain('event: report');
    expect(res.text).toMatch(/"phase":"finished"/);
  });

  it('returns a session error event for an unknown sessionId', async () => {
    const { app } = buildApp({ text: '{}' });
    const res = await request(app).post('/api/research/resume/does-not-exist').send({});
    expect(res.status).toBe(200);
    expect(res.text).toContain('event: error');
  });
});

describe('PATCH /api/sessions/:id/instruction-set', () => {
  it('persists an edited instructionSet and currentStepIndex', async () => {
    const { app, sessionService } = buildApp({ text: '{}' });
    const metadata = sessionService.create({
      title: 'Editable Session',
      userPrompt: 'Investigate Y',
      selectedDocIds: [],
      executionMode: 'auto'
    });

    const res = await request(app)
      .patch(`/api/sessions/${metadata.id}/instruction-set`)
      .send({ currentStepIndex: 2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const loaded = sessionService.load(metadata.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value.history.currentStepIndex).toBe(2);
  });

  it('returns 400 when instructionSet is not an array', async () => {
    const { app, sessionService } = buildApp({ text: '{}' });
    const metadata = sessionService.create({
      title: 'Editable Session',
      userPrompt: 'Investigate Y',
      selectedDocIds: [],
      executionMode: 'auto'
    });

    const res = await request(app)
      .patch(`/api/sessions/${metadata.id}/instruction-set`)
      .send({ instructionSet: 'not-an-array' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/mcp/tools', () => {
  it('returns the 10 registered display tools', async () => {
    const { app } = buildApp({ text: '{}' });
    const res = await request(app).get('/api/mcp/tools');
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(10);
  });
});
