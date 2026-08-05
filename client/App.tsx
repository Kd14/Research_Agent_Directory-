import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { DocumentPanel } from './components/DocumentPanel';
import { ToolInspector } from './components/ToolInspector';
import { ReportViewer } from './components/ReportViewer';
import { PdfConverterStudio } from './components/PdfConverterStudio';
import { ResearchWorkspace } from './components/ResearchWorkspace';

import { ResearchSessionProvider, useResearchSessionContext } from './state/ResearchSessionContext';

import { SystemStats } from './types';

type Tab = 'research' | 'documents' | 'mcp_tools' | 'report' | 'pdf_studio';

function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>('research');
  const [userPrompt, setUserPrompt] = useState<string>('');

  const {
    documents,
    selectedDocIds,
    setSelectedDocIds,
    toggleDocSelection,
    selectAllDocs,
    uploadDocument,
    createDocSnippet,
    deleteDocument,
    mcpTools,
    executeToolDirect,
    session,
    isExecuting,
    isPaused,
    togglePause,
    resetSession,
    resume,
    preferences,
    updatePreferences
  } = useResearchSessionContext();

  const [stats] = useState<SystemStats>({
    mcpServerStatus: 'online',
    mcpUptime: '99.98%',
    activeAgents: 5,
    totalToolCalls: 63,
    documentsLoaded: 4,
    totalTokensProcessed: 142000
  });

  // Sync the doc-selection / prompt box to whichever session is currently active - covers both a
  // freshly planned run and a resumed one (the pipeline no longer returns this synchronously since
  // resume() streams over SSE rather than a single request/response).
  const lastSyncedSessionId = useRef<string | null>(null);
  useEffect(() => {
    if (session && session.id !== lastSyncedSessionId.current) {
      lastSyncedSessionId.current = session.id;
      setSelectedDocIds(session.selectedDocIds || []);
      setUserPrompt(session.userPrompt || '');
    }
  }, [session, setSelectedDocIds]);

  const handleResetSession = () => {
    resetSession();
    setUserPrompt('');
    setActiveTab('research');
  };

  const handleResumeSession = (sessionId: string) => {
    setActiveTab('research');
    resume(sessionId);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col">

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
        preferences={preferences}
        onSavePreferences={updatePreferences}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">

        {activeTab === 'research' && (
          <ResearchWorkspace
            userPrompt={userPrompt}
            setUserPrompt={setUserPrompt}
            onReportReady={() => setActiveTab('report')}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentPanel
            documents={documents}
            selectedDocIds={selectedDocIds}
            onToggleDocSelection={toggleDocSelection}
            onSelectAllDocs={selectAllDocs}
            onUploadDocument={uploadDocument}
            onCreateDocSnippet={createDocSnippet}
            onDeleteDocument={deleteDocument}
          />
        )}

        {activeTab === 'mcp_tools' && (
          <ToolInspector
            tools={mcpTools}
            onExecuteToolDirect={executeToolDirect}
            citations={session?.citations}
            documents={documents}
          />
        )}

        {/* Standalone document converter, separate from the agentic workflow */}
        {activeTab === 'pdf_studio' && <PdfConverterStudio />}

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

export default function App() {
  return (
    <ResearchSessionProvider>
      <AppShell />
    </ResearchSessionProvider>
  );
}
