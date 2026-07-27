import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  FileText, 
  Play, 
  Pause, 
  RotateCcw, 
  Layers, 
  Activity, 
  Sliders, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Server
} from 'lucide-react';
import { Header } from './components/Header';
import { AgentGraphVisualizer } from './components/AgentGraphVisualizer';
import { InstructionSetEditor } from './components/InstructionSetEditor';
import { ProcessLogsTerminal } from './components/ProcessLogsTerminal';
import { DocumentManager } from './components/DocumentManager';
import { MCPToolsInspector } from './components/MCPToolsInspector';
import { ReportViewer } from './components/ReportViewer';
import { SamplePromptsGrid } from './components/SamplePromptsGrid';

import {
  TechDocument,
  InstructionStep,
  AgentNode,
  MCPLogEntry,
  MCPTool,
  ResearchSession,
  DocumentCategory,
  SystemStats
} from './types';

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

  // Documents State
  const [documents, setDocuments] = useState<TechDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // MCP Tools State
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);

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

  // Prompt & Session State
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Execution Step State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [agentOutputs, setAgentOutputs] = useState<Record<string, string>>({});
  const [activeToolCall, setActiveToolCall] = useState<{ toolName: string; agentId: string } | undefined>();

  // Guards against re-entrant execution: `session` changes (agent status/log
  // updates) fire mid-step, and without these the effect below would kick
  // off duplicate concurrent runs of the same step/synthesis call.
  const inFlightStepRef = useRef<number | null>(null);
  const synthesisInFlightRef = useRef<boolean>(false);

  // System Stats
  const [stats, setStats] = useState<SystemStats>({
    mcpServerStatus: 'online',
    mcpUptime: '99.98%',
    activeAgents: 5,
    totalToolCalls: 63,
    documentsLoaded: 4,
    totalTokensProcessed: 142000
  });

  // Load Initial Documents and MCP Tools
  useEffect(() => {
    fetchDocuments();
    fetchMCPTools();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
        // Default select all initial documents
        setSelectedDocIds(data.documents.map((d: TechDocument) => d.id));
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const fetchMCPTools = async () => {
    try {
      const res = await fetch('/api/mcp/tools');
      const data = await res.json();
      if (data.tools) {
        setMcpTools(data.tools);
      }
    } catch (err) {
      console.error('Failed to fetch MCP tools:', err);
    }
  };

  // Document Operations
  const handleToggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllDocs = (select: boolean) => {
    setSelectedDocIds(select ? documents.map(d => d.id) : []);
  };

  const handleUploadDocument = async (file: File, category: DocumentCategory, title?: string, tags?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    if (title) formData.append('title', title);
    if (tags) formData.append('tags', tags);

    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success && data.document) {
      setDocuments(prev => [data.document, ...prev]);
      setSelectedDocIds(prev => [...prev, data.document.id]);
    }
  };

  const handleCreateDocSnippet = async (title: string, category: DocumentCategory, content: string, tags?: string[]) => {
    const res = await fetch('/api/documents/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, content, tags })
    });
    const data = await res.json();
    if (data.success && data.document) {
      setDocuments(prev => [data.document, ...prev]);
      setSelectedDocIds(prev => [...prev, data.document.id]);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    setDocuments(prev => prev.filter(d => d.id !== docId));
    setSelectedDocIds(prev => prev.filter(id => id !== docId));
  };

  // Direct MCP Tool Execution
  const handleExecuteToolDirect = async (toolName: string, args: Record<string, any>) => {
    const res = await fetch('/api/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName, args, agentId: 'user_direct' })
    });
    return await res.json();
  };

  // Research Planning & Orchestration
  const handleStartResearch = async (promptOverride?: string) => {
    const targetPrompt = promptOverride || userPrompt;
    if (!targetPrompt.trim()) return;

    setIsPlanning(true);
    setSession(null);
    setAgentOutputs({});
    setCurrentStepIndex(0);
    setErrorMessage(null);
    inFlightStepRef.current = null;
    synthesisInFlightRef.current = false;

    try {
      const res = await fetch('/api/research/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: targetPrompt,
          docIds: selectedDocIds,
          activeAgentIds: selectedAgentIds
        })
      });
      const data = await res.json();

      if (data.session) {
        setSession(data.session);
        setIsExecuting(true);
        setIsPaused(false);
      } else {
        setErrorMessage(data.error || 'Failed to create research plan.');
      }
    } catch (err) {
      console.error('Failed to create research plan:', err);
      setErrorMessage('Failed to reach the research server. Is it running?');
    } finally {
      setIsPlanning(false);
    }
  };

  // Automatic Step Execution Loop
  useEffect(() => {
    if (!isExecuting || isPaused || !session) return;

    const steps = session.instructionSet;
    if (currentStepIndex >= steps.length) {
      // All steps completed -> Synthesize Final Report
      if (!synthesisInFlightRef.current) {
        synthesisInFlightRef.current = true;
        handleSynthesizeReport();
      }
      return;
    }

    if (inFlightStepRef.current === currentStepIndex) return;
    executeStep(currentStepIndex);
  }, [isExecuting, isPaused, currentStepIndex, session]);

  const executeStep = async (stepIdx: number, userFeedback?: string) => {
    if (!session) return;
    if (inFlightStepRef.current === stepIdx) return;
    const currentStep = session.instructionSet[stepIdx];
    if (!currentStep) return;

    inFlightStepRef.current = stepIdx;
    const agentId = currentStep.assignedAgentId;

    // Update agent state to 'analyzing'
    updateAgentState(agentId, {
      status: 'analyzing',
      thoughtTrace: [`Executing Step ${stepIdx + 1}: ${currentStep.title}`, `Directive: ${currentStep.instruction}`]
    });

    // Add log
    addLogEntry({
      id: `log_${Date.now()}_start`,
      timestamp: new Date().toLocaleTimeString(),
      agentId,
      agentName: `${currentStep.agentName}`,
      type: userFeedback ? 'user_intervention' : 'agent_message',
      message: `Initiating research step: "${currentStep.title}"`,
      details: userFeedback ? `Human Feedback: ${userFeedback}` : undefined,
      level: 'info'
    });

    try {
      // Simulate tool call badge
      if (currentStep.requiredTools.length > 0) {
        setActiveToolCall({ toolName: currentStep.requiredTools[0], agentId });
      }

      const res = await fetch('/api/research/execute-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: currentStep,
          selectedDocIds,
          userFeedback
        })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Agent step execution failed');
      }

      // Log MCP tool execution with the actual result returned by the tool server
      if (data.toolCallUsed) {
        addLogEntry({
          id: `log_${Date.now()}_tool`,
          timestamp: new Date().toLocaleTimeString(),
          agentId,
          agentName: currentStep.agentName,
          type: 'mcp_tool_call',
          toolName: data.toolCallUsed,
          args: data.toolArgs,
          result: data.toolResult,
          message: `Invoked MCP tool ${data.toolCallUsed}`,
          level: 'mcp_tool'
        });
      }

      // Record agent output
      setAgentOutputs(prev => ({
        ...prev,
        [currentStep.id]: data.agentOutput
      }));

      // Update agent state to 'completed'
      updateAgentState(agentId, {
        status: 'completed',
        progress: 100,
        output: data.agentOutput,
        thoughtTrace: data.thoughtTrace || ['Step completed successfully.']
      });

      // Update instruction step status in session
      setSession(prev => {
        if (!prev) return null;
        const updatedSteps = [...prev.instructionSet];
        updatedSteps[stepIdx] = {
          ...updatedSteps[stepIdx],
          status: 'completed',
          outputSummary: data.keyTakeaways?.join('; ')
        };
        return {
          ...prev,
          instructionSet: updatedSteps
        };
      });

      addLogEntry({
        id: `log_${Date.now()}_done`,
        timestamp: new Date().toLocaleTimeString(),
        agentId,
        agentName: currentStep.agentName,
        type: 'agent_message',
        message: `Step ${stepIdx + 1} finalized: ${data.keyTakeaways?.[0] || 'Analysis complete.'}`,
        level: 'success'
      });

      setActiveToolCall(undefined);

      // Delay slightly for smooth visual progression
      setTimeout(() => {
        inFlightStepRef.current = null;
        if (!isPaused) {
          setCurrentStepIndex(prev => prev + 1);
        }
      }, 1200);

    } catch (err: any) {
      console.error('Step execution error:', err);
      updateAgentState(agentId, { status: 'error' });
      setErrorMessage(err.message || 'Agent step execution failed');
      setIsPaused(true);
      inFlightStepRef.current = null;
    }
  };

  // Synthesize Final Report
  const handleSynthesizeReport = async () => {
    if (!session) return;

    updateAgentState('synthesis', {
      status: 'analyzing',
      thoughtTrace: ['Lead Orchestrator compiling final Markdown Research Report...']
    });

    addLogEntry({
      id: `log_${Date.now()}_syn`,
      timestamp: new Date().toLocaleTimeString(),
      agentId: 'lead',
      agentName: 'Dr. Astra (Lead Orchestrator)',
      type: 'orchestrator_decision',
      message: 'All instruction steps finalized. Compiling final synthesized report with Mermaid diagrams.',
      level: 'info'
    });

    try {
      const res = await fetch('/api/research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: session.userPrompt,
          instructionSet: session.instructionSet,
          agentOutputs,
          selectedDocIds
        })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Report synthesis failed');
      }

      setSession(prev => prev ? {
        ...prev,
        status: 'completed',
        finalReport: data.report
      } : null);

      updateAgentState('synthesis', { status: 'completed', progress: 100 });
      setIsExecuting(false);
      setActiveTab('report');

      addLogEntry({
        id: `log_${Date.now()}_complete`,
        timestamp: new Date().toLocaleTimeString(),
        agentId: 'synthesis',
        agentName: 'Agent Nexus',
        type: 'agent_message',
        message: 'Final research report generated and published to report view.',
        level: 'success'
      });

    } catch (err: any) {
      console.error('Synthesis error:', err);
      updateAgentState('synthesis', { status: 'error' });
      setErrorMessage(err.message || 'Report synthesis failed');
      setIsExecuting(false);
      synthesisInFlightRef.current = false;
    }
  };

  // Helper State Mutators
  const updateAgentState = (agentId: string, updates: Partial<AgentNode>) => {
    setSession(prev => {
      if (!prev || !prev.agents[agentId]) return prev;
      const currentAgent = prev.agents[agentId];
      return {
        ...prev,
        agents: {
          ...prev.agents,
          [agentId]: {
            ...currentAgent,
            ...updates
          }
        }
      };
    });
  };

  const addLogEntry = (entry: MCPLogEntry) => {
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        logs: [...prev.logs, entry]
      };
    });
  };

  // Instruction Step Mutators
  const handleUpdateStep = (updatedStep: InstructionStep) => {
    setSession(prev => {
      if (!prev) return null;
      const newSteps = prev.instructionSet.map(s => s.id === updatedStep.id ? updatedStep : s);
      return { ...prev, instructionSet: newSteps };
    });
  };

  const handleAddStep = (newStep: InstructionStep) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, instructionSet: [...prev.instructionSet, newStep] };
    });
  };

  const handleDeleteStep = (stepId: string) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, instructionSet: prev.instructionSet.filter(s => s.id !== stepId) };
    });
  };

  const handleResetSession = () => {
    setSession(null);
    setIsExecuting(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setAgentOutputs({});
    setUserPrompt('');
    setActiveTab('research');
    inFlightStepRef.current = null;
    synthesisInFlightRef.current = false;
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
        onPauseToggle={() => setIsPaused(p => !p)}
        onResetSession={handleResetSession}
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
                  <button onClick={() => setErrorMessage(null)} className="font-bold hover:underline">Dismiss</button>
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
                    onUpdateStep={handleUpdateStep}
                    onAddStep={handleAddStep}
                    onDeleteStep={handleDeleteStep}
                    onExecuteStepManual={(idx, feedback) => {
                      setCurrentStepIndex(idx);
                      setIsExecuting(true);
                      setIsPaused(false);
                      executeStep(idx, feedback);
                    }}
                  />

                  {/* Right: Process Logs Terminal */}
                  <ProcessLogsTerminal
                    logs={session.logs}
                    agents={session.agents}
                    onClearLogs={() => setSession(prev => prev ? { ...prev, logs: [] } : null)}
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
            onToggleDocSelection={handleToggleDocSelection}
            onSelectAllDocs={handleSelectAllDocs}
            onUploadDocument={handleUploadDocument}
            onCreateDocSnippet={handleCreateDocSnippet}
            onDeleteDocument={handleDeleteDocument}
          />
        )}

        {/* TAB 3: MCP TOOLS INSPECTOR */}
        {activeTab === 'mcp_tools' && (
          <MCPToolsInspector
            tools={mcpTools}
            onExecuteToolDirect={handleExecuteToolDirect}
          />
        )}

        {/* TAB 4: FINAL REPORT VIEWER */}
        {activeTab === 'report' && session?.finalReport && (
          <ReportViewer
            reportMarkdown={session.finalReport}
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
