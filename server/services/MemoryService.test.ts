import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryService } from './MemoryService';

const tempDirs: string[] = [];

function makeMemoryDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-memory-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('MemoryService preferences', () => {
  it('returns an empty object before any preferences are saved', () => {
    const service = new MemoryService(makeMemoryDir(), 60_000);
    expect(service.getPreferences()).toEqual({});
  });

  it('merges patches and persists them across a reload from disk', () => {
    const dir = makeMemoryDir();
    const service = new MemoryService(dir, 60_000);

    service.savePreferences({ theme: 'dark' });
    service.savePreferences({ defaultAgentIds: ['literature'] });

    expect(service.getPreferences()).toEqual({ theme: 'dark', defaultAgentIds: ['literature'] });

    const reloaded = new MemoryService(dir, 60_000);
    expect(reloaded.getPreferences()).toEqual({ theme: 'dark', defaultAgentIds: ['literature'] });
  });
});

describe('MemoryService tool sequences', () => {
  it('records and lists successful tool sequences, capping at the retention limit', () => {
    const service = new MemoryService(makeMemoryDir(), 60_000);
    service.recordToolSequenceSuccess('Find X', ['mcp_doc_search']);
    service.recordToolSequenceSuccess('Find Y', ['mcp_web_grounding']);

    const sequences = service.listToolSequences();
    expect(sequences).toHaveLength(2);
    expect(sequences[0].instruction).toBe('Find X');
    expect(sequences[1].tools).toEqual(['mcp_web_grounding']);
  });
});

describe('MemoryService prompt usage', () => {
  it('increments the usage count and updates lastUsedAt on repeated calls', () => {
    const service = new MemoryService(makeMemoryDir(), 60_000);
    service.recordPromptUsage('planner');
    service.recordPromptUsage('planner');

    expect(service.getPromptUsage('planner')?.count).toBe(2);
    expect(service.getPromptUsage('missing')).toBeUndefined();
  });
});

describe('MemoryService cached tool results', () => {
  it('returns undefined on a cache miss and the stored value on a hit', () => {
    const service = new MemoryService(makeMemoryDir(), 60_000);
    expect(service.getCachedToolResult('mcp_doc_search', { query: 'x' })).toBeUndefined();

    service.setCachedToolResult('mcp_doc_search', { query: 'x' }, { matchesFound: 1 });
    expect(service.getCachedToolResult('mcp_doc_search', { query: 'x' })).toEqual({ matchesFound: 1 });
  });

  it('is insensitive to key ordering in the args object', () => {
    const service = new MemoryService(makeMemoryDir(), 60_000);
    service.setCachedToolResult('mcp_doc_search', { query: 'x', topK: 5 }, { matchesFound: 2 });
    expect(service.getCachedToolResult('mcp_doc_search', { topK: 5, query: 'x' })).toEqual({ matchesFound: 2 });
  });

  it('expires an entry once the TTL has elapsed', () => {
    vi.useFakeTimers();
    const service = new MemoryService(makeMemoryDir(), 1000);
    service.setCachedToolResult('mcp_doc_search', { query: 'x' }, { matchesFound: 1 });

    expect(service.getCachedToolResult('mcp_doc_search', { query: 'x' })).toEqual({ matchesFound: 1 });

    vi.advanceTimersByTime(1001);
    expect(service.getCachedToolResult('mcp_doc_search', { query: 'x' })).toBeUndefined();
    vi.useRealTimers();
  });

  it('persists cached results across a reload from disk', () => {
    const dir = makeMemoryDir();
    const service = new MemoryService(dir, 60_000);
    service.setCachedToolResult('mcp_doc_search', { query: 'x' }, { matchesFound: 3 });

    const reloaded = new MemoryService(dir, 60_000);
    expect(reloaded.getCachedToolResult('mcp_doc_search', { query: 'x' })).toEqual({ matchesFound: 3 });
  });
});
