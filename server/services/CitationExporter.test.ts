import { describe, expect, it } from 'vitest';
import type { CitationRecord } from '../../client/types';
import { citationsToCsv, citationsToJson, citationsToMarkdown } from './CitationExporter';

const citations: CitationRecord[] = [
  {
    id: 'c1',
    toolName: 'mcp_web_grounding',
    sourceUrl: 'https://example.com/paper',
    claim: 'Model achieves 92% accuracy, with a "quoted" term',
    consumedBy: ['step-1'],
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  {
    id: 'c2',
    toolName: 'mcp_doc_search',
    docId: 'doc-1',
    chunkId: 'chunk-3',
    claim: 'Spec requires 80GB VRAM',
    consumedBy: [],
    createdAt: '2026-07-31T00:01:00.000Z'
  }
];

describe('citationsToJson', () => {
  it('round-trips the citation records', () => {
    const parsed = JSON.parse(citationsToJson(citations));
    expect(parsed).toEqual(citations);
  });
});

describe('citationsToCsv', () => {
  it('emits a header row plus one row per citation', () => {
    const csv = citationsToCsv(citations);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('id,toolName,docId,chunkId,sourceUrl,claim,consumedBy,createdAt');
  });

  it('quotes fields containing commas or quotes', () => {
    const csv = citationsToCsv(citations);
    expect(csv).toContain('"Model achieves 92% accuracy, with a ""quoted"" term"');
  });
});

describe('citationsToMarkdown', () => {
  it('reports no citations recorded when the list is empty', () => {
    expect(citationsToMarkdown([])).toContain('No citations recorded');
  });

  it('resolves consumedBy step ids to titles when provided', () => {
    const md = citationsToMarkdown(citations, { 'step-1': 'Gather benchmark data' });
    expect(md).toContain('Consumed by: Gather benchmark data');
    expect(md).toContain('Consumed by: not yet consumed');
  });

  it('includes the source tool, url, and document reference', () => {
    const md = citationsToMarkdown(citations);
    expect(md).toContain('mcp_web_grounding');
    expect(md).toContain('[https://example.com/paper](https://example.com/paper)');
    expect(md).toContain('doc:doc-1#chunk-3');
  });
});
