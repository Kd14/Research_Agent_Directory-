import React, { useState } from 'react';
import { Send, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { AgentGraphVisualizer } from './components/AgentGraphVisualizer';
import { InstructionSetEditor } from './components/InstructionSetEditor';
import { ProcessLogsTerminal } from './components/ProcessLogsTerminal';
import { DocumentManager } from './components/DocumentManager';
import { MCPToolsInspector } from './components/MCPToolsInspector';
import { ReportViewer } from './components/ReportViewer';
import { SamplePromptsGrid } from './components/SamplePromptsGrid';

import { useDocuments } from './hooks/useDocuments';
import { useMcpTools } from './hooks/useMcpTools';
import { useResearchSession } from './hooks/useResearchSession';

import { SystemStats } from './types';

// Domain-specific specialists the user can opt in/out of per run. 'lead' (orchestrator)
// and 'synthesis' (final report writer) are always deployed regardless of this selection.
const DOMAIN_SUB_AGENTS = [
  {
    id: 'literature',
    name: 'Agent Hypatia',
    title: 'Literature & Theory Researcher',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'pipeline',
    name: 'Agent Turing',
    title: 'Model Pipeline & Compute Architect',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'validation',
    name: 'Agent Veritas',
    title: 'Fact-Checking & Logic Auditor',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
  }
];

export default function App() {
  // Navigation & View Tabs
  const [activeTab, setActiveTab] = useState<'research' | 'documents' | 'mcp_tools' | 'report'>('research');

  // Sub-Agent Deployment Selection (domain specialists only; lead + synthesis always run)
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(
    DOMAIN_SUB_AGENTS.map(a => a.id)
  );
  const toggleSubAgent = (id: string) => {
    setSelectedAgentIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least one domain specialist active
        return prev.filter(a => a !== id);
      }
      return [...prev, id];
    });
  };

  const [userPrompt, setUserPrompt] = useState<string>('');

  const {
    documents,
    selectedDocIds,
    setSelectedDocIds,
    toggleDocSelection,
    selectAllDocs,
    uploadDocument,
    createDocSnippet,
    deleteDocument
  } = useDocuments();

  const { mcpTools, executeToolDirect } = useMcpTools();

  const {
    session,
    isPlanning,
    isExecuting,
    isPaused,
    errorMessage,
    currentStepIndex,
    activeToolCall,
    startResearch,
    executeStepManual,
    resetSession,
    resumeSession,
    updateStep,
    addStep,
    deleteStep,
    clearLogs,
    dismissError,
    togglePause
  } = useResearchSession(selectedDocIds, selectedAgentIds, () => setActiveTab('report'));

  const [stats] = useState<SystemStats>({
    mcpServerStatus: 'online',
    mcpUptime: '99.98%',
    activeAgents: 5,
    totalToolCalls: 63,
    documentsLoaded: 4,
    totalTokensProcessed: 142000
  });

  const handleStartResearch = (promptOverride?: string) => {
    startResearch(promptOverride || userPrompt);
  };

  const handleResetSession = () => {
    resetSession();
    setUserPrompt('');
    setActiveTab('research');
  };

  const handleResumeSession = async (sessionId: string) => {
    const result = await resumeSession(sessionId);
    if (result) {
      setSelectedDocIds(result.selectedDocIds);
      setUserPrompt(result.userPrompt);
      setActiveTab(result.hasReport ? 'report' : 'research');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col">

      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        isExecuting={isExecuting}
        isPaused={isPaused}
        onPauseToggle={togglePause}
        onResetSession={handleResetSession}
        onResumeSession={handleResumeSession}
        hasReport={Boolean(session?.finalReport)}
        selectedDocCount={selectedDocIds.length}
      />

      {/* Main Body Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">

        {/* TAB 1: RESEARCH STUDIO */}
        {activeTab === 'research' && (
          <div className="space-y-6">

            {/* Prompt & Document Picker Header Bar */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Initiate Agentic Technical Research
                  </h2>
                </div>

                <span className="text-xs text-slate-500 font-mono">
                  Context: <strong className="text-indigo-600 dark:text-indigo-400">{selectedDocIds.length} docs attached</strong>
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
                  onClick={() => handleStartResearch()}
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
                          onClick={() => toggleSubAgent(agent.id)}
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
                  <button onClick={dismissError} className="font-bold hover:underline">Dismiss</button>
                </div>
              )}

              {/* Sample Prompts Grid */}
              {!session && (
                <SamplePromptsGrid
                  onSelectPrompt={(p) => {
                    setUserPrompt(p);
                    handleStartResearch(p);
                  }}
                />
              )}
            </div>

            {/* Active Session Views */}
            {session && (
              <div className="space-y-6">

                {/* Agent Interaction Graph */}
                <AgentGraphVisualizer
                  agents={session.agents}
                  activeStepAgentId={session.instructionSet[currentStepIndex]?.assignedAgentId}
                  isExecuting={isExecuting}
                  activeToolCall={activeToolCall}
                  mcpTools={mcpTools}
                />

                {/* Split Column: Instruction Set & Real-Time Logs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                  {/* Left: Decomposed Instruction Set */}
                  <InstructionSetEditor
                    instructionSet={session.instructionSet}
                    currentStepIndex={currentStepIndex}
                    isExecuting={isExecuting}
                    isPaused={isPaused}
                    agents={session.agents}
                    onUpdateStep={updateStep}
                    onAddStep={addStep}
                    onDeleteStep={deleteStep}
                    onExecuteStepManual={executeStepManual}
                  />

                  {/* Right: Process Logs Terminal */}
                  <ProcessLogsTerminal
                    logs={session.logs}
                    agents={session.agents}
                    onClearLogs={clearLogs}
                  />

                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 2: DOCUMENTS LIBRARY */}
        {activeTab === 'documents' && (
          <DocumentManager
            documents={documents}
            selectedDocIds={selectedDocIds}
            onToggleDocSelection={toggleDocSelection}
            onSelectAllDocs={selectAllDocs}
            onUploadDocument={uploadDocument}
            onCreateDocSnippet={createDocSnippet}
            onDeleteDocument={deleteDocument}
          />
        )}

        {/* TAB 3: MCP TOOLS INSPECTOR */}
        {activeTab === 'mcp_tools' && (
          <MCPToolsInspector
            tools={mcpTools}
            onExecuteToolDirect={executeToolDirect}
          />
        )}

        {/* TAB 4: FINAL REPORT VIEWER */}
        {activeTab === 'report' && session?.finalReport && (
          <ReportViewer
            reportMarkdown={session.finalReport}
            sessionId={session.id}
            sessionTitle={session.title}
            userPrompt={session.userPrompt}
            onAskFollowUp={(query) => {
              setUserPrompt(`Follow-up Refinement: ${query}`);
              setActiveTab('research');
            }}
            onBackToStudio={() => setActiveTab('research')}
          />
        )}

      </main>

    </div>
  );
}
