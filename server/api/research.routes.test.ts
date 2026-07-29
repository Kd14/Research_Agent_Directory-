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
import { ResearchService } from '../services/ResearchService';
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
  logging: { level: 'info', logPrompts: false, logDir: '/tmp/data/logs' }
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

  const researchService = new ResearchService(plannerService, executionService, sessionService);
  const researchPipeline = new ResearchPipeline(plannerService, executionService, sessionService, llmProvider);

  const app = express();
  app.use(express.json());
  app.use(createApiRouter({ config: testConfig, documentService, toolService, researchService, sessionService, researchPipeline }));
  return app;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('POST /api/research/plan', () => {
  it('returns 400 when userPrompt is missing', async () => {
    const app = buildApp({ text: '{}' });
    const res = await request(app).post('/api/research/plan').send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 with a session shape on success', async () => {
    const planJson = JSON.stringify({
      title: 'Test Session',
      researchGoal: 'Investigate X',
      instructionSet: [
        {
          stepNumber: 1,
          assignedAgentId: 'literature',
          agentName: 'Agent Hypatia',
          title: 'Step 1',
          instruction: 'Do research',
          requiredTools: ['mcp_doc_search']
        }
      ]
    });
    const app = buildApp({ text: planJson });
    const res = await request(app)
      .post('/api/research/plan')
      .send({ userPrompt: 'Test prompt', docIds: [], activeAgentIds: ['literature'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.session.title).toBe('Test Session');
    expect(res.body.session.instructionSet).toHaveLength(1);
    expect(res.body.session.id).toMatch(/^session_/);
  });

  it('returns a 502 when the provider fails', async () => {
    const app = buildApp({ text: 'not valid json' });
    const res = await request(app)
      .post('/api/research/plan')
      .send({ userPrompt: 'Test prompt' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/research/execute-step', () => {
  it('returns 400 when step is missing', async () => {
    const app = buildApp({ text: '{}' });
    const res = await request(app).post('/api/research/execute-step').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/research/run (SSE)', () => {
  it('returns 400 when userPrompt is missing', async () => {
    const app = buildApp({ text: '{}' });
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
    const app = buildApp({ text: planJson });

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

describe('GET /api/mcp/tools', () => {
  it('returns the 6 registered tools', async () => {
    const app = buildApp({ text: '{}' });
    const res = await request(app).get('/api/mcp/tools');
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(6);
  });
});
