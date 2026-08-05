import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TechDocument } from '../../client/types';
import { DocumentService } from './DocumentService';
import { MemoryService } from './MemoryService';
import { ToolService } from './ToolService';
import { createToolExecutor, createToolRegistry } from '../tools';

class InMemoryDocumentStore {
  private documents: TechDocument[] = [];
  list(): readonly TechDocument[] { return this.documents; }
  add(doc: TechDocument): void { this.documents.unshift(doc); }
  remove(id: string): number {
    this.documents = this.documents.filter(d => d.id !== id);
    return this.documents.length;
  }
}

const tempDirs: string[] = [];

function buildToolService(withMemory: boolean) {
  const documentService = new DocumentService(new InMemoryDocumentStore() as any);
  const toolRegistry = createToolRegistry();
  const toolExecutor = createToolExecutor(toolRegistry);
  const llmProvider = {} as any;

  let memoryService: MemoryService | undefined;
  if (withMemory) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-toolservice-memory-'));
    tempDirs.push(dir);
    memoryService = new MemoryService(dir, 60_000);
  }

  const toolService = new ToolService(toolRegistry, toolExecutor, documentService, llmProvider, undefined, undefined, memoryService);
  return { toolService, memoryService };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ToolService.run caching', () => {
  it('does not cache when no MemoryService is configured', async () => {
    const { toolService } = buildToolService(false);
    const first = await toolService.run('mcp_doc_search', { query: 'x' });
    const second = await toolService.run('mcp_doc_search', { query: 'x' });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // No assertion on call-count here since docSearch with no searchIndexService is a pure stub;
    // the point of this test is only that it doesn't throw when memoryService is undefined.
  });

  it('caches a cacheable tool result and replays recorded citations on a hit', async () => {
    const { toolService, memoryService } = buildToolService(true);
    const recordedFirst: unknown[] = [];
    const recordedSecond: unknown[] = [];

    // mcp_doc_search with no searchIndexService returns a stub {matchesFound:0, results:[]} and
    // records no citations - swap in a MemoryService-level pre-seeded cache entry instead so this
    // test exercises the replay path deterministically without needing a real search index.
    memoryService!.setCachedToolResult('mcp_doc_search', { query: 'cached' }, {
      result: { query: 'cached', matchesFound: 1, results: ['stub'] },
      citations: [{ toolName: 'mcp_doc_search', docId: 'doc1', claim: 'cached claim' }]
    });

    const result = await toolService.run('mcp_doc_search', { query: 'cached' }, r => recordedFirst.push(r));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ query: 'cached', matchesFound: 1, results: ['stub'] });
    }
    expect(recordedFirst).toHaveLength(1);
    expect(recordedFirst[0]).toEqual({ toolName: 'mcp_doc_search', docId: 'doc1', claim: 'cached claim' });

    // A second call with a DIFFERENT recordCitation callback should replay the SAME stored
    // citations again (proving they're read from the cache entry, not accumulated globally).
    await toolService.run('mcp_doc_search', { query: 'cached' }, r => recordedSecond.push(r));
    expect(recordedSecond).toHaveLength(1);
  });

  it('does not cache a tool explicitly marked cacheable:false', async () => {
    const { toolService, memoryService } = buildToolService(true);
    const getSpy = vi.spyOn(memoryService!, 'getCachedToolResult');
    const setSpy = vi.spyOn(memoryService!, 'setCachedToolResult');

    // mcp_synthesis_engine is a cacheable:false stub with no Puppeteer/LLM dependency, so it's
    // safe to actually invoke here (unlike mcp_pdf_report_generator, which would spin up a real
    // headless Chromium render).
    await toolService.run('mcp_synthesis_engine', { sections: [] });

    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });
});
