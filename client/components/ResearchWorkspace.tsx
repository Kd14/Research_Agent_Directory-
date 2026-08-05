import React, { useEffect, useRef, useState } from 'react';
import { useResearchSessionContext } from '../state/ResearchSessionContext';
import { AgentGraphVisualizer } from './AgentGraphVisualizer';
import { ChatPanel, DOMAIN_SUB_AGENTS } from './ChatPanel';
import { InstructionSetEditor } from './InstructionSetEditor';
import { ProcessLogsTerminal } from './ProcessLogsTerminal';

interface ResearchWorkspaceProps {
  userPrompt: string;
  setUserPrompt: (value: string) => void;
  onReportReady: () => void;
}

// The "Research Studio" tab body, extracted out of App.tsx: prompt/agent-picker header, then (once a
// session exists) the live agent graph, instruction set editor, and process log terminal.
export const ResearchWorkspace: React.FC<ResearchWorkspaceProps> = ({ userPrompt, setUserPrompt, onReportReady }) => {
  const {
    session,
    isPlanning,
    isExecuting,
    isPaused,
    errorMessage,
    currentStepIndex,
    activeToolCall,
    selectedDocIds,
    mcpTools,
    preferences,
    run,
    executeStepManual,
    updateStep,
    addStep,
    deleteStep,
    clearLogs,
    dismissError
  } = useResearchSessionContext();

  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(DOMAIN_SUB_AGENTS.map(a => a.id));
  const toggleSubAgent = (id: string) => {
    setSelectedAgentIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least one domain specialist active
        return prev.filter(a => a !== id);
      }
      return [...prev, id];
    });
  };

  // Preferences load asynchronously after mount, so the default-agent selection above starts as
  // "all agents" and is corrected once - a saved defaultAgentIds preference arrives - rather than
  // blocking the first render on that fetch. Only applies once so it never clobbers a selection the
  // user has already started adjusting.
  const appliedDefaultAgentsRef = useRef(false);
  useEffect(() => {
    if (appliedDefaultAgentsRef.current) return;
    if (!preferences.defaultAgentIds?.length) return;
    appliedDefaultAgentsRef.current = true;
    setSelectedAgentIds(preferences.defaultAgentIds);
  }, [preferences.defaultAgentIds]);

  const reportReadyFiredRef = useRef(false);
  useEffect(() => {
    if (session?.finalReport && !reportReadyFiredRef.current) {
      reportReadyFiredRef.current = true;
      onReportReady();
    }
    if (!session?.finalReport) {
      reportReadyFiredRef.current = false;
    }
  }, [session?.finalReport, onReportReady]);

  const handleStartResearch = (promptOverride?: string) => {
    run(promptOverride || userPrompt, selectedDocIds, selectedAgentIds, preferences.reflectionEnabled);
  };

  return (
    <div className="space-y-6">
      <ChatPanel
        userPrompt={userPrompt}
        setUserPrompt={setUserPrompt}
        onStartResearch={handleStartResearch}
        isPlanning={isPlanning}
        isExecuting={isExecuting}
        session={session}
        selectedDocCount={selectedDocIds.length}
        selectedAgentIds={selectedAgentIds}
        onToggleSubAgent={toggleSubAgent}
        errorMessage={errorMessage}
        onDismissError={dismissError}
      />

      {session && (
        <div className="space-y-6">
          <AgentGraphVisualizer
            agents={session.agents}
            activeStepAgentId={session.instructionSet[currentStepIndex]?.assignedAgentId}
            isExecuting={isExecuting}
            activeToolCall={activeToolCall}
            mcpTools={mcpTools}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
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

            <ProcessLogsTerminal
              logs={session.logs}
              agents={session.agents}
              onClearLogs={clearLogs}
            />
          </div>
        </div>
      )}
    </div>
  );
};
