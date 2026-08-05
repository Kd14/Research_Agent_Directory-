import type { CitationRecord } from '../../client/types';

// P2 "Citation Graph" traceability export: turns the CitationRecord[] already tracked during
// execution (which tool produced a claim, which document/URL backed it, which step consumed it -
// see ExecutionService.recordCitation) into portable formats a researcher can archive or cite from
// outside the app. No LLM involved - this is a pure data transform over already-recorded citations.

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function citationsToJson(citations: readonly CitationRecord[]): string {
  return JSON.stringify(citations, null, 2);
}

export function citationsToCsv(citations: readonly CitationRecord[]): string {
  const header = ['id', 'toolName', 'docId', 'chunkId', 'sourceUrl', 'claim', 'consumedBy', 'createdAt'];
  const rows = citations.map(c =>
    [c.id, c.toolName ?? '', c.docId ?? '', c.chunkId ?? '', c.sourceUrl ?? '', c.claim, c.consumedBy.join('; '), c.createdAt]
      .map(v => csvEscape(String(v)))
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Renders the citation graph as a readable Markdown reference list, resolving each citation's
 * `consumedBy` step ids to human-readable step titles via `stepTitleById` (falls back to the raw id
 * if a step was since removed/edited).
 */
export function citationsToMarkdown(citations: readonly CitationRecord[], stepTitleById: Readonly<Record<string, string>> = {}): string {
  if (!citations.length) return '# Citation Graph\n\nNo citations recorded for this session.\n';

  const lines: string[] = ['# Citation Graph', '', `${citations.length} citation${citations.length === 1 ? '' : 's'} recorded.`, ''];
  citations.forEach((c, i) => {
    const consumers = c.consumedBy.length ? c.consumedBy.map(id => stepTitleById[id] ?? id).join(', ') : 'not yet consumed';
    const sourceBits: string[] = [];
    if (c.toolName) sourceBits.push(c.toolName);
    if (c.sourceUrl) sourceBits.push(`[${c.sourceUrl}](${c.sourceUrl})`);
    if (c.docId) sourceBits.push(`doc:${c.docId}${c.chunkId ? `#${c.chunkId}` : ''}`);

    lines.push(`${i + 1}. **${c.claim}**`);
    lines.push(`   - Source: ${sourceBits.length ? sourceBits.join(' · ') : 'unknown'}`);
    lines.push(`   - Consumed by: ${consumers}`);
    lines.push(`   - Recorded: ${c.createdAt}`);
    lines.push('');
  });
  return lines.join('\n');
}
