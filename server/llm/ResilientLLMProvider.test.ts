import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import type { GenerateOptions, GenerateResult, LLMProvider, StandbyEvent, StreamChunk } from './LLMProvider';
import { ResilientLLMProvider, isRetryableError } from './ResilientLLMProvider';

class ScriptedProvider implements LLMProvider {
  readonly name = 'fake';
  private generateCalls = 0;
  private streamCalls = 0;

  constructor(
    private readonly generateResults: Result<GenerateResult, ProviderError>[],
    private readonly streamScripts: (StreamChunk[] | Error)[] = []
  ) {}

  async generate(): Promise<Result<GenerateResult, ProviderError>> {
    const result = this.generateResults[Math.min(this.generateCalls, this.generateResults.length - 1)];
    this.generateCalls++;
    return result;
  }

  async *stream(): AsyncIterable<StreamChunk> {
    const script = this.streamScripts[Math.min(this.streamCalls, this.streamScripts.length - 1)];
    this.streamCalls++;
    if (script instanceof Error) throw script;
    for (const chunk of script) yield chunk;
  }

  async countTokens(): Promise<number> { return 0; }
  supportsThinking(): boolean { return false; }
  supportsTools(): boolean { return true; }
}

function retryableError(message = 'got status: 503 Service Unavailable'): ProviderError {
  return new ProviderError(message, 'fake');
}

function permanentError(message = 'API key not valid'): ProviderError {
  return new ProviderError(message, 'fake');
}

describe('isRetryableError', () => {
  it('treats 429/5xx-style messages as retryable', () => {
    expect(isRetryableError(new Error('got status: 429 Too Many Requests'))).toBe(true);
    expect(isRetryableError(new Error('got status: 503 Service Unavailable'))).toBe(true);
    expect(isRetryableError(new Error('rate limit exceeded, please try again later'))).toBe(true);
  });

  it('treats auth/invalid-argument messages as non-retryable', () => {
    expect(isRetryableError(new Error('API key not valid. Please pass a valid API key.'))).toBe(false);
    expect(isRetryableError(new Error('Permission denied on resource'))).toBe(false);
  });

  it('treats errno-style network errors as retryable', () => {
    expect(isRetryableError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' })).toBe(true);
  });

  it('defaults unrecognized error shapes to non-retryable rather than looping forever', () => {
    expect(isRetryableError(new Error('Unexpected token < in JSON at position 0'))).toBe(false);
  });
});

describe('ResilientLLMProvider.generate', () => {
  it('retries a transient failure until it succeeds, notifying standby then resumed', async () => {
    const success: GenerateResult = { text: 'ok' };
    const inner = new ScriptedProvider([Err(retryableError()), Err(retryableError()), Ok(success)]);
    const provider = new ResilientLLMProvider(inner, { pollIntervalMs: 1, maxWaitMs: 0 });

    const events: StandbyEvent[] = [];
    const result = await provider.generate('prompt', { onStandby: e => events.push(e) });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.text).toBe('ok');
    expect(events.map(e => e.status)).toEqual(['entered', 'retrying', 'resumed']);
    expect(events[2].attempt).toBe(2);
  });

  it('fails immediately on a non-retryable error without entering standby', async () => {
    const inner = new ScriptedProvider([Err(permanentError())]);
    const provider = new ResilientLLMProvider(inner, { pollIntervalMs: 1, maxWaitMs: 0 });

    const events: StandbyEvent[] = [];
    const result = await provider.generate('prompt', { onStandby: e => events.push(e) });

    expect(result.ok).toBe(false);
    expect(events).toEqual([]);
  });

  it('gives up once maxWaitMs is exhausted and surfaces the last error', async () => {
    const inner = new ScriptedProvider([Err(retryableError()), Err(retryableError()), Err(retryableError())]);
    // pollIntervalMs (5) run twice already exceeds a 6ms budget, so the third attempt should give up.
    const provider = new ResilientLLMProvider(inner, { pollIntervalMs: 5, maxWaitMs: 6 });

    const events: StandbyEvent[] = [];
    const result = await provider.generate('prompt', { onStandby: e => events.push(e) });

    expect(result.ok).toBe(false);
    expect(events.some(e => e.status === 'gave_up')).toBe(true);
  });

  it('stops standing by as soon as the request is aborted', async () => {
    const inner = new ScriptedProvider([Err(retryableError()), Err(retryableError())]);
    const provider = new ResilientLLMProvider(inner, { pollIntervalMs: 50, maxWaitMs: 0 });
    const controller = new AbortController();

    const events: StandbyEvent[] = [];
    const promise = provider.generate('prompt', { signal: controller.signal, onStandby: e => events.push(e) });
    // Abort mid-standby-wait rather than before the first attempt, so the abort-path in the standby
    // loop (not just "never started") is what's actually exercised.
    await new Promise(r => setTimeout(r, 5));
    controller.abort();

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(events.some(e => e.status === 'gave_up')).toBe(true);
  });
});

describe('ResilientLLMProvider.stream', () => {
  it('retries a failure before any chunk was yielded, then streams normally once available', async () => {
    const inner = new ScriptedProvider([], [
      new Error('got status: 503 Service Unavailable'),
      [{ type: 'text', textDelta: 'hello' }, { type: 'done' }]
    ]);
    const provider = new ResilientLLMProvider(inner, { pollIntervalMs: 1, maxWaitMs: 0 });

    const events: StandbyEvent[] = [];
    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.stream('prompt', { onStandby: e => events.push(e) })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ type: 'text', textDelta: 'hello' }, { type: 'done' }]);
    expect(events.map(e => e.status)).toEqual(['entered', 'resumed']);
  });

  it('does not retry once a chunk has already been yielded - propagates the error as-is', async () => {
    class MidStreamFailingProvider implements LLMProvider {
      readonly name = 'fake';
      async generate(): Promise<Result<GenerateResult, ProviderError>> { return Ok({ text: '' }); }
      async *stream(): AsyncIterable<StreamChunk> {
        yield { type: 'text', textDelta: 'partial' };
        throw retryableError('dropped mid-stream');
      }
      async countTokens(): Promise<number> { return 0; }
      supportsThinking(): boolean { return false; }
      supportsTools(): boolean { return true; }
    }

    const provider = new ResilientLLMProvider(new MidStreamFailingProvider(), { pollIntervalMs: 1, maxWaitMs: 0 });
    const events: StandbyEvent[] = [];
    const chunks: StreamChunk[] = [];

    await expect(async () => {
      for await (const chunk of provider.stream('prompt', { onStandby: e => events.push(e) })) {
        chunks.push(chunk);
      }
    }).rejects.toThrow('dropped mid-stream');

    expect(chunks).toEqual([{ type: 'text', textDelta: 'partial' }]);
    expect(events).toEqual([]);
  });
});
