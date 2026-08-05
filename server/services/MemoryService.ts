import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultAgentIds?: string[];
  reflectionEnabled?: boolean;
}

export interface ToolSequenceRecord {
  readonly instruction: string;
  readonly tools: string[];
  readonly recordedAt: string;
}

interface PromptUsageEntry {
  count: number;
  lastUsedAt: string;
}

interface CachedResultEntry {
  readonly value: unknown;
  readonly cachedAt: number;
}

const MAX_TOOL_SEQUENCE_RECORDS = 500;

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}, using default:`, err);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Failed to persist ${filePath}:`, err);
  }
}

function cacheKeyFor(toolName: string, args: unknown): string {
  const argKeys = args && typeof args === 'object' ? Object.keys(args as Record<string, unknown>).sort() : undefined;
  const normalized = JSON.stringify(args, argKeys);
  return crypto.createHash('sha256').update(`${toolName}::${normalized}`).digest('hex');
}

// Flat-JSON, single-writer persistence (same pattern as DocumentStore/EmbeddingCache) under
// data/memory/ - no DB, matches this app's local-first constraints. Four independent concerns
// (preferences, tool-sequence log, prompt usage counters, cached tool results) each get their own
// file so one growing unboundedly doesn't risk corrupting the others.
export class MemoryService {
  private preferences: UserPreferences;
  private toolSequences: ToolSequenceRecord[];
  private promptUsage: Record<string, PromptUsageEntry>;
  private cache: Record<string, CachedResultEntry>;

  private readonly preferencesFile: string;
  private readonly toolSequencesFile: string;
  private readonly promptUsageFile: string;
  private readonly cacheFile: string;

  constructor(memoryDir: string, private readonly cacheTtlMs: number) {
    this.preferencesFile = path.join(memoryDir, 'preferences.json');
    this.toolSequencesFile = path.join(memoryDir, 'tool_sequences.json');
    this.promptUsageFile = path.join(memoryDir, 'prompt_usage.json');
    this.cacheFile = path.join(memoryDir, 'research_cache.json');

    this.preferences = readJsonFile(this.preferencesFile, {} as UserPreferences);
    this.toolSequences = readJsonFile(this.toolSequencesFile, [] as ToolSequenceRecord[]);
    this.promptUsage = readJsonFile(this.promptUsageFile, {} as Record<string, PromptUsageEntry>);
    this.cache = readJsonFile(this.cacheFile, {} as Record<string, CachedResultEntry>);
  }

  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  savePreferences(patch: Partial<UserPreferences>): UserPreferences {
    this.preferences = { ...this.preferences, ...patch };
    writeJsonFile(this.preferencesFile, this.preferences);
    return this.getPreferences();
  }

  /** Best-effort log of "this tool sequence resolved this instruction successfully" - not yet
   *  consumed anywhere, but the raw material for Phase K's Prompt Library/Playground to learn from. */
  recordToolSequenceSuccess(instruction: string, tools: readonly string[]): void {
    this.toolSequences.push({ instruction, tools: [...tools], recordedAt: new Date().toISOString() });
    if (this.toolSequences.length > MAX_TOOL_SEQUENCE_RECORDS) {
      this.toolSequences = this.toolSequences.slice(-MAX_TOOL_SEQUENCE_RECORDS);
    }
    writeJsonFile(this.toolSequencesFile, this.toolSequences);
  }

  listToolSequences(): readonly ToolSequenceRecord[] {
    return this.toolSequences;
  }

  recordPromptUsage(promptName: string): void {
    const existing = this.promptUsage[promptName];
    this.promptUsage[promptName] = { count: (existing?.count || 0) + 1, lastUsedAt: new Date().toISOString() };
    writeJsonFile(this.promptUsageFile, this.promptUsage);
  }

  getPromptUsage(promptName: string): { count: number; lastUsedAt: string } | undefined {
    return this.promptUsage[promptName];
  }

  getCachedToolResult(toolName: string, args: unknown): unknown | undefined {
    const key = cacheKeyFor(toolName, args);
    const entry = this.cache[key];
    if (!entry) return undefined;

    if (Date.now() - entry.cachedAt > this.cacheTtlMs) {
      delete this.cache[key];
      writeJsonFile(this.cacheFile, this.cache);
      return undefined;
    }
    return entry.value;
  }

  setCachedToolResult(toolName: string, args: unknown, value: unknown): void {
    const key = cacheKeyFor(toolName, args);
    this.cache[key] = { value, cachedAt: Date.now() };
    writeJsonFile(this.cacheFile, this.cache);
  }
}
