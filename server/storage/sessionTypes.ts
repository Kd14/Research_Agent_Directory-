import type { AgentNode, CitationRecord, InstructionStep, MCPLogEntry } from '../../client/types';
import type { ReflectionResult } from '../services/ReflectionService';

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
  citations: CitationRecord[];
  reflections: ReflectionResult[];
  reflectionIterationCount: number;
  finalReportArtifact?: string;
  finalReportPdfArtifact?: string;
  finalReportDocxArtifact?: string;
  finalReportPptxArtifact?: string;
}
