import { describe, expect, it } from 'vitest';
import { renderMarkdownReportToPptxOutline } from './PresentationOutlineRenderer';

const SAMPLE_MARKDOWN = [
  '# Research Report Title',
  '',
  '## Executive Summary',
  '',
  'This report covers **key findings** across three domains.',
  '',
  '- Finding one',
  '  - Supporting detail',
  '- Finding two',
  '',
  '## Methodology',
  '',
  '> We used a rigorous multi-agent pipeline.',
  '',
  '| Metric | Value |',
  '|---|---|',
  '| Accuracy | 92% |',
  '',
  '### Sub-detail heading',
  '',
  'Some more detail text.'
].join('\n');

// PPTX is a zip archive, same reasoning as DocxReportRenderer.test.ts for asserting on the
// zip-container signature rather than pulling in a zip-reading dependency.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

describe('renderMarkdownReportToPptxOutline', () => {
  it('produces a non-empty, valid zip-container buffer', async () => {
    const buf = await renderMarkdownReportToPptxOutline({ markdown: SAMPLE_MARKDOWN, title: 'Research Report Title' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4)).toEqual(ZIP_SIGNATURE);
  });

  it('produces more slide content for a multi-section report than a single-section one', async () => {
    const single = await renderMarkdownReportToPptxOutline({ markdown: '# T\n\n## Only Section\n\nSome text.' });
    const multi = await renderMarkdownReportToPptxOutline({ markdown: SAMPLE_MARKDOWN });
    expect(multi.length).toBeGreaterThan(single.length);
  });

  it('handles markdown with no H2 sections by folding content into an Overview slide', async () => {
    const buf = await renderMarkdownReportToPptxOutline({ markdown: '# Title Only\n\nJust a paragraph, no sections.' });
    expect(buf.length).toBeGreaterThan(0);
  });

  it('paginates a section with many bullets across multiple slides without throwing', async () => {
    const manyBullets = Array.from({ length: 25 }, (_, i) => `- Bullet number ${i}`).join('\n');
    const buf = await renderMarkdownReportToPptxOutline({ markdown: `# T\n\n## Long Section\n\n${manyBullets}` });
    expect(buf.length).toBeGreaterThan(0);
  });
});
