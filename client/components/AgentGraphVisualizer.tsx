import React, { useState } from 'react';
import {
  Bot,
  Server,
  Activity,
  Cpu,
  BookOpen,
  ShieldCheck,
  FileCheck2,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Sliders,
  ChevronRight
} from 'lucide-react';
import { AgentNode, AgentStatus, MCPTool } from '../types';

interface AgentGraphVisualizerProps {
  agents: Record<string, AgentNode>;
  activeStepAgentId?: string;
  isExecuting: boolean;
  activeToolCall?: { toolName: string; agentId: string };
  mcpTools: MCPTool[];
  onSelectAgent?: (agent: AgentNode) => void;
}

export const AgentGraphVisualizer: React.FC<AgentGraphVisualizerProps> = ({
  agents,
  activeStepAgentId,
  isExecuting,
  activeToolCall,
  mcpTools,
  onSelectAgent
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('lead');

  const selectedAgent = agents[selectedAgentId] || agents['lead'];

  // Only render nodes for agents actually deployed in this session (the
  // user can opt specialists out before starting a run). Critic/Reviewer are pipeline-stage
  // personas (server/orchestration/PipelineStageRoster.ts) rather than domain specialists - they
  // run on every session, so they show up here whenever the session actually deployed them.
  const activeSpecialistIds = ['literature', 'pipeline', 'validation', 'synthesis', 'critic', 'reviewer'].filter(id => agents[id]);

  const getStatusBadge = (status: AgentStatus, isCurrentStep: boolean) => {
    if (isCurrentStep && isExecuting) {
      return (
        <span className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-400/40 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
          Active Execution
        </span>
      );
    }

    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            Task Done
          </span>
        );
      case 'calling_tool':
        return (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30">
            <Zap className="h-3 w-3 text-amber-400" />
            MCP Tool Call
          </span>
        );
      case 'analyzing':
        return (
          <span className="flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300 border border-blue-500/30">
            <Activity className="h-3 w-3 text-blue-400 animate-pulse" />
            Reasoning
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700">
            Idle
          </span>
        );
    }
  };

  const agentNodesList = [
    { id: 'lead', roleIcon: Bot, color: 'from-purple-500 to-indigo-600', position: 'col-span-2 justify-self-center' },
    { id: 'literature', roleIcon: BookOpen, color: 'from-blue-500 to-cyan-600', position: '' },
    { id: 'pipeline', roleIcon: Cpu, color: 'from-amber-500 to-orange-600', position: '' },
    { id: 'validation', roleIcon: ShieldCheck, color: 'from-emerald-500 to-teal-600', position: '' },
    { id: 'synthesis', roleIcon: FileCheck2, color: 'from-pink-500 to-rose-600', position: '' },
  ];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-xl">
      {/* Top Header */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Agent Network Interaction Graph</h2>
            <p className="text-[11px] text-slate-400">Real-time MCP Orchestration & Message Topology</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            MCP Protocol Active
          </span>
        </div>
      </div>

      {/* Main Canvas & Inspection split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Visual Graph Area */}
        <div className="lg:col-span-2 relative rounded-xl border border-slate-800 bg-slate-900/60 p-4 min-h-[360px] flex flex-col justify-between overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>

          {/* Central Orchestrator Node */}
          <div className="flex justify-center mb-6 relative z-10">
            {(() => {
              const node = agents['lead'];
              const isSelected = selectedAgentId === 'lead';
              const isCurrent = activeStepAgentId === 'lead';

              return (
                <button
                  id="agent-node-lead"
                  onClick={() => {
                    setSelectedAgentId('lead');
                    if (onSelectAgent && node) onSelectAgent(node);
                  }}
                  className={`group relative flex flex-col items-center rounded-xl p-3 text-left transition-all max-w-xs ${
                    isSelected 
                      ? 'bg-purple-950/80 border-2 border-purple-500 shadow-lg shadow-purple-500/20' 
                      : 'bg-slate-800/90 border border-slate-700 hover:border-purple-400/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img 
                        src={node?.avatar} 
                        alt={node?.name} 
                        className="h-11 w-11 rounded-full object-cover border-2 border-purple-400"
                      />
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] text-white">
                        ★
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{node?.name || 'Dr. Astra'}</span>
                        {getStatusBadge(node?.status || 'idle', isCurrent)}
                      </div>
                      <p className="text-[10px] text-purple-300 font-medium">{node?.title || 'Lead Orchestrator'}</p>
                    </div>
                  </div>
                </button>
              );
            })()}
          </div>

          {/* MCP Hub Central Bus Line */}
          <div className="relative my-2 py-2 flex items-center justify-center z-10">
            <div className="w-full h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-40"></div>
            <div className="absolute px-3 py-1 rounded-full bg-slate-900 border border-indigo-500/40 text-[11px] font-mono text-indigo-300 flex items-center gap-2 shadow-md">
              <Server className="h-3.5 w-3.5 text-indigo-400" />
              <span>MCP Tool Server Bus</span>
              {activeToolCall && (
                <span className="text-[10px] bg-indigo-500/30 px-1.5 py-0.2 rounded text-indigo-200 animate-pulse">
                  {activeToolCall.toolName}
                </span>
              )}
            </div>
          </div>

          {/* Specialized Agent Nodes Grid */}
          <div
            className="grid grid-cols-2 gap-3 z-10 mt-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(activeSpecialistIds.length, 4) || 1}, minmax(0, 1fr))` }}
          >
            {activeSpecialistIds.map(agentId => {
              const node = agents[agentId];
              const isSelected = selectedAgentId === agentId;
              const isCurrent = activeStepAgentId === agentId;
              const isToolActive = activeToolCall?.agentId === agentId;

              return (
                <button
                  id={`agent-node-${agentId}`}
                  key={agentId}
                  onClick={() => {
                    setSelectedAgentId(agentId);
                    if (onSelectAgent && node) onSelectAgent(node);
                  }}
                  className={`group relative flex flex-col items-center rounded-xl p-2.5 text-center transition-all ${
                    isSelected 
                      ? 'bg-indigo-950/80 border-2 border-indigo-400 shadow-md shadow-indigo-500/20' 
                      : 'bg-slate-800/80 border border-slate-700/80 hover:border-slate-500'
                  } ${isCurrent ? 'ring-2 ring-indigo-500 animate-pulse' : ''}`}
                >
                  <div className="relative mb-1.5">
                    <img 
                      src={node?.avatar} 
                      alt={node?.name} 
                      className="h-9 w-9 rounded-full object-cover border border-slate-600"
                    />
                    {isToolActive && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-black font-bold animate-bounce">
                        ⚡
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-[11px] text-slate-100 line-clamp-1">{node?.name}</span>
                  <span className="text-[9.5px] text-slate-400 line-clamp-1 mb-1">{node?.title?.split('&')[0]}</span>
                  {getStatusBadge(node?.status || 'idle', isCurrent)}
                </button>
              );
            })}
          </div>

        </div>

        {/* Selected Agent Inspector Panel */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-3">
            <img 
              src={selectedAgent?.avatar} 
              alt={selectedAgent?.name} 
              className="h-10 w-10 rounded-full object-cover border border-indigo-400"
            />
            <div>
              <h3 className="text-xs font-bold text-white">{selectedAgent?.name}</h3>
              <p className="text-[11px] text-indigo-300">{selectedAgent?.title}</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
            {selectedAgent?.description}
          </p>

          <div className="mb-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              MCP Tools Permissions
            </span>
            <div className="flex flex-wrap gap-1">
              {selectedAgent?.toolsAccess?.map(toolName => (
                <span 
                  key={toolName} 
                  className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-indigo-300 border border-slate-700"
                >
                  {toolName}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Internal Reasoning Trace
            </span>
            <div className="max-h-36 overflow-y-auto rounded-lg bg-slate-950 p-2.5 font-mono text-[10.5px] text-slate-300 space-y-1.5 border border-slate-800">
              {selectedAgent?.thoughtTrace?.map((trace, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-slate-300">
                  <span className="text-indigo-400 shrink-0">›</span>
                  <span className="leading-tight">{trace}</span>
                </div>
              ))}
              {(!selectedAgent?.thoughtTrace || selectedAgent.thoughtTrace.length === 0) && (
                <span className="text-slate-500 italic">No active thoughts recorded yet.</span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
