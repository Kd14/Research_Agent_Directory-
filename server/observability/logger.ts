import fs from 'fs';
import path from 'path';
import type { AppError } from '../errors/AppError';
import type { Result } from '../result';

export interface LogEntry {
  readonly timestamp: string;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly event: string;
  readonly durationMs?: number;
  readonly tool?: string;
  readonly provider?: string;
  readonly tokens?: { readonly input?: number; readonly output?: number };
  readonly sessionId?: string;
  readonly error?: { readonly name: string; readonly message: string; readonly code?: string };
}

export interface LoggerLike {
  log(entry: Omit<LogEntry, 'timestamp'>): void;
}

// Writes one JSON line per entry to console + data/logs/<YYYY-MM-DD>.jsonl. Never includes prompt
// or response text - only cross-cutting metadata (timing, tokens, tool/provider names, errors).
export class FileLogger implements LoggerLike {
  constructor(private readonly logDir: string) {}

  log(entry: Omit<LogEntry, 'timestamp'>): void {
    const fullEntry: LogEntry = { timestamp: new Date().toISOString(), ...entry };
    const line = JSON.stringify(fullEntry);

    if (fullEntry.level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }

    try {
      if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
      const fileName = `${fullEntry.timestamp.slice(0, 10)}.jsonl`;
      fs.appendFileSync(path.join(this.logDir, fileName), line + '\n');
    } catch (err) {
      console.error('Failed to write log entry to disk:', err);
    }
  }
}

export const noopLogger: LoggerLike = { log: () => {} };

export interface TimingMeta {
  readonly event: string;
  readonly tool?: string;
  readonly provider?: string;
  readonly sessionId?: string;
}

// Wraps a Result-returning async call (our codebase's error convention - Err, not throw) with
// duration + outcome logging. Never includes the prompt/request text passed to fn().
export async function withTiming<T, E extends AppError>(
  logger: LoggerLike,
  meta: TimingMeta,
  fn: () => Promise<Result<T, E>>,
  extractTokens?: (value: T) => { input?: number; output?: number } | undefined
): Promise<Result<T, E>> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;

  if (result.ok) {
    logger.log({
      level: 'info',
      event: meta.event,
      tool: meta.tool,
      provider: meta.provider,
      sessionId: meta.sessionId,
      durationMs,
      tokens: extractTokens?.(result.value)
    });
  } else {
    logger.log({
      level: 'error',
      event: meta.event,
      tool: meta.tool,
      provider: meta.provider,
      sessionId: meta.sessionId,
      durationMs,
      error: { name: result.error.name, message: result.error.message, code: result.error.code }
    });
  }

  return result;
}
