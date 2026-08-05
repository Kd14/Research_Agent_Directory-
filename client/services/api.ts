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

// --- Research (SSE - see client/hooks/useResearchPipeline.ts for stream consumption) ---

// PATCH the persisted instructionSet and/or currentStepIndex on a paused session so a subsequent
// resume() picks up the edit (the pipeline reads persisted history, never anything client-held).
export async function patchInstructionSet(
  sessionId: string,
  patch: { instructionSet?: InstructionStep[]; currentStepIndex?: number }
) {
  return json(await fetch(`/api/sessions/${sessionId}/instruction-set`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  }));
}

// --- Standalone Document/PDF Converter ---

// Returns the raw PDF Blob directly (not JSON) - this hits the standalone /api/tools/pdf-convert
// endpoint, independent of any research session.
export async function convertMarkdownToPdf(
  markdown: string,
  title?: string,
  renderDiagramsWithLlm?: boolean
): Promise<Blob> {
  const res = await fetch('/api/tools/pdf-convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, title, renderDiagramsWithLlm })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'PDF conversion failed');
  }
  return res.blob();
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

// --- Preferences ---

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  defaultAgentIds?: string[];
  reflectionEnabled?: boolean;
}

export async function fetchPreferences(): Promise<{ preferences: UserPreferences }> {
  return json(await fetch('/api/preferences'));
}

export async function savePreferences(patch: UserPreferences): Promise<{ success: boolean; preferences: UserPreferences }> {
  return json(await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  }));
}
