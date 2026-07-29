import { useEffect, useReducer, useRef } from 'react';
import * as api from '../services/api';
import { initialResearchState, researchReducer } from '../state/researchReducer';
import type { InstructionStep, ResearchSession } from '../types';

export interface ResumedSessionInfo {
  readonly selectedDocIds: string[];
  readonly userPrompt: string;
  readonly hasReport: boolean;
}

export function useResearchSession(
  selectedDocIds: string[],
  selectedAgentIds: string[],
  onReportReady: () => void
) {
  const [state, dispatch] = useReducer(researchReducer, initialResearchState);

  // Guards against re-entrant execution: `session` changes (agent status/log
  // updates) fire mid-step, and without these the effect below would kick
  // off duplicate concurrent runs of the same step/synthesis call.
  const inFlightStepRef = useRef<number | null>(null);
  const synthesisInFlightRef = useRef<boolean>(false);

  const handleSynthesizeReport = async () => {
    if (!state.session) return;

    dispatch({
      type: 'UPDATE_AGENT',
      agentId: 'synthesis',
      updates: { status: 'analyzing', thoughtTrace: ['Lead Orchestrator compiling final Markdown Research Report...'] }
    });

    dispatch({
      type: 'ADD_LOG',
      entry: {
        id: `log_${Date.now()}_syn`,
        timestamp: new Date().toLocaleTimeString(),
        agentId: 'lead',
        agentName: 'Dr. Astra (Lead Orchestrator)',
        type: 'orchestrator_decision',
        message: 'All instruction steps finalized. Compiling final synthesized report with Mermaid diagrams.',
        level: 'info'
      }
    });

    try {
      const data = await api.synthesizeReport(
        state.session.userPrompt,
        state.session.instructionSet,
        state.agentOutputs,
        selectedDocIds,
        state.session.id
      );

      if (!data.success) {
        throw new Error(data.error || 'Report synthesis failed');
      }

      dispatch({ type: 'SYNTHESIS_SUCCEEDED', report: data.report });
      dispatch({ type: 'UPDATE_AGENT', agentId: 'synthesis', updates: { status: 'completed', progress: 100 } });
      onReportReady();

      dispatch({
        type: 'ADD_LOG',
        entry: {
          id: `log_${Date.now()}_complete`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'synthesis',
          agentName: 'Agent Nexus',
          type: 'agent_message',
          message: 'Final research report generated and published to report view.',
          level: 'success'
        }
      });
    } catch (err: any) {
      console.error('Synthesis error:', err);
      dispatch({ type: 'UPDATE_AGENT', agentId: 'synthesis', updates: { status: 'error' } });
      dispatch({ type: 'SYNTHESIS_FAILED', error: err.message || 'Report synthesis failed' });
      synthesisInFlightRef.current = false;
    }
  };

  const executeStep = async (stepIdx: number, userFeedback?: string) => {
    if (!state.session) return;
    if (inFlightStepRef.current === stepIdx) return;
    const currentStep = state.session.instructionSet[stepIdx];
    if (!currentStep) return;

    inFlightStepRef.current = stepIdx;
    const agentId = currentStep.assignedAgentId;

    dispatch({
      type: 'UPDATE_AGENT',
      agentId,
      updates: {
        status: 'analyzing',
        thoughtTrace: [`Executing Step ${stepIdx + 1}: ${currentStep.title}`, `Directive: ${currentStep.instruction}`]
      }
    });

    dispatch({
      type: 'ADD_LOG',
      entry: {
        id: `log_${Date.now()}_start`,
        timestamp: new Date().toLocaleTimeString(),
        agentId,
        agentName: `${currentStep.agentName}`,
        type: userFeedback ? 'user_intervention' : 'agent_message',
        message: `Initiating research step: "${currentStep.title}"`,
        details: userFeedback ? `Human Feedback: ${userFeedback}` : undefined,
        level: 'info'
      }
    });

    try {
      if (currentStep.requiredTools.length > 0) {
        dispatch({ type: 'SET_ACTIVE_TOOL_CALL', toolCall: { toolName: currentStep.requiredTools[0], agentId } });
      }

      const data = await api.executeResearchStep(currentStep, selectedDocIds, userFeedback, state.session.id);

      if (!data.success) {
        throw new Error(data.error || 'Agent step execution failed');
      }

      if (data.toolCallUsed) {
        dispatch({
          type: 'ADD_LOG',
          entry: {
            id: `log_${Date.now()}_tool`,
            timestamp: new Date().toLocaleTimeString(),
            agentId,
            agentName: currentStep.agentName,
            type: 'mcp_tool_call',
            toolName: data.toolCallUsed,
            args: data.toolArgs,
            result: data.toolResult,
            message: `Invoked MCP tool ${data.toolCallUsed}`,
            level: 'mcp_tool'
          }
        });
      }

      dispatch({ type: 'SET_AGENT_OUTPUT', stepId: currentStep.id, output: data.agentOutput });

      dispatch({
        type: 'UPDATE_AGENT',
        agentId,
        updates: {
          status: 'completed',
          progress: 100,
          output: data.agentOutput,
          thoughtTrace: data.thoughtTrace || ['Step completed successfully.']
        }
      });

      dispatch({ type: 'UPDATE_STEP_RESULT', stepIdx, outputSummary: data.keyTakeaways?.join('; ') });

      dispatch({
        type: 'ADD_LOG',
        entry: {
          id: `log_${Date.now()}_done`,
          timestamp: new Date().toLocaleTimeString(),
          agentId,
          agentName: currentStep.agentName,
          type: 'agent_message',
          message: `Step ${stepIdx + 1} finalized: ${data.keyTakeaways?.[0] || 'Analysis complete.'}`,
          level: 'success'
        }
      });

      dispatch({ type: 'SET_ACTIVE_TOOL_CALL', toolCall: undefined });

      // Delay slightly for smooth visual progression
      setTimeout(() => {
        inFlightStepRef.current = null;
        if (!state.isPaused) {
          dispatch({ type: 'ADVANCE_STEP' });
        }
      }, 1200);
    } catch (err: any) {
      console.error('Step execution error:', err);
      dispatch({ type: 'UPDATE_AGENT', agentId, updates: { status: 'error' } });
      dispatch({ type: 'STEP_FAILED', error: err.message || 'Agent step execution failed' });
      inFlightStepRef.current = null;
    }
  };

  // Automatic Step Execution Loop
  useEffect(() => {
    if (!state.isExecuting || state.isPaused || !state.session) return;

    const steps = state.session.instructionSet;
    if (state.currentStepIndex >= steps.length) {
      // All steps completed -> Synthesize Final Report
      if (!synthesisInFlightRef.current) {
        synthesisInFlightRef.current = true;
        handleSynthesizeReport();
      }
      return;
    }

    if (inFlightStepRef.current === state.currentStepIndex) return;
    executeStep(state.currentStepIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isExecuting, state.isPaused, state.currentStepIndex, state.session]);

  const startResearch = async (targetPrompt: string) => {
    if (!targetPrompt.trim()) return;

    dispatch({ type: 'PLAN_STARTED' });
    inFlightStepRef.current = null;
    synthesisInFlightRef.current = false;

    try {
      const data = await api.planResearch(targetPrompt, selectedDocIds, selectedAgentIds);
      if (data.session) {
        dispatch({ type: 'PLAN_SUCCEEDED', session: data.session });
      } else {
        dispatch({ type: 'PLAN_FAILED', error: data.error || 'Failed to create research plan.' });
      }
    } catch (err) {
      console.error('Failed to create research plan:', err);
      dispatch({ type: 'PLAN_FAILED', error: 'Failed to reach the research server. Is it running?' });
    } finally {
      dispatch({ type: 'PLAN_SETTLED' });
    }
  };

  const executeStepManual = (idx: number, feedback?: string) => {
    dispatch({ type: 'SET_STEP_INDEX', index: idx });
    dispatch({ type: 'SET_EXECUTING', executing: true });
    dispatch({ type: 'SET_PAUSED', paused: false });
    executeStep(idx, feedback);
  };

  const resetSession = () => {
    dispatch({ type: 'RESET' });
    inFlightStepRef.current = null;
    synthesisInFlightRef.current = false;
  };

  const resumeSession = async (sessionId: string): Promise<ResumedSessionInfo | undefined> => {
    try {
      const data = await api.loadSession(sessionId);
      if (!data.success) {
        dispatch({ type: 'PLAN_FAILED', error: data.error || 'Failed to load session.' });
        return undefined;
      }

      const { metadata, history, report } = data;
      inFlightStepRef.current = null;
      synthesisInFlightRef.current = metadata.status === 'completed';

      const session: ResearchSession = {
        id: metadata.id,
        title: metadata.title,
        userPrompt: metadata.userPrompt,
        selectedDocIds: metadata.selectedDocIds,
        executionMode: metadata.executionMode,
        currentStepIndex: history.currentStepIndex,
        instructionSet: history.instructionSet,
        status: metadata.status,
        finalReport: report,
        logs: history.logs,
        agents: history.agents,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt
      };

      dispatch({
        type: 'RESUMED',
        session,
        agentOutputs: history.agentOutputs || {},
        currentStepIndex: history.currentStepIndex || 0,
        isExecuting: metadata.status !== 'completed' && metadata.status !== 'error',
        isPaused: metadata.status === 'paused'
      });

      return { selectedDocIds: metadata.selectedDocIds || [], userPrompt: metadata.userPrompt, hasReport: Boolean(report) };
    } catch (err) {
      console.error('Failed to resume session:', err);
      dispatch({ type: 'PLAN_FAILED', error: 'Failed to reach the research server. Is it running?' });
      return undefined;
    }
  };

  const updateStep = (step: InstructionStep) => dispatch({ type: 'UPDATE_STEP', step });
  const addStep = (step: InstructionStep) => dispatch({ type: 'ADD_STEP', step });
  const deleteStep = (stepId: string) => dispatch({ type: 'DELETE_STEP', stepId });
  const clearLogs = () => dispatch({ type: 'CLEAR_LOGS' });
  const dismissError = () => dispatch({ type: 'DISMISS_ERROR' });
  const togglePause = () => dispatch({ type: 'TOGGLE_PAUSE' });

  return {
    ...state,
    startResearch,
    executeStepManual,
    resetSession,
    resumeSession,
    updateStep,
    addStep,
    deleteStep,
    clearLogs,
    dismissError,
    togglePause
  };
}
