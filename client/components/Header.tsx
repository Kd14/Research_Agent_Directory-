import React from 'react';
import {
  Bot,
  Server,
  FileText,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Download,
  FileCode2
} from 'lucide-react';
import { SystemStats } from '../types';
import type { UserPreferences } from '../services/api';
import { SessionMenu } from './SessionMenu';
import { SettingsDialog } from './SettingsDialog';

interface HeaderProps {
  activeTab: 'research' | 'documents' | 'mcp_tools' | 'report' | 'pdf_studio';
  setActiveTab: (tab: 'research' | 'documents' | 'mcp_tools' | 'report' | 'pdf_studio') => void;
  stats: SystemStats;
  isExecuting: boolean;
  isPaused: boolean;
  onPauseToggle: () => void;
  onResetSession: () => void;
  onResumeSession: (sessionId: string) => void;
  hasReport: boolean;
  selectedDocCount: number;
  preferences: UserPreferences;
  onSavePreferences: (patch: UserPreferences) => Promise<UserPreferences>;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  stats,
  isExecuting,
  isPaused,
  onPauseToggle,
  onResetSession,
  onResumeSession,
  hasReport,
  selectedDocCount,
  preferences,
  onSavePreferences
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                NexusAgent <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">MCP Orchestrator</span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Managed Agentic Research Network • Gemini 3.6 Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80">
          <button
            id="tab-research"
            onClick={() => setActiveTab('research')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'research'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Research Studio</span>
            {isExecuting && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>

          <button
            id="tab-documents"
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'documents'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Documents</span>
            {selectedDocCount > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                {selectedDocCount}
              </span>
            )}
          </button>

          <button
            id="tab-mcp"
            onClick={() => setActiveTab('mcp_tools')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'mcp_tools'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>MCP Tools</span>
          </button>

          <button
            id="tab-pdf-studio"
            onClick={() => setActiveTab('pdf_studio')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'pdf_studio'
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span>PDF Studio</span>
          </button>

          {hasReport && (
            <button
              id="tab-report"
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'report'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                  : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Final Report</span>
            </button>
          )}
        </nav>

        {/* Live Controls & MCP Status */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1 text-xs text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium">MCP Server: Online</span>
          </div>

          {isExecuting && (
            <button
              id="btn-pause-toggle"
              onClick={onPauseToggle}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all ${
                isPaused 
                  ? 'bg-emerald-600 hover:bg-emerald-500' 
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{isPaused ? 'Resume' : 'Intervene / Pause'}</span>
            </button>
          )}

          <a
            href="/api/download-zip"
            download="aether_orchestrator_source.zip"
            title="Download full project codebase (.zip)"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Export ZIP</span>
          </a>

          <SettingsDialog preferences={preferences} onSave={onSavePreferences} />

          <SessionMenu onResumeSession={onResumeSession} />

          <button
            id="btn-reset-session"
            onClick={onResetSession}
            title="Reset Research Session"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </header>
  );
};
