// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamSse } from './sse';

function makeSseResponse(frames: string[], ok = true, status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    }
  });
  return new Response(stream, { status: ok ? status : 500 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('streamSse', () => {
  it('parses event/data frames split across multiple chunks', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeSseResponse([
        'event: progress\ndata: {"phase":"planning"}\n\n',
        'event: session\ndata: {"id":"session_1"}\n\n'
      ])
    );

    const events = [];
    for await (const evt of streamSse('/api/research/run', { userPrompt: 'x' })) {
      events.push(evt);
    }

    expect(events).toEqual([
      { event: 'progress', data: { phase: 'planning' } },
      { event: 'session', data: { id: 'session_1' } }
    ]);
  });

  it('reassembles a frame split mid-line across chunk boundaries', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeSseResponse(['event: tok', 'en\ndata: {"textDelta":"hi"}', '\n\n'])
    );

    const events = [];
    for await (const evt of streamSse('/api/research/run', {})) {
      events.push(evt);
    }

    expect(events).toEqual([{ event: 'token', data: { textDelta: 'hi' } }]);
  });

  it('ignores heartbeat comment lines', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeSseResponse([': ping\n\nevent: done\ndata: {"ok":true}\n\n'])
    );

    const events = [];
    for await (const evt of streamSse('/api/research/run', {})) {
      events.push(evt);
    }

    expect(events).toEqual([{ event: 'done', data: { ok: true } }]);
  });

  it('throws when the response is not ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(makeSseResponse([], false, 500));

    await expect(async () => {
      for await (const _ of streamSse('/api/research/run', {})) {
        // no-op
      }
    }).rejects.toThrow();
  });
});
