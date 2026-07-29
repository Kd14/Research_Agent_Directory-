import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileLogger, withTiming } from './logger';
import { ProviderError } from '../errors/AppError';
import { Err, Ok } from '../result';

let logDir: string;

beforeEach(() => {
  logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexusagent-logger-'));
});

afterEach(() => {
  fs.rmSync(logDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('FileLogger', () => {
  it('appends one JSON line per entry to a date-named file', () => {
    const logger = new FileLogger(logDir);
    logger.log({ level: 'info', event: 'test_event', durationMs: 42 });

    const files = fs.readdirSync(logDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);

    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.event).toBe('test_event');
    expect(parsed.durationMs).toBe(42);
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('appends multiple entries as separate lines', () => {
    const logger = new FileLogger(logDir);
    logger.log({ level: 'info', event: 'a' });
    logger.log({ level: 'info', event: 'b' });

    const files = fs.readdirSync(logDir);
    const lines = fs.readFileSync(path.join(logDir, files[0]), 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });
});

describe('withTiming', () => {
  it('logs a successful call with duration and extracted tokens', async () => {
    const logEntries: any[] = [];
    const logger = { log: (e: any) => logEntries.push(e) };

    await withTiming(
      logger,
      { event: 'llm_generate', provider: 'gemini' },
      async () => Ok({ text: 'hello', usage: { inputTokens: 10, outputTokens: 5 } }),
      value => ({ input: value.usage?.inputTokens, output: value.usage?.outputTokens })
    );

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].level).toBe('info');
    expect(logEntries[0].event).toBe('llm_generate');
    expect(logEntries[0].tokens).toEqual({ input: 10, output: 5 });
    expect(typeof logEntries[0].durationMs).toBe('number');
  });

  it('logs a failed call with error details, not the raw request', async () => {
    const logEntries: any[] = [];
    const logger = { log: (e: any) => logEntries.push(e) };

    await withTiming(logger, { event: 'llm_generate', provider: 'gemini' }, async () =>
      Err(new ProviderError('rate limited', 'gemini'))
    );

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].level).toBe('error');
    expect(logEntries[0].error).toEqual({ name: 'ProviderError', message: 'rate limited', code: 'PROVIDER_ERROR' });
  });

  it('returns the original result unchanged', async () => {
    const logger = { log: () => {} };
    const result = await withTiming(logger, { event: 'x' }, async () => Ok('value'));
    expect(result).toEqual({ ok: true, value: 'value' });
  });
});
