import React from 'react';
import { Send, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { SamplePromptsGrid } from './SamplePromptsGrid';
import type { ResearchSession } from '../types';

// Domain-specific specialists the user can opt in/out of per run. 'lead' (orchestrator)
// and 'synthesis' (final report writer) are always deployed regardless of this selection.
export const DOMAIN_SUB_AGENTS = [
  {
    id: 'literature',
    name: 'Agent Hypatia',
    title: 'Literature & Evidence Researcher',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'pipeline',
    name: 'Agent Turing',
    title: 'Quantitative & Technical Systems Analyst',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'validation',
    name: 'Agent Veritas',
    title: 'Fact-Checking & Logic Auditor',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  }
];

interface ChatPanelProps {
  userPrompt: string;
  setUserPrompt: (value: string) => void;
  onStartResearch: (promptOverride?: string) => void;
  isPlanning: boolean;
  isExecuting: boolean;
  session: ResearchSession | null;
  selectedDocCount: number;
  selectedAgentIds: string[];
  onToggleSubAgent: (id: string) => void;
  errorMessage: string | null;
  onDismissError: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  userPrompt,
  setUserPrompt,
  onStartResearch,
  isPlanning,
  isExecuting,
  session,
  selectedDocCount,
  selectedAgentIds,
  onToggleSubAgent,
  errorMessage,
  onDismissError
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Initiate Agentic Technical Research
          </h2>
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Context: <strong className="text-indigo-600 dark:text-indigo-400">{selectedDocCount} docs attached</strong>
        </span>
      </div>

      {/* Input Row */}
      <div className="flex gap-2 mb-4">
        <textarea
          id="user-research-prompt-input"
          placeholder="Ask a technical research question based on your uploaded spec sheets or literature (e.g. Audit 1M token context window memory bandwidth in Transformer-XL spec vs H100 GPU cluster...)"
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={2}
          className="flex-1 rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          id="btn-submit-research"
          onClick={() => onStartResearch()}
          disabled={isPlanning || isExecuting}
          className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 shrink-0"
        >
          {isPlanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mb-1" />
              <span>Decomposing...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mb-1" />
              <span>Launch MCP Research</span>
            </>
          )}
        </button>
      </div>

      {/* Sub-Agent Deployment Selection */}
      {!session && (
        <div className="mb-4">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Deploy Domain Specialists (Dr. Astra & Agent Nexus always run):
          </span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {DOMAIN_SUB_AGENTS.map(agent => {
              const isSelected = selectedAgentIds.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onToggleSubAgent(agent.id)}
                  title={agent.title}
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-left transition-all ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/50'
                      : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-100 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <img src={agent.avatar} alt={agent.name} className="h-5 w-5 rounded-full object-cover" />
                  <span className="flex flex-col leading-tight">
                    <span className={`text-[11px] font-semibold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {agent.name}
                    </span>
                    <span className="text-[9.5px] text-slate-400 dark:text-slate-500">{agent.title.split('&')[0].trim()}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={onDismissError} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Sample Prompts Grid */}
      {!session && (
        <SamplePromptsGrid
          onSelectPrompt={(p) => {
            setUserPrompt(p);
            onStartResearch(p);
          }}
        />
      )}
    </div>
  );
};
