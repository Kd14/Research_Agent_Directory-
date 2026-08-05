import React, { useMemo, useState } from 'react';
import {
  Server,
  Zap,
  Cpu,
  Database,
  Globe,
  ShieldAlert,
  FileCheck,
  Play,
  CheckCircle2,
  Code,
  BookMarked,
  Link2
} from 'lucide-react';
import { CitationRecord, MCPTool, TechDocument } from '../types';

interface ToolInspectorProps {
  tools: MCPTool[];
  onExecuteToolDirect?: (toolName: string, args: Record<string, any>) => Promise<any>;
  citations?: readonly CitationRecord[];
  documents?: readonly TechDocument[];
}

export const ToolInspector: React.FC<ToolInspectorProps> = ({
  tools,
  onExecuteToolDirect,
  citations = [],
  documents = []
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tools' | 'citations'>('tools');
  const [selectedToolName, setSelectedToolName] = useState<string>('mcp_spec_analyzer');
  const [testArgsJson, setTestArgsJson] = useState<string>(
    JSON.stringify({ paramCountBillion: 70, seqLen: 512000, batchSize: 2, precision: 'FP8' }, null, 2)
  );
  const [toolResult, setToolResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const documentTitleById = useMemo(
    () => new Map(documents.map(d => [d.id, d.title])),
    [documents]
  );

  const citationGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; records: CitationRecord[] }>();
    for (const record of citations) {
      const key = record.docId || record.sourceUrl || 'ungrouped';
      const label = record.docId ? (documentTitleById.get(record.docId) || record.docId) : (record.sourceUrl || 'Other evidence');
      let group = map.get(key);
      if (!group) {
        group = { key, label, records: [] };
        map.set(key, group);
      }
      group.records.push(record);
    }
    return Array.from(map.values());
  }, [citations, documentTitleById]);

  const selectedTool = tools.find(t => t.name === selectedToolName) || tools[0];

  const handleRunToolTest = async () => {
    if (!onExecuteToolDirect) return;
    setIsTesting(true);
    setToolResult(null);
    try {
      const parsedArgs = JSON.parse(testArgsJson);
      const res = await onExecuteToolDirect(selectedToolName, parsedArgs);
      setToolResult(res);
    } catch (err: any) {
      setToolResult({ error: err.message || 'Invalid JSON input arguments' });
    } finally {
      setIsTesting(false);
    }
  };

  const getToolIcon = (category: string) => {
    switch (category) {
      case 'Document Storage': return <Database className="h-4 w-4 text-blue-400" />;
      case 'Web Intelligence': return <Globe className="h-4 w-4 text-cyan-400" />;
      case 'Compute & Spec': return <Cpu className="h-4 w-4 text-amber-400" />;
      case 'Logic Verification': return <ShieldAlert className="h-4 w-4 text-emerald-400" />;
      default: return <FileCheck className="h-4 w-4 text-purple-400" />;
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-xl">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">MCP Protocol Server & Tool Hub</h2>
            <p className="text-[11px] text-slate-400">Model Context Protocol Schema & Direct Tool Invocation</p>
          </div>
        </div>

        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400 border border-emerald-500/30">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          JSON-RPC 2.0 Ready
        </span>
      </div>

      {/* Sub-tab toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1 mb-4 w-fit border border-slate-800">
        <button
          onClick={() => setActiveSubTab('tools')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            activeSubTab === 'tools' ? 'bg-slate-800 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>MCP Tools</span>
        </button>
        <button
          onClick={() => setActiveSubTab('citations')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            activeSubTab === 'citations' ? 'bg-slate-800 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookMarked className="h-3.5 w-3.5" />
          <span>Citations</span>
          {citations.length > 0 && (
            <span className="rounded-full bg-indigo-500/30 px-1.5 py-0.2 text-[10px] font-bold text-indigo-200">
              {citations.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'citations' ? (
        <div className="space-y-3">
          {citationGroups.length === 0 && (
            <div className="py-12 text-center text-slate-600 italic">
              No citations recorded yet. Run a research session that uses mcp_doc_search or mcp_web_grounding to populate the citation graph.
            </div>
          )}
          {citationGroups.map(group => (
            <div key={group.key} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-slate-100">{group.label}</span>
                <span className="text-[10px] text-slate-500 font-mono">· {group.records.length} citation{group.records.length === 1 ? '' : 's'}</span>
              </div>
              <div className="space-y-2">
                {group.records.map(record => (
                  <div key={record.id} className="rounded-lg bg-slate-950 border border-slate-800 p-2.5">
                    <p className="text-[11px] text-slate-300 leading-relaxed">{record.claim}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9.5px] font-mono text-slate-500">
                      {record.toolName && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-amber-300 border border-amber-500/20">{record.toolName}</span>
                      )}
                      {record.consumedBy.map(stepId => (
                        <span key={stepId} className="rounded bg-slate-800 px-1.5 py-0.2 text-slate-400">used by {stepId}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tools List */}
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Registered MCP Tools ({tools.length})
          </span>

          {tools.map(tool => {
            const isSelected = tool.name === selectedToolName;

            return (
              <button
                key={tool.name}
                onClick={() => {
                  setSelectedToolName(tool.name);
                  if (tool.name === 'mcp_spec_analyzer') {
                    setTestArgsJson(JSON.stringify({ paramCountBillion: 70, seqLen: 512000, batchSize: 2, precision: 'FP8' }, null, 2));
                  } else if (tool.name === 'mcp_doc_search') {
                    setTestArgsJson(JSON.stringify({ query: 'Ring Attention KV Cache' }, null, 2));
                  } else if (tool.name === 'mcp_web_grounding') {
                    setTestArgsJson(JSON.stringify({ searchQuery: 'FlashAttention-3 FP8 CUDA Kernel arXiv' }, null, 2));
                  } else if (tool.name === 'mcp_hypothesis_tester') {
                    setTestArgsJson(JSON.stringify({ hypothesis: 'DPO exhibits length bias compared to SimPO' }, null, 2));
                  } else {
                    setTestArgsJson(JSON.stringify({ sections: [] }, null, 2));
                  }
                }}
                className={`w-full text-left rounded-xl p-3 border transition-all flex items-start gap-3 ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-950/60 shadow-md ring-1 ring-indigo-500/40' 
                    : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
                }`}
              >
                <div className="mt-0.5">{getToolIcon(tool.category)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-300">{tool.name}</span>
                    <span className="text-[9.5px] bg-slate-800 px-1.5 py-0.2 rounded font-mono text-slate-400">
                      {tool.callCount} calls
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">{tool.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Tool Details & Manual Test Workbench */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div>
              <h3 className="font-mono text-sm font-bold text-indigo-400">{selectedTool?.name}</h3>
              <p className="text-xs text-slate-300">{selectedTool?.description}</p>
            </div>
            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-mono text-indigo-300 border border-indigo-500/30">
              {selectedTool?.category}
            </span>
          </div>

          {/* Schema Info */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-amber-400 font-bold block mb-1">Expected Inputs:</span>
              <ul className="list-disc list-inside text-slate-300 space-y-0.5 text-[11px]">
                {selectedTool?.schema.inputs.map((inp, idx) => (
                  <li key={idx}>{inp}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-emerald-400 font-bold block mb-1">Return Format:</span>
              <p className="text-slate-300 text-[11px]">{selectedTool?.schema.output}</p>
            </div>
          </div>

          {/* Test Workbench */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-300">MCP Manual Test Workbench</span>
              <button
                onClick={handleRunToolTest}
                disabled={isTesting}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-500"
              >
                <Play className="h-3 w-3" />
                <span>{isTesting ? 'Executing...' : 'Invoke Tool'}</span>
              </button>
            </div>

            <textarea
              value={testArgsJson}
              onChange={(e) => setTestArgsJson(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 mb-3"
              rows={4}
            />

            {toolResult && (
              <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs border border-emerald-900/50">
                <span className="text-emerald-400 font-bold block mb-1">MCP Response Output:</span>
                <pre className="text-slate-300 overflow-x-auto max-h-48 text-[11px] leading-relaxed">
                  {JSON.stringify(toolResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

        </div>

      </div>
      )}
    </div>
  );
};
