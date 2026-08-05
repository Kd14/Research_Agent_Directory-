import { describe, expect, it } from 'vitest';
import { renderMarkdownReportToDocx } from './DocxReportRenderer';

const SAMPLE_MARKDOWN = [
  '# Research Report',
  '',
  '## Executive Summary',
  '',
  'This is a *test* with **bold**, `inline code`, and a [link](https://example.com).',
  '',
  '- First item',
  '  - Nested item',
  '- Second item',
  '',
  '1. Step one',
  '2. Step two',
  '',
  '> A blockquote citation.',
  '',
  '| A | B |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '```js',
  'console.log(1)',
  '```',
  '',
  '---'
].join('\n');

// DOCX is a zip archive (starts with the "PK\x03\x04" local-file-header signature) - we assert that
// rather than fully unzipping/parsing document.xml, since asserting on a valid OOXML container
// without pulling in a zip-reading dependency is enough to catch a broken/empty Packer.toBuffer() call.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

describe('renderMarkdownReportToDocx', () => {
  it('produces a non-empty, valid zip-container buffer', async () => {
    const buf = await renderMarkdownReportToDocx({ markdown: SAMPLE_MARKDOWN, title: 'Test Report' });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4)).toEqual(ZIP_SIGNATURE);
  });

  it('produces a larger document for richer markdown', async () => {
    const short = await renderMarkdownReportToDocx({ markdown: 'Just one line.' });
    const long = await renderMarkdownReportToDocx({ markdown: SAMPLE_MARKDOWN });
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('handles minimal markdown without throwing', async () => {
    const buf = await renderMarkdownReportToDocx({ markdown: 'Just one line.' });
    expect(buf.length).toBeGreaterThan(0);
  });

  it('handles markdown with no headings without throwing', async () => {
    const buf = await renderMarkdownReportToDocx({ markdown: '- a\n- b\n- c' });
    expect(buf.length).toBeGreaterThan(0);
  });
});
