import type { AgentNode, CitationRecord, InstructionStep, MCPLogEntry, ResearchSession } from '../types';

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
  /** Latest SSE progress-phase message from the streaming run. */
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

function logEntry(partial: Omit<MCPLogEntry, 'id' | 'timestamp'>): MCPLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    ...partial
  };
}

export type ResearchAction =
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'DISMISS_ERROR' }
  | { type: 'SET_INSTRUCTION_SET'; instructionSet: InstructionStep[] }
  | { type: 'CLEAR_LOGS' }
  | { type: 'RESET' }
  | { type: 'STREAM_STARTED' }
  | { type: 'STREAM_SESSION_CREATED'; session: ResearchSession }
  | {
      type: 'STREAM_RESUMED';
      session: ResearchSession;
      agentOutputs: Record<string, string>;
      currentStepIndex: number;
    }
  | { type: 'STREAM_PROGRESS'; phase: string; message: string; stepIndex?: number; stepTitle?: string }
  | {
      type: 'STREAM_STEP_RESULT';
      stepIndex: number;
      agentId: string;
      thoughtTrace: string[];
      agentOutput: string;
      keyTakeaways: string[];
      toolCallUsed?: string | null;
      toolArgs?: Record<string, unknown>;
      toolResult?: unknown;
      citations?: readonly CitationRecord[];
    }
  | { type: 'STREAM_TOKEN'; textDelta: string }
  | { type: 'STREAM_REPORT_DONE'; report: string }
  | { type: 'STREAM_ERROR'; error: string };

export function researchReducer(state: ResearchState, action: ResearchAction): ResearchState {
  switch (action.type) {
    case 'TOGGLE_PAUSE':
      return { ...state, isPaused: !state.isPaused };

    case 'DISMISS_ERROR':
      return { ...state, errorMessage: null };

    case 'SET_INSTRUCTION_SET': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, instructionSet: action.instructionSet } };
    }

    case 'CLEAR_LOGS': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, logs: [] } };
    }

    case 'RESET':
      return { ...initialResearchState };

    case 'STREAM_STARTED':
      return {
        ...initialResearchState,
        isPlanning: true
      };

    case 'STREAM_SESSION_CREATED':
      return {
        ...state,
        session: { ...action.session, citations: action.session.citations || [] },
        isPlanning: false,
        isExecuting: true,
        isPaused: false,
        currentStepIndex: 0,
        agentOutputs: {}
      };

    case 'STREAM_RESUMED':
      return {
        ...state,
        session: { ...action.session, citations: action.session.citations || [] },
        agentOutputs: action.agentOutputs,
        currentStepIndex: action.currentStepIndex,
        isPlanning: false,
        isExecuting: true,
        isPaused: false,
        errorMessage: null
      };

    case 'STREAM_PROGRESS': {
      const withMessage = { ...state, currentPhaseMessage: action.message };
      if (!state.session || action.phase === 'error') return withMessage;

      const step = action.stepIndex !== undefined ? state.session.instructionSet[action.stepIndex] : undefined;
      const isLiveAgentPhase = action.phase === 'running_tools' || action.phase === 'analyzing' ||
        action.phase === 'critiquing' || action.phase === 'reviewing';

      const entry = logEntry({
        agentId: step?.assignedAgentId,
        agentName: step?.agentName || 'Dr. Astra (Lead Orchestrator)',
        type: 'orchestrator_decision',
        message: action.message,
        level: 'info'
      });

      const agents = step && isLiveAgentPhase && withMessage.session!.agents[step.assignedAgentId]
        ? {
            ...withMessage.session!.agents,
            [step.assignedAgentId]: {
              ...withMessage.session!.agents[step.assignedAgentId],
              status: action.phase === 'running_tools' ? 'calling_tool' as const : 'analyzing' as const
            }
          }
        : withMessage.session!.agents;

      return {
        ...withMessage,
        session: { ...withMessage.session!, logs: [...withMessage.session!.logs, entry], agents }
      };
    }

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

      const newLogs = [...state.session.logs];
      if (action.toolCallUsed) {
        newLogs.push(logEntry({
          agentId: action.agentId,
          agentName: step.agentName,
          type: 'mcp_tool_call',
          toolName: action.toolCallUsed,
          args: action.toolArgs,
          result: action.toolResult,
          message: `Invoked MCP tool ${action.toolCallUsed}`,
          level: 'mcp_tool'
        }));
      }
      newLogs.push(logEntry({
        agentId: action.agentId,
        agentName: step.agentName,
        type: 'agent_message',
        message: `Step ${action.stepIndex + 1} finalized: ${action.keyTakeaways?.[0] || 'Analysis complete.'}`,
        level: 'success'
      }));

      return {
        ...state,
        session: {
          ...state.session,
          instructionSet: updatedSteps,
          logs: newLogs,
          citations: action.citations?.length ? [...(state.session.citations || []), ...action.citations] : (state.session.citations || []),
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
        currentStepIndex: action.stepIndex + 1,
        activeToolCall: undefined
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
