import type { AgentNode, InstructionStep, MCPLogEntry } from '../../client/types';

export interface SessionMetadata {
  readonly schemaVersion: 1;
  readonly id: string;
  title: string;
  readonly userPrompt: string;
  readonly selectedDocIds: readonly string[];
  executionMode: 'auto' | 'step_by_step' | 'paused';
  status: 'idle' | 'planning' | 'executing' | 'paused' | 'synthesizing' | 'completed' | 'error';
  readonly createdAt: string;
  updatedAt: string;
}

export interface SessionHistory {
  readonly schemaVersion: 1;
  instructionSet: InstructionStep[];
  agents: Record<string, AgentNode>;
  logs: MCPLogEntry[];
  agentOutputs: Record<string, string>;
  currentStepIndex: number;
  finalReportArtifact?: string;
  finalReportPdfArtifact?: string;
}
