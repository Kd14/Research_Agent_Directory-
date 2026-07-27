import React, { useState, useRef, useEffect } from 'react';
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
  AlertTriangle 
} from 'lucide-react';
import { MCPLogEntry, LogLevel } from '../types';

interface ProcessLogsTerminalProps {
  logs: MCPLogEntry[];
  onClearLogs: () => void;
}

export const ProcessLogsTerminal: React.FC<ProcessLogsTerminalProps> = ({
  logs,
  onClearLogs
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
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

      {/* Terminal Log Output Window */}
      <div className="max-h-[380px] min-h-[220px] overflow-y-auto space-y-1.5 pr-2">
        {filteredLogs.map((log) => {
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
                  : 'border-slate-800/80 bg-slate-900/50 hover:bg-slate-900'
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
                      {log.agentName && <strong className="text-indigo-400 font-normal mr-1">{log.agentName}:</strong>}
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

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center text-slate-600 italic">
            No process logs recorded yet. Execute a research query to view real-time traces.
          </div>
        )}

        <div ref={logsEndRef} />
      </div>

    </div>
  );
};
