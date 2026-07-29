import { useReducer, useRef } from 'react';
import { streamSse } from '../services/sse';
import { initialResearchState, researchReducer } from '../state/researchReducer';

export function useResearchStream() {
  const [state, dispatch] = useReducer(researchReducer, initialResearchState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const run = async (userPrompt: string, docIds: string[], activeAgentIds: string[]) => {
    dispatch({ type: 'STREAM_STARTED' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const events = streamSse('/api/research/run', { userPrompt, docIds, activeAgentIds }, controller.signal);
      for await (const { event, data } of events) {
        switch (event) {
          case 'progress':
            dispatch({ type: 'STREAM_PROGRESS', message: data.message });
            if (data.phase === 'error') {
              dispatch({ type: 'STREAM_ERROR', error: data.message });
            }
            break;
          case 'session':
            dispatch({ type: 'STREAM_SESSION_CREATED', session: data });
            break;
          case 'step_result':
            dispatch({
              type: 'STREAM_STEP_RESULT',
              stepIndex: data.stepIndex,
              agentId: data.agentId,
              thoughtTrace: data.thoughtTrace || [],
              agentOutput: data.agentOutput,
              keyTakeaways: data.keyTakeaways || []
            });
            break;
          case 'token':
            dispatch({ type: 'STREAM_TOKEN', textDelta: data.textDelta });
            break;
          case 'report':
            dispatch({ type: 'STREAM_REPORT_DONE', report: data.report });
            break;
          case 'error':
            dispatch({ type: 'STREAM_ERROR', error: data.message || 'Research run failed' });
            break;
          default:
            break;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('SSE stream error:', err);
      dispatch({ type: 'STREAM_ERROR', error: err.message || 'Failed to reach the research server. Is it running?' });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const cancel = () => {
    abortControllerRef.current?.abort();
  };

  return { ...state, run, cancel };
}
