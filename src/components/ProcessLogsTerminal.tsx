import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Terminal,
  Search,
  Filter,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
  Bot,
  Server,
  User,
  Info,
  AlertTriangle,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { MCPLogEntry, LogLevel, AgentNode, AgentStatus } from '../types';

interface ProcessLogsTerminalProps {
  logs: MCPLogEntry[];
  onClearLogs: () => void;
  agents?: Record<string, AgentNode>;
}

interface AgentLogGroup {
  key: string;
  agentId?: string;
  agentName: string;
  logs: MCPLogEntry[];
  lastLog: MCPLogEntry;
  lastIndex: number;
}

export const ProcessLogsTerminal: React.FC<ProcessLogsTerminalProps> = ({
  logs,
  onClearLogs,
  agents
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesSearch =
      !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.agentName && log.agentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.toolName && log.toolName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Summarise the flat log stream into one card per agent: the latest
  // message stands in for "what is this agent doing right now", with the
  // full chronological history available behind an expand toggle.
  const agentGroups = useMemo<AgentLogGroup[]>(() => {
    const map = new Map<string, AgentLogGroup>();
    filteredLogs.forEach((log, idx) => {
      const key = log.agentId || log.agentName || 'system';
      const name = log.agentName || 'System';
      let group = map.get(key);
      if (!group) {
        group = { key, agentId: log.agentId, agentName: name, logs: [], lastLog: log, lastIndex: idx };
        map.set(key, group);
      }
      group.logs.push(log);
      group.lastLog = log;
      group.lastIndex = idx;
    });
    // Most recently active agent bubbles to the top.
    return Array.from(map.values()).sort((a, b) => b.lastIndex - a.lastIndex);
  }, [filteredLogs]);

  const toggleAgentExpanded = (key: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const allExpanded = agentGroups.length > 0 && agentGroups.every(g => expandedAgents.has(g.key));

  const toggleExpandAll = () => {
    setExpandedAgents(allExpanded ? new Set() : new Set(agentGroups.map(g => g.key)));
  };

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.agentName || 'System'}: ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogBadge = (log: MCPLogEntry) => {
    switch (log.type) {
      case 'mcp_tool_call':
      case 'mcp_tool_result':
        return (
          <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300 border border-amber-500/30">
            <Zap className="h-2.5 w-2.5 text-amber-400" />
            MCP Tool
          </span>
        );
      case 'orchestrator_decision':
        return (
          <span className="flex items-center gap-1 rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-purple-300 border border-purple-500/30">
            <Server className="h-2.5 w-2.5 text-purple-400" />
            Orchestrator
          </span>
        );
      case 'user_intervention':
        return (
          <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
            <User className="h-2.5 w-2.5 text-emerald-400" />
            Intervention
          </span>
        );
      case 'agent_message':
        return (
          <span className="flex items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
            <Bot className="h-2.5 w-2.5 text-indigo-400" />
            Agent Stream
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 border border-slate-700">
            System
          </span>
        );
    }
  };

  const getAgentStatusBadge = (status?: AgentStatus) => {
    switch (status) {
      case 'analyzing':
        return (
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300 border border-blue-500/30">
            Reasoning
          </span>
        );
      case 'calling_tool':
        return (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30 animate-pulse">
            MCP Tool Call
          </span>
        );
      case 'streaming':
        return (
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/30 animate-pulse">
            Streaming
          </span>
        );
      case 'completed':
        return (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
            Task Done
          </span>
        );
      case 'error':
        return (
          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-300 border border-rose-500/30">
            Error
          </span>
        );
      case 'paused':
        return (
          <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-600">
            Paused
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 shadow-xl">
      
      {/* Terminal Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80"></span>
            <span className="h-3 w-3 rounded-full bg-amber-500/80"></span>
            <span className="h-3 w-3 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="font-semibold text-slate-300 ml-2">mcp-agent-orchestrator.log</span>
          <span className="text-[10px] text-slate-500 font-mono">({filteredLogs.length} events)</span>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="mcp_tool_call">MCP Tool Calls</option>
            <option value="agent_message">Agent Messages</option>
            <option value="orchestrator_decision">Orchestrator Decisions</option>
            <option value="user_intervention">User Interventions</option>
          </select>

          <button
            onClick={toggleExpandAll}
            disabled={agentGroups.length === 0}
            className="flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {allExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
          </button>

          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 border border-slate-800"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 text-slate-500 hover:text-rose-400"
            title="Clear Terminal Logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Per-agent Activity Summary */}
      <div className="max-h-[460px] min-h-[220px] overflow-y-auto space-y-1.5 pr-2">
        {agentGroups.map((group) => {
          const isGroupExpanded = expandedAgents.has(group.key);
          const agentNode = group.agentId ? agents?.[group.agentId] : undefined;

          return (
            <div
              key={group.key}
              className="rounded-lg border border-slate-800/80 bg-slate-900/50 transition-all"
            >
              {/* Agent Summary Row: current activity at a glance */}
              <div
                className="flex items-start justify-between gap-2 cursor-pointer p-2.5 hover:bg-slate-900"
                onClick={() => toggleAgentExpanded(group.key)}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {agentNode?.avatar ? (
                    <img
                      src={agentNode.avatar}
                      alt={group.agentName}
                      className="h-6 w-6 rounded-full object-cover border border-slate-700 shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 border border-slate-700 shrink-0 mt-0.5">
                      <Bot className="h-3 w-3 text-slate-400" />
                    </div>
                  )}

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-slate-100 font-semibold not-italic">{group.agentName}</strong>
                      {agentNode ? getAgentStatusBadge(agentNode.status) : getLogBadge(group.lastLog)}
                      <span className="text-[10px] text-slate-500 font-mono">{group.lastLog.timestamp}</span>
                      <span className="text-[10px] text-slate-600 font-mono">· {group.logs.length} event{group.logs.length === 1 ? '' : 's'}</span>
                    </div>
                    <span className="text-slate-300 leading-snug truncate">
                      {group.lastLog.message}
                    </span>
                  </div>
                </div>

                <button className="text-slate-500 hover:text-slate-300 shrink-0 mt-0.5">
                  {isGroupExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Full chronological log history for this agent */}
              {isGroupExpanded && (
                <div className="space-y-1.5 border-t border-slate-800/80 p-2">
                  {group.logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDetails = log.details || log.args || log.result;

                    return (
                      <div
                        key={log.id}
                        className={`rounded-lg border p-2 transition-all ${
                          log.type === 'user_intervention'
                            ? 'border-emerald-900/60 bg-emerald-950/20'
                            : log.type === 'mcp_tool_call'
                            ? 'border-amber-900/40 bg-amber-950/10'
                            : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900'
                        }`}
                      >
                        <div
                          className="flex items-start justify-between gap-2 cursor-pointer"
                          onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {log.timestamp}
                            </span>

                            {getLogBadge(log)}

                            <div className="flex flex-col">
                              <span className="text-slate-200 leading-snug">
                                {log.message}
                              </span>
                            </div>
                          </div>

                          {hasDetails && (
                            <button className="text-slate-500 hover:text-slate-300 shrink-0">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>

                        {/* Expandable Details Box */}
                        {isExpanded && hasDetails && (
                          <div className="mt-2 rounded bg-slate-950 p-2 font-mono text-[10.5px] text-slate-300 space-y-1 border border-slate-800">
                            {log.details && (
                              <p className="text-slate-300 whitespace-pre-wrap">{log.details}</p>
                            )}
                            {log.args && (
                              <div>
                                <span className="text-amber-400 font-bold">Args:</span>
                                <pre className="text-slate-400 overflow-x-auto">{JSON.stringify(log.args, null, 2)}</pre>
                              </div>
                            )}
                            {log.result && (
                              <div>
                                <span className="text-emerald-400 font-bold">MCP Result:</span>
                                <pre className="text-slate-400 overflow-x-auto">{JSON.stringify(log.result, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {agentGroups.length === 0 && (
          <div className="py-12 text-center text-slate-600 italic">
            No process logs recorded yet. Execute a research query to view real-time traces.
          </div>
        )}

        <div ref={logsEndRef} />
      </div>

    </div>
  );
};
