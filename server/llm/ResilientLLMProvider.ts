import { AppError, type ProviderError } from '../errors/AppError';
import { noopLogger, type LoggerLike } from '../observability/logger';
import type { GenerateOptions, GenerateResult, LLMProvider, StandbyEvent, StreamChunk } from './LLMProvider';
import type { Result } from '../result';

export interface StandbyConfig {
  /** How often to re-check availability while standing by. */
  readonly pollIntervalMs: number;
  /** Total time to keep standing by before giving up and surfacing the error - 0 means retry
   *  indefinitely (still cancellable via GenerateOptions.signal). */
  readonly maxWaitMs: number;
}

const RETRYABLE_HTTP_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const NON_RETRYABLE_HTTP_STATUS = new Set([400, 401, 403, 404, 422]);
const RETRYABLE_ERRNO = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EPIPE']);

// Matched against the error message when no structured status/errno is present. Deliberately
// conservative: an unmatched, unfamiliar-shaped error is treated as NOT retryable (fails fast) so a
// real bug can't be mistaken for a transient outage and silently loop forever on standby.
const RETRYABLE_MESSAGE = /rate.?limit|quota exceeded|overloaded|unavailable|temporarily|fetch failed|network|econnreset|econnrefused|timed?.?out|deadline exceeded|socket hang up|try again|service unavailable|too many requests/i;
const NON_RETRYABLE_MESSAGE = /invalid.api.key|api key not valid|permission.denied|unauthorized|forbidden|not found|invalid.argument|unsupported|bad request/i;

