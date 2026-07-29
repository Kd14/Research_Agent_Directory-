import type { DocumentCategory, InstructionStep } from '../types';

async function json<T = any>(res: Response): Promise<T> {
  return res.json();
}

// --- Documents ---

export async function fetchDocuments() {
  return json(await fetch('/api/documents'));
}

export async function uploadDocument(file: File, category: DocumentCategory, title?: string, tags?: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  if (title) formData.append('title', title);
  if (tags) formData.append('tags', tags);

  return json(await fetch('/api/documents/upload', { method: 'POST', body: formData }));
}

export async function createDocument(title: string, category: DocumentCategory, content: string, tags?: string[]) {
  return json(await fetch('/api/documents/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category, content, tags })
  }));
}

export async function deleteDocument(docId: string) {
  return json(await fetch(`/api/documents/${docId}`, { method: 'DELETE' }));
}

// --- MCP Tools ---

export async function fetchMcpTools() {
  return json(await fetch('/api/mcp/tools'));
}

export async function executeMcpTool(toolName: string, args: Record<string, any>, agentId = 'user_direct') {
  return json(await fetch('/api/mcp/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName, args, agentId })
  }));
}

// --- Research ---

export async function planResearch(userPrompt: string, docIds: string[], activeAgentIds: string[]) {
  return json(await fetch('/api/research/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPrompt, docIds, activeAgentIds })
  }));
}

export async function executeResearchStep(
  step: InstructionStep,
  selectedDocIds: string[],
  userFeedback: string | undefined,
  sessionId: string
) {
  return json(await fetch('/api/research/execute-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, selectedDocIds, userFeedback, sessionId })
  }));
}

export async function synthesizeReport(
  userPrompt: string,
  instructionSet: InstructionStep[],
  agentOutputs: Record<string, string>,
  selectedDocIds: string[],
  sessionId: string
) {
  return json(await fetch('/api/research/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPrompt, instructionSet, agentOutputs, selectedDocIds, sessionId })
  }));
}

// --- Sessions ---

export async function listSessions() {
  return json(await fetch('/api/sessions'));
}

export async function loadSession(sessionId: string) {
  return json(await fetch(`/api/sessions/${sessionId}`));
}

export async function renameSession(sessionId: string, title: string) {
  return json(await fetch(`/api/sessions/${sessionId}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }));
}

export async function duplicateSession(sessionId: string) {
  return json(await fetch(`/api/sessions/${sessionId}/duplicate`, { method: 'POST' }));
}

export async function deleteSession(sessionId: string) {
  return json(await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' }));
}
