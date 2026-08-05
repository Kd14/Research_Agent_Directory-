import { useEffect, useReducer, useRef } from 'react';
import * as api from '../services/api';
import { streamSse } from '../services/sse';
import { initialResearchState, researchReducer, type ResearchAction } from '../state/researchReducer';
import type { InstructionStep } from '../types';

type SessionEventKind = 'STREAM_SESSION_CREATED' | 'STREAM_RESUMED';

async function consumeStream(
  url: string,
  body: unknown,
  dispatch: React.Dispatch<ResearchAction>,
  sessionEventKind: SessionEventKind,
  signal: AbortSignal
): Promise<void> {
  const events = streamSse(url, body, signal);
  for await (const { event, data } of events) {
    switch (event) {
      case 'progress':
        dispatch({ type: 'STREAM_PROGRESS', phase: data.phase, message: data.message, stepIndex: data.stepIndex, stepTitle: data.stepTitle });
        if (data.phase === 'error') {
          dispatch({ type: 'STREAM_ERROR', error: data.message });
        }
        break;
      case 'session':
        if (sessionEventKind === 'STREAM_RESUMED') {
          dispatch({
            type: 'STREAM_RESUMED',
            session: data,
            agentOutputs: data.agentOutputs || {},
            currentStepIndex: data.currentStepIndex || 0
          });
        } else {
          dispatch({ type: 'STREAM_SESSION_CREATED', session: data });
        }
        break;
      case 'step_result':
        dispatch({
          type: 'STREAM_STEP_RESULT',
          stepIndex: data.stepIndex,
          agentId: data.agentId,
          thoughtTrace: data.thoughtTrace || [],
          agentOutput: data.agentOutput,
          keyTakeaways: data.keyTakeaways || [],
          toolCallUsed: data.toolCallUsed,
          toolArgs: data.toolArgs,
          toolResult: data.toolResult,
          citations: data.citations
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
}

// Single orchestration hook driving the SSE-native ResearchPipeline (server/orchestration/ResearchPipeline.ts)
// end-to-end: fresh runs, cancel-as-pause, resume-from-persisted-state, and the instruction-set
// edits a paused session needs before resuming. Supersedes the old request/response polling hook.
export function useResearchPipeline() {
  const [state, dispatch] = useReducer(researchReducer, initialResearchState);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const run = async (userPrompt: string, docIds: string[], activeAgentIds: string[], reflectionEnabled?: boolean) => {
    if (!userPrompt.trim()) return;

    dispatch({ type: 'STREAM_STARTED' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await consumeStream('/api/research/run', { userPrompt, docIds, activeAgentIds, reflectionEnabled }, dispatch, 'STREAM_SESSION_CREATED', controller.signal);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('SSE stream error:', err);
      dispatch({ type: 'STREAM_ERROR', error: err.message || 'Failed to reach the research server. Is it running?' });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const resume = async (sessionId: string) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await consumeStream(`/api/research/resume/${sessionId}`, {}, dispatch, 'STREAM_RESUMED', controller.signal);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('SSE resume error:', err);
      dispatch({ type: 'STREAM_ERROR', error: err.message || 'Failed to reach the research server. Is it running?' });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const cancel = () => {
    abortControllerRef.current?.abort();
  };

  const togglePause = () => {
    if (!state.session) return;
    if (state.isPaused) {
      resume(state.session.id);
    } else {
      cancel();
      dispatch({ type: 'TOGGLE_PAUSE' });
    }
  };

  const persistInstructionSet = (instructionSet: InstructionStep[]) => {
    if (!state.session) return;
    dispatch({ type: 'SET_INSTRUCTION_SET', instructionSet });
    api.patchInstructionSet(state.session.id, { instructionSet }).catch(err => {
      console.error('Failed to persist instruction set edit:', err);
    });
  };

  const updateStep = (step: InstructionStep) => {
    if (!state.session) return;
    persistInstructionSet(state.session.instructionSet.map(s => (s.id === step.id ? step : s)));
  };

  const addStep = (step: InstructionStep) => {
    if (!state.session) return;
    persistInstructionSet([...state.session.instructionSet, step]);
  };

  const deleteStep = (stepId: string) => {
    if (!state.session) return;
    persistInstructionSet(state.session.instructionSet.filter(s => s.id !== stepId));
  };

  // Reruns a single step (optionally with injected human feedback merged into its instruction) by
  // seeking the persisted currentStepIndex back to it and resuming - the SSE pipeline always runs
  // forward from currentStepIndex through synthesis, so this replays that step and everything after.
  const executeStepManual = async (index: number, feedback?: string) => {
    if (!state.session) return;

    let instructionSet = state.session.instructionSet;
    if (feedback) {
      instructionSet = instructionSet.map((s, i) => (i === index ? { ...s, userNotes: feedback } : s));
      dispatch({ type: 'SET_INSTRUCTION_SET', instructionSet });
    }

    try {
      await api.patchInstructionSet(state.session.id, {
        ...(feedback ? { instructionSet } : {}),
        currentStepIndex: index
      });
    } catch (err) {
      console.error('Failed to seek to step before resuming:', err);
    }

    resume(state.session.id);
  };

  const clearLogs = () => dispatch({ type: 'CLEAR_LOGS' });
  const dismissError = () => dispatch({ type: 'DISMISS_ERROR' });
  const resetSession = () => {
    cancel();
    dispatch({ type: 'RESET' });
  };

  return {
    ...state,
    run,
    cancel,
    resume,
    togglePause,
    updateStep,
    addStep,
    deleteStep,
    executeStepManual,
    clearLogs,
    dismissError,
    resetSession
  };
}