function extractStatus(err: unknown, depth = 0): number | undefined {
  if (!err || typeof err !== 'object' || depth > 3) return undefined;
  // AppError.httpStatus (e.g. ProviderError's is always 502) describes the status WE report to our
  // own API clients, not the upstream provider's actual response - skip straight to the wrapped
  // cause rather than reading it as a signal here.
  if (err instanceof AppError) return extractStatus(err.cause, depth + 1);
  const anyErr = err as Record<string, unknown>;
  for (const key of ['status', 'statusCode']) {
    const value = anyErr[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
  }
  return extractStatus(anyErr.cause, depth + 1);
}

function extractErrno(err: unknown, depth = 0): string | undefined {
  if (!err || typeof err !== 'object' || depth > 3) return undefined;
  const anyErr = err as Record<string, unknown>;
  if (typeof anyErr.code === 'string' && RETRYABLE_ERRNO.has(anyErr.code)) return anyErr.code;
  return extractErrno(anyErr.cause, depth + 1);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Best-effort classification of an LLM call failure as transient (worth standing by and retrying)
 *  vs permanent (a bad API key, an invalid request - retrying would never help). SDK error shapes
 *  aren't perfectly typed, so this inspects status/errno codes first and falls back to message text. */
export function isRetryableError(err: unknown): boolean {
  const status = extractStatus(err);
  if (status !== undefined) {
    if (RETRYABLE_HTTP_STATUS.has(status)) return true;
    if (NON_RETRYABLE_HTTP_STATUS.has(status)) return false;
  }
  if (extractErrno(err)) return true;

  const message = errorMessage(err);
  if (NON_RETRYABLE_MESSAGE.test(message)) return false;
  if (RETRYABLE_MESSAGE.test(message)) return true;
  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Decorates any LLMProvider so every caller - planner, per-step research agents, critic, reviewer,
// synthesis, and any MCP tool that calls the LLM directly (web grounding, hypothesis tester) - gets
// the same "stand by and keep checking" resilience for free, with zero changes to their own logic:
// generate()/stream() still return/yield exactly what the inner provider would, just after
// transparently waiting out a transient outage first. A permanent failure (bad API key, invalid
// request) still fails immediately, same as before this wrapper existed.
export class ResilientLLMProvider implements LLMProvider {
  readonly name: string;

  constructor(
    private readonly inner: LLMProvider,
    private readonly config: StandbyConfig,
    private readonly logger: LoggerLike = noopLogger
  ) {
    this.name = inner.name;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<Result<GenerateResult, ProviderError>> {
    const deadline = this.config.maxWaitMs > 0 ? Date.now() + this.config.maxWaitMs : undefined;
    let attempt = 0;

    while (true) {
      const result = await this.inner.generate(prompt, options);
      if (result.ok) {
        if (attempt > 0) this.notifyResumed(attempt, options);
        return result;
      }
      if (!this.shouldStandBy(result.error, deadline, options)) {
        if (attempt > 0) this.notifyGaveUp(attempt, result.error, options);
        return result;
      }
      attempt++;
      await this.enterStandby(attempt, result.error, options);
    }
  }

  async *stream(prompt: string, options: GenerateOptions = {}): AsyncIterable<StreamChunk> {
    const deadline = this.config.maxWaitMs > 0 ? Date.now() + this.config.maxWaitMs : undefined;
    let attempt = 0;

    while (true) {
      let yieldedAny = false;
      try {
        for await (const chunk of this.inner.stream(prompt, options)) {
          if (!yieldedAny && attempt > 0) this.notifyResumed(attempt, options);
          yieldedAny = true;
          yield chunk;
        }
        return;
      } catch (err) {
        // Once any real output has already streamed to the caller, silently retrying from scratch
        // would duplicate/corrupt what was already sent - only a failure before the FIRST chunk is
        // safe to transparently retry.
        if (yieldedAny || !this.shouldStandBy(err, deadline, options)) {
          if (!yieldedAny && attempt > 0) this.notifyGaveUp(attempt, err, options);
          throw err;
        }
        attempt++;
        await this.enterStandby(attempt, err, options);
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    return this.inner.countTokens(text);
  }

  supportsThinking(): boolean {
    return this.inner.supportsThinking();
  }

  supportsTools(): boolean {
    return this.inner.supportsTools();
  }

  private shouldStandBy(error: unknown, deadline: number | undefined, options: GenerateOptions): boolean {
    if (options.signal?.aborted) return false;
    if (!isRetryableError(error)) return false;
    if (deadline !== undefined && Date.now() >= deadline) return false;
    return true;
  }

  private async enterStandby(attempt: number, error: unknown, options: GenerateOptions): Promise<void> {
    const waitMs = this.config.pollIntervalMs;
    const status: StandbyEvent['status'] = attempt === 1 ? 'entered' : 'retrying';
    const message = `LLM provider "${this.name}" is unavailable (${errorMessage(error)}). Standing by - will re-check in ${Math.round(waitMs / 1000)}s (attempt ${attempt}).`;

    this.logger.log({
      level: 'warn',
      event: status === 'entered' ? 'llm_standby_enter' : 'llm_standby_retry',
      provider: this.name,
      error: { name: 'LLMStandby', message: errorMessage(error), code: `attempt_${attempt}` }
    });
    options.onStandby?.({ status, attempt, nextRetryInMs: waitMs, message });

    await sleep(waitMs, options.signal);
  }

  private notifyResumed(attempt: number, options: GenerateOptions): void {
    const message = `LLM provider "${this.name}" is available again - resuming after ${attempt} standby check${attempt > 1 ? 's' : ''}.`;
    this.logger.log({ level: 'info', event: 'llm_standby_resumed', provider: this.name });
    options.onStandby?.({ status: 'resumed', attempt, message });
  }

  private notifyGaveUp(attempt: number, error: unknown, options: GenerateOptions): void {
    const reason = options.signal?.aborted ? 'the run was cancelled' : 'the standby window expired';
    const message = `Giving up standing by for "${this.name}" after ${attempt} check${attempt > 1 ? 's' : ''} (${reason}): ${errorMessage(error)}`;
    this.logger.log({
      level: 'error',
      event: 'llm_standby_gave_up',
      provider: this.name,
      error: { name: 'LLMStandbyGaveUp', message: errorMessage(error) }
    });
    options.onStandby?.({ status: 'gave_up', attempt, message });
  }
}
