export type DocumentCategory = 
  | 'Research Paper' 
  | 'Pipeline Spec Sheet' 
  | 'Technical Architecture' 
  | 'Benchmark Data' 
  | 'Code / Config';

export interface TechDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  content: string;
  sizeBytes: number;
  uploadedAt: string;
  summary?: string;
  tags: string[];
  contentHash?: string;
}

export type AgentRole =
  | 'lead'
  | 'literature'
  | 'pipeline'
  | 'validation'
  | 'synthesis'
  | 'critic'
  | 'reviewer';

export type AgentStatus = 
  | 'idle' 
  | 'analyzing' 
  | 'calling_tool' 
  | 'streaming' 
  | 'completed' 
  | 'paused' 
  | 'error';

export interface AgentNode {
  id: string;
  role: AgentRole;
  name: string;
  title: string;
  avatar: string;
  description: string;
  status: AgentStatus;
  currentTask?: string;
  progress: number; // 0 - 100
  output?: string;
  thoughtTrace: string[];
  toolsAccess: string[];
}

export interface InstructionStep {
  id: string;
  stepNumber: number;
  assignedAgentId: string;
  agentName: string;
  title: string;
  instruction: string;
  requiredTools: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'modified';
  userNotes?: string;
  outputSummary?: string;
  executionTimeMs?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  category: 'Document Storage' | 'Web Intelligence' | 'Compute & Spec' | 'Logic Verification' | 'Report Engine';
  callCount: number;
  status: 'active' | 'busy' | 'idle';
  schema: {
    inputs: string[];
    output: string;
  };
}

export type LogLevel = 'info' | 'warn' | 'success' | 'error' | 'mcp_tool';

export interface MCPLogEntry {
  id: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  type: 'mcp_tool_call' | 'mcp_tool_result' | 'agent_message' | 'orchestrator_decision' | 'system_event' | 'user_intervention';
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  message: string;
  details?: string;
  level: LogLevel;
}

export interface CitationRecord {
  id: string;
  toolName?: string;
  docId?: string;
  chunkId?: string;
  sourceUrl?: string;
  claim: string;
  consumedBy: string[];
  createdAt: string;
}

export type ExecutionMode = 'auto' | 'step_by_step' | 'paused';

export interface ResearchSession {
  id: string;
  title: string;
  userPrompt: string;
  selectedDocIds: string[];
  executionMode: ExecutionMode;
  currentStepIndex: number;
  instructionSet: InstructionStep[];
  status: 'idle' | 'planning' | 'executing' | 'paused' | 'synthesizing' | 'completed' | 'error';
  finalReport?: string;
  logs: MCPLogEntry[];
  agents: Record<string, AgentNode>;
  citations: CitationRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface SystemStats {
  mcpServerStatus: 'online' | 'degraded' | 'offline';
  mcpUptime: string;
  activeAgents: number;
  totalToolCalls: number;
  documentsLoaded: number;
  totalTokensProcessed: number;
}
