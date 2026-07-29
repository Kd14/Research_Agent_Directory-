// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResearchStream } from './useResearchStream';

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useResearchStream', () => {
  it('processes a full run: session -> step_result -> token -> report', async () => {
    const session = {
      id: 'session_1',
      title: 'Streamed',
      userPrompt: 'test',
      selectedDocIds: [],
      executionMode: 'auto',
      currentStepIndex: 0,
      instructionSet: [
        { id: 'step_1', stepNumber: 1, assignedAgentId: 'literature', agentName: 'Agent Hypatia', title: 'Step 1', instruction: 'do it', requiredTools: [], status: 'pending' }
      ],
      status: 'planning',
      logs: [],
      agents: {
        literature: { id: 'literature', role: 'literature', name: 'Agent Hypatia', title: 'X', avatar: '', description: '', status: 'idle', progress: 0, thoughtTrace: [], toolsAccess: [] }
      },
      createdAt: '',
      updatedAt: ''
    };

    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeSseResponse([
        sseFrame('progress', { phase: 'planning', message: 'Planning...' }),
        sseFrame('session', session),
        sseFrame('progress', { phase: 'running_tools', stepIndex: 0, message: 'Running step 1' }),
        sseFrame('step_result', {
          stepIndex: 0,
          agentId: 'literature',
          thoughtTrace: ['thinking'],
          agentOutput: 'Findings.',
          keyTakeaways: ['takeaway']
        }),
        sseFrame('progress', { phase: 'synthesizing', message: 'Synthesizing...' }),
        sseFrame('token', { textDelta: 'Hello ' }),
        sseFrame('token', { textDelta: 'world' }),
        sseFrame('report', { report: 'Hello world' }),
        sseFrame('progress', { phase: 'finished', message: 'Done' })
      ])
    );

    const { result } = renderHook(() => useResearchStream());

    await act(async () => {
      await result.current.run('test prompt', [], ['literature']);
    });

    expect(result.current.session?.id).toBe('session_1');
    expect(result.current.currentStepIndex).toBe(1);
    expect(result.current.agentOutputs['step_1']).toBe('Findings.');
    expect(result.current.session?.finalReport).toBe('Hello world');
    expect(result.current.isExecuting).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it('sets errorMessage and pauses on a server error event', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      makeSseResponse([sseFrame('error', { message: 'GEMINI_API_KEY missing' })])
    );

    const { result } = renderHook(() => useResearchStream());

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

    const { result } = renderHook(() => useResearchStream());

    act(() => {
      result.current.run('test prompt', [], []);
    });

    act(() => {
      result.current.cancel();
    });

    await waitFor(() => expect(abortSpy).toHaveBeenCalledTimes(1));
  });
});
