import type { AgentNode, InstructionStep, MCPLogEntry, ResearchSession } from '../types';

export interface ActiveToolCall {
  toolName: string;
  agentId: string;
}

export interface ResearchState {
  session: ResearchSession | null;
  isPlanning: boolean;
  isExecuting: boolean;
  isPaused: boolean;
  errorMessage: string | null;
  currentStepIndex: number;
  agentOutputs: Record<string, string>;
  activeToolCall: ActiveToolCall | undefined;
  /** Latest SSE progress-phase message from a streaming run (Phase 12 builds the visual indicator). */
  currentPhaseMessage: string | null;
  /** Accumulates token deltas from a streaming synthesis before the final 'report' event arrives. */
  streamingReportText: string;
}

export const initialResearchState: ResearchState = {
  session: null,
  isPlanning: false,
  isExecuting: false,
  isPaused: false,
  errorMessage: null,
  currentStepIndex: 0,
  agentOutputs: {},
  activeToolCall: undefined,
  currentPhaseMessage: null,
  streamingReportText: ''
};

export type ResearchAction =
  | { type: 'PLAN_STARTED' }
  | { type: 'PLAN_SUCCEEDED'; session: ResearchSession }
  | { type: 'PLAN_FAILED'; error: string }
  | { type: 'PLAN_SETTLED' }
  | { type: 'UPDATE_AGENT'; agentId: string; updates: Partial<AgentNode> }
  | { type: 'ADD_LOG'; entry: MCPLogEntry }
  | { type: 'SET_ACTIVE_TOOL_CALL'; toolCall: ActiveToolCall | undefined }
  | { type: 'SET_AGENT_OUTPUT'; stepId: string; output: string }
  | { type: 'UPDATE_STEP_RESULT'; stepIdx: number; outputSummary?: string }
  | { type: 'STEP_FAILED'; error: string }
  | { type: 'ADVANCE_STEP' }
  | { type: 'SYNTHESIS_SUCCEEDED'; report: string }
  | { type: 'SYNTHESIS_FAILED'; error: string }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_EXECUTING'; executing: boolean }
  | { type: 'SET_STEP_INDEX'; index: number }
  | { type: 'DISMISS_ERROR' }
  | { type: 'UPDATE_STEP'; step: InstructionStep }
  | { type: 'ADD_STEP'; step: InstructionStep }
  | { type: 'DELETE_STEP'; stepId: string }
  | { type: 'CLEAR_LOGS' }
  | { type: 'RESET' }
  | {
      type: 'RESUMED';
      session: ResearchSession;
      agentOutputs: Record<string, string>;
      currentStepIndex: number;
      isExecuting: boolean;
      isPaused: boolean;
    }
  | { type: 'STREAM_STARTED' }
  | { type: 'STREAM_SESSION_CREATED'; session: ResearchSession }
  | { type: 'STREAM_PROGRESS'; message: string }
  | {
      type: 'STREAM_STEP_RESULT';
      stepIndex: number;
      agentId: string;
      thoughtTrace: string[];
      agentOutput: string;
      keyTakeaways: string[];
    }
  | { type: 'STREAM_TOKEN'; textDelta: string }
  | { type: 'STREAM_REPORT_DONE'; report: string }
  | { type: 'STREAM_ERROR'; error: string };

