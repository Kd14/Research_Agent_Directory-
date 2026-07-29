export interface SseEvent {
  readonly event: string;
  readonly data: any;
}

// Hand-rolled SSE parser instead of native EventSource: EventSource is GET-only and can't carry a
// JSON body, but the research pipeline needs one (userPrompt/docIds/activeAgentIds). Fetch + a
// manually-parsed ReadableStream keeps the wire format standard SSE while supporting POST, and
// gives cancellation for free via the same AbortSignal already passed to fetch.
export async function* streamSse(url: string, body: unknown, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        let event = 'message';
        const dataLines: string[] = [];
        for (const line of rawFrame.split('\n')) {
          if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trim());
          }
          // Lines starting with ':' are comments (heartbeats) - ignored.
        }

        if (dataLines.length === 0) continue;
        try {
          yield { event, data: JSON.parse(dataLines.join('\n')) };
        } catch (err) {
          console.error('Failed to parse SSE frame:', err);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
