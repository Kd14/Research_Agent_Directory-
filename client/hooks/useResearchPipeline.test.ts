// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResearchPipeline } from './useResearchPipeline';

function makeSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    }
  });
  return new Response(stream, { status: 200 });
}

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const baseSession = {
  id: 'session_1',
  title: 'Streamed',
  userPrompt: 'test',
  selectedDocIds: [],
  executionMode: 'auto',
  currentStepIndex: 0,
  instructionSet: [
    { id: 'step_1', stepNumber: 1, assignedAgentId: 'literature', agentName: 'Agent Hypatia', title: 'Step 1', instruction: 'do it', requiredTools: ['mcp_doc_search'], status: 'pending' }
  ],
  status: 'planning',
  logs: [],
  agents: {
    literature: { id: 'literature', role: 'literature', name: 'Agent Hypatia', title: 'X', avatar: '', description: '', status: 'idle', progress: 0, thoughtTrace: [], toolsAccess: [] }
  },
  createdAt: '',
  updatedAt: ''
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useResearchPipeline', () => {
  it('processes a full run: session -> step_result -> token -> report, with rich logs', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeSseResponse([
        sseFrame('progress', { phase: 'planning', message: 'Planning...' }),
        sseFrame('session', baseSession),
        sseFrame('progress', { phase: 'running_tools', stepIndex: 0, stepTitle: 'Step 1', message: 'Running step 1' }),
        sseFrame('step_result', {
          stepIndex: 0,
          agentId: 'literature',
          thoughtTrace: ['thinking'],
          agentOutput: 'Findings.',
          keyTakeaways: ['takeaway'],
          toolCallUsed: 'mcp_doc_search',
          toolArgs: { query: 'x' },
          toolResult: { hits: [] }
        }),
        sseFrame('progress', { phase: 'synthesizing', message: 'Synthesizing...' }),
        sseFrame('token', { textDelta: 'Hello ' }),
        sseFrame('token', { textDelta: 'world' }),
        sseFrame('report', { report: 'Hello world' }),
        sseFrame('progress', { phase: 'finished', message: 'Done' })
      ])
    );

    const { result } = renderHook(() => useResearchPipeline());

    await act(async () => {
      await result.current.run('test prompt', [], ['literature']);
    });

    expect(result.current.session?.id).toBe('session_1');
    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.agentOutputs['step_1']).toBe('Findings.');
    expect(result.current.session?.finalReport).toBe('Hello world');
    expect(result.current.isExecuting).toBe(false);
    expect(result.current.errorMessage).toBeNull();

    // Rich logs: the running_tools progress frame and the step_result's tool-call/completion frames
    // should all have produced MCPLogEntry rows (parity with the retired polling hook's UX).
    const logTypes = result.current.session?.logs.map(l => l.type) || [];
    expect(logTypes).toContain('mcp_tool_call');
    expect(logTypes).toContain('agent_message');
  });

  it('sets errorMessage and pauses on a server error event', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeSseResponse([sseFrame('error', { message: 'GEMINI_API_KEY missing' })])
    );

    const { result } = renderHook(() => useResearchPipeline());

    await act(async () => {
      await result.current.run('test prompt', [], []);
    });

    await waitFor(() => expect(result.current.errorMessage).toBe('GEMINI_API_KEY missing'));
    expect(result.current.isPaused).toBe(true);
  });

  it('cancel() aborts the in-flight fetch', async () => {
    const abortSpy = vi.fn();
    vi.spyOn(global, 'fetch').mockImplementation((_url, init: any) => {
      init.signal.addEventListener('abort', abortSpy);
      return new Promise(() => {}); // never resolves until aborted
    });

    const { result } = renderHook(() => useResearchPipeline());

    act(() => {
      result.current.run('test prompt', [], []);
    });

    act(() => {
      result.current.cancel();
    });

    await waitFor(() => expect(abortSpy).toHaveBeenCalledTimes(1));
  });

  it('togglePause aborts the stream and flips isPaused without a server round-trip', async () => {
    const abortSpy = vi.fn();
    // A stream that emits the session frame then never closes: the SSE reader's next read() hangs
    // (a genuinely pending promise, not just an unresolved microtask), so the hook's session state
    // is populated and observable before togglePause() is exercised.
    const encoder = new TextEncoder();
    const hangingStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseFrame('session', baseSession)));
      }
    });

    vi.spyOn(global, 'fetch').mockImplementation((_url, init: any) => {
      init.signal.addEventListener('abort', abortSpy);
      return Promise.resolve(new Response(hangingStream, { status: 200 }));
    });

    const { result } = renderHook(() => useResearchPipeline());

    act(() => {
      result.current.run('test prompt', [], []);
    });

    await waitFor(() => expect(result.current.session?.id).toBe('session_1'));

    act(() => {
      result.current.togglePause();
    });

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isPaused).toBe(true);
  });

  it('resume() streams from /api/research/resume/:id and dispatches STREAM_RESUMED', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
      expect(url).toBe('/api/research/resume/session_1');
      return Promise.resolve(
        makeSseResponse([
          sseFrame('session', { ...baseSession, currentStepIndex: 1, agentOutputs: { step_1: 'Findings.' } }),
          sseFrame('progress', { phase: 'synthesizing', message: 'Resuming synthesis...' }),
          sseFrame('report', { report: 'Final report' }),
          sseFrame('progress', { phase: 'finished', message: 'Done' })
        ])
      );
    });

    const { result } = renderHook(() => useResearchPipeline());

    await act(async () => {
      await result.current.resume('session_1');
    });

    expect(result.current.session?.id).toBe('session_1');
    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.agentOutputs['step_1']).toBe('Findings.');
    expect(result.current.session?.finalReport).toBe('Final report');
    expect(result.current.isPaused).toBe(false);
  });

  it('updateStep persists the edited instruction set via PATCH', async () => {
    const fetchMock = vi.fn().mockImplementation((url: any) => {
      if (typeof url === 'string' && url.includes('/instruction-set')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
      }
      return Promise.resolve(makeSseResponse([sseFrame('session', baseSession)]));
    });
    vi.spyOn(global, 'fetch').mockImplementation(fetchMock);

    const { result } = renderHook(() => useResearchPipeline());

    await act(async () => {
      await result.current.run('test prompt', [], []);
    });

    const editedStep = { ...baseSession.instructionSet[0], instruction: 'edited directive' };

    await act(async () => {
      result.current.updateStep(editedStep as any);
    });

    expect(result.current.session?.instructionSet[0].instruction).toBe('edited directive');

    const patchCall = fetchMock.mock.calls.find((c: any[]) => typeof c[0] === 'string' && c[0].includes('/instruction-set'));
    expect(patchCall).toBeDefined();
    expect(patchCall![1].method).toBe('PATCH');
  });
});