export function researchReducer(state: ResearchState, action: ResearchAction): ResearchState {
  switch (action.type) {
    case 'PLAN_STARTED':
      return {
        ...state,
        isPlanning: true,
        session: null,
        agentOutputs: {},
        currentStepIndex: 0,
        errorMessage: null
      };

    case 'PLAN_SUCCEEDED':
      return { ...state, session: action.session, isExecuting: true, isPaused: false };

    case 'PLAN_FAILED':
      return { ...state, errorMessage: action.error };

    case 'PLAN_SETTLED':
      return { ...state, isPlanning: false };

    case 'UPDATE_AGENT': {
      if (!state.session || !state.session.agents[action.agentId]) return state;
      const currentAgent = state.session.agents[action.agentId];
      return {
        ...state,
        session: {
          ...state.session,
          agents: {
            ...state.session.agents,
            [action.agentId]: { ...currentAgent, ...action.updates }
          }
        }
      };
    }

    case 'ADD_LOG': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, logs: [...state.session.logs, action.entry] } };
    }

    case 'SET_ACTIVE_TOOL_CALL':
      return { ...state, activeToolCall: action.toolCall };

    case 'SET_AGENT_OUTPUT':
      return { ...state, agentOutputs: { ...state.agentOutputs, [action.stepId]: action.output } };

    case 'UPDATE_STEP_RESULT': {
      if (!state.session) return state;
      const updatedSteps = [...state.session.instructionSet];
      updatedSteps[action.stepIdx] = {
        ...updatedSteps[action.stepIdx],
        status: 'completed',
        outputSummary: action.outputSummary
      };
      return { ...state, session: { ...state.session, instructionSet: updatedSteps } };
    }

    case 'STEP_FAILED':
      return { ...state, errorMessage: action.error, isPaused: true };

    case 'ADVANCE_STEP':
      return { ...state, currentStepIndex: state.currentStepIndex + 1 };

    case 'SYNTHESIS_SUCCEEDED': {
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, status: 'completed', finalReport: action.report },
        isExecuting: false
      };
    }

    case 'SYNTHESIS_FAILED':
      return { ...state, errorMessage: action.error, isExecuting: false };

    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };

    case 'SET_PAUSED':
      return { ...state, isPaused: action.paused };

    case 'SET_EXECUTING':
      return { ...state, isExecuting: action.executing };

    case 'SET_STEP_INDEX':
      return { ...state, currentStepIndex: action.index };

    case 'DISMISS_ERROR':
      return { ...state, errorMessage: null };

    case 'UPDATE_STEP': {
      if (!state.session) return state;
      const newSteps = state.session.instructionSet.map(s => (s.id === action.step.id ? action.step : s));
      return { ...state, session: { ...state.session, instructionSet: newSteps } };
    }

    case 'ADD_STEP': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, instructionSet: [...state.session.instructionSet, action.step] } };
    }

    case 'DELETE_STEP': {
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, instructionSet: state.session.instructionSet.filter(s => s.id !== action.stepId) }
      };
    }

    case 'CLEAR_LOGS': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, logs: [] } };
    }

    case 'RESET':
      return { ...initialResearchState };

    case 'RESUMED':
      return {
        ...state,
        session: action.session,
        agentOutputs: action.agentOutputs,
        currentStepIndex: action.currentStepIndex,
        isExecuting: action.isExecuting,
        isPaused: action.isPaused,
        errorMessage: null
      };

    case 'STREAM_STARTED':
      return {
        ...initialResearchState,
        isPlanning: true
      };

    case 'STREAM_SESSION_CREATED':
      return {
        ...state,
        session: action.session,
        isPlanning: false,
        isExecuting: true,
        isPaused: false
      };

    case 'STREAM_PROGRESS':
      return { ...state, currentPhaseMessage: action.message };

    case 'STREAM_STEP_RESULT': {
      if (!state.session) return state;
      const step = state.session.instructionSet[action.stepIndex];
      if (!step) return state;

      const updatedSteps = [...state.session.instructionSet];
      updatedSteps[action.stepIndex] = {
        ...step,
        status: 'completed',
        outputSummary: action.keyTakeaways?.join('; ')
      };

      return {
        ...state,
        session: {
          ...state.session,
          instructionSet: updatedSteps,
          agents: state.session.agents[action.agentId]
            ? {
                ...state.session.agents,
                [action.agentId]: {
                  ...state.session.agents[action.agentId],
                  status: 'completed',
                  progress: 100,
                  output: action.agentOutput,
                  thoughtTrace: action.thoughtTrace
                }
              }
            : state.session.agents
        },
        agentOutputs: { ...state.agentOutputs, [step.id]: action.agentOutput },
        currentStepIndex: action.stepIndex + 1
      };
    }

    case 'STREAM_TOKEN':
      return { ...state, streamingReportText: state.streamingReportText + action.textDelta };

    case 'STREAM_REPORT_DONE': {
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, status: 'completed', finalReport: action.report },
        streamingReportText: action.report,
        isExecuting: false
      };
    }

    case 'STREAM_ERROR':
      return { ...state, errorMessage: action.error, isPlanning: false, isExecuting: false, isPaused: true };

    default:
      return state;
  }
}
