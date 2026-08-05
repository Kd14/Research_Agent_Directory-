import React, { createContext, useContext } from 'react';
import { useDocuments } from '../hooks/useDocuments';
import { useMcpTools } from '../hooks/useMcpTools';
import { usePreferences } from '../hooks/usePreferences';
import { useResearchPipeline } from '../hooks/useResearchPipeline';

type ResearchSessionContextValue = ReturnType<typeof useDocuments> &
  ReturnType<typeof useMcpTools> &
  ReturnType<typeof usePreferences> &
  ReturnType<typeof useResearchPipeline>;

const ResearchSessionContext = createContext<ResearchSessionContextValue | undefined>(undefined);

// Wraps the hooks every research-related view needs (documents, MCP tool inspector metadata,
// persisted user preferences, the SSE research pipeline itself) in a single context so leaf
// components stop needing a dozen props drilled through App.tsx.
export const ResearchSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const documents = useDocuments();
  const mcpTools = useMcpTools();
  const preferences = usePreferences();
  const pipeline = useResearchPipeline();

  const value: ResearchSessionContextValue = { ...documents, ...mcpTools, ...preferences, ...pipeline };

  return <ResearchSessionContext.Provider value={value}>{children}</ResearchSessionContext.Provider>;
};

export function useResearchSessionContext(): ResearchSessionContextValue {
  const ctx = useContext(ResearchSessionContext);
  if (!ctx) {
    throw new Error('useResearchSessionContext must be used within a ResearchSessionProvider');
  }
  return ctx;
}
