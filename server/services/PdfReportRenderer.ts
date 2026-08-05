import fs from 'fs';
import path from 'path';
import puppeteer, { type Browser } from 'puppeteer';
import { Marked, type Tokens } from 'marked';
import katex from 'katex';
import type { LLMProvider } from '../llm/LLMProvider';

// Markdown -> PDF conversion. Math (KaTeX) and mermaid diagrams are rendered deterministically,
// locally, with no LLM call. The one exception is plain-text/ASCII diagram blocks (fenced
// ```diagram blocks): those have no deterministic renderer, so - and only for that - we optionally
// call out to an LLM to convert the text description into real SVG markup before the rest of this
// pipeline runs. Everything else here (math, mermaid, layout, pagination) never touches an LLM.

let browserPromise: Promise<Browser> | undefined;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      // Only ever renders our own already-generated markdown/mermaid content (no external
      // navigation), so the sandbox isn't protecting against untrusted input here; disabling it
      // avoids "No usable sandbox" failures on hosts without user-namespace support.
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserPromise;
}

let mermaidBundleCache: string | undefined;

function loadMermaidBundle(): string {
  if (!mermaidBundleCache) {
    mermaidBundleCache = fs.readFileSync(
      path.join(process.cwd(), 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
      'utf-8'
    );
  }
  return mermaidBundleCache;
}

// KaTeX math is rendered to static HTML/MathML server-side (via katex.renderToString below), so
// unlike mermaid we never ship katex's JS to the page - only its stylesheet, for layout/glyphs.
// The stylesheet's @font-face rules point at relative `fonts/*.woff2` paths that don't resolve
// inside a page loaded via page.setContent() (no base URL), so we inline every referenced font as
// a data URI once and cache the result.
let katexCssCache: string | undefined;

function loadKatexCss(): string {
  if (!katexCssCache) {
    const katexDistDir = path.join(process.cwd(), 'node_modules', 'katex', 'dist');
    const rawCss = fs.readFileSync(path.join(katexDistDir, 'katex.min.css'), 'utf-8');
    katexCssCache = rawCss.replace(/url\(fonts\/([^)'"]+)\)/g, (_match, fontFile: string) => {
      const fontPath = path.join(katexDistDir, 'fonts', fontFile);
      const ext = path.extname(fontFile).slice(1);
      const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : 'font/ttf';
      const base64 = fs.readFileSync(fontPath).toString('base64');
      return `url(data:${mime};base64,${base64})`;
    });
  }
  return katexCssCache;
}

function renderMathToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      output: 'htmlAndMathml',
      strict: 'ignore'
    });
  } catch {
    return `<code>${escapeHtml(latex)}</code>`;
  }
}

interface MathToken extends Tokens.Generic {
  readonly type: 'blockMath' | 'inlineMath';
  readonly raw: string;
  readonly text: string;
}

// Custom marked extensions so `$$...$$` / `\[...\]` (display math) and `$...$` / `\(...\)` (inline
// math) are recognized before marked's normal paragraph/emphasis tokenizers get a chance to mangle
// LaTeX's `_`, `*`, and `\` characters.
const blockMathExtension = {
  name: 'blockMath',
  level: 'block' as const,
  start(src: string): number | undefined {
    const dollarIdx = src.indexOf('$$');
    const bracketIdx = src.indexOf('\\[');
    const candidates = [dollarIdx, bracketIdx].filter(i => i >= 0);
    return candidates.length ? Math.min(...candidates) : undefined;
  },
  tokenizer(src: string): MathToken | undefined {
    const match = /^\$\$([\s\S]+?)\$\$/.exec(src) ?? /^\\\[([\s\S]+?)\\\]/.exec(src);
    if (!match) return undefined;
    return { type: 'blockMath', raw: match[0], text: match[1].trim() };
  },
  renderer(token: Tokens.Generic): string {
    return renderMathToHtml((token as MathToken).text, true);
  }
};

const inlineMathExtension = {
  name: 'inlineMath',
  level: 'inline' as const,
  start(src: string): number | undefined {
    const dollarIdx = src.indexOf('$');
    const parenIdx = src.indexOf('\\(');
    const candidates = [dollarIdx, parenIdx].filter(i => i >= 0);
    return candidates.length ? Math.min(...candidates) : undefined;
  },
  tokenizer(src: string): MathToken | undefined {
    const match = /^\$([^$\n]+?)\$/.exec(src) ?? /^\\\(([\s\S]+?)\\\)/.exec(src);
    if (!match) return undefined;
    return { type: 'inlineMath', raw: match[0], text: match[1].trim() };
  },
  renderer(token: Tokens.Generic): string {
    return renderMathToHtml((token as MathToken).text, false);
  }
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface HeadingEntry {
  readonly depth: number;
  readonly text: string;
  readonly id: string;
}

// marked v5+ dropped built-in heading-id/slugger support from core, so we assign ids ourselves via
// a custom heading renderer - and collect level-2 headings into a table of contents as a side effect
// of that same render pass, rather than re-walking the document a second time to build it.
function slugify(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[`*_]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return cleaned || 'section';
}

function markdownToHtml(markdown: string): { html: string; toc: HeadingEntry[] } {
  const toc: HeadingEntry[] = [];
  const slugCounts = new Map<string, number>();
  const instance = new Marked({ gfm: true, breaks: false });
  instance.use({
    extensions: [blockMathExtension, inlineMathExtension],
    renderer: {
      code({ text, lang }: Tokens.Code): string {
        if ((lang || '').trim().toLowerCase() === 'mermaid') {
          return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
        }
        const langName = (lang || '').match(/^\S*/)?.[0] ?? '';
        const langClass = langName ? ` class="language-${escapeHtml(langName)}"` : '';
        return `<pre><code${langClass}>${escapeHtml(text)}</code></pre>\n`;
      },
      heading(token: Tokens.Heading): string {
        const inner = this.parser.parseInline(token.tokens);
        const base = slugify(token.text);
        const count = slugCounts.get(base) ?? 0;
        slugCounts.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        if (token.depth === 2) toc.push({ depth: token.depth, text: token.text.replace(/[`*_]/g, ''), id });
        return `<h${token.depth} id="${id}">${inner}</h${token.depth}>\n`;
      }
    }
  });
  const html = instance.parse(markdown) as string;
  return { html, toc };
}

function buildTocHtml(toc: readonly HeadingEntry[]): string {
  // Not worth a contents block for a report with only zero or one top-level section.
  if (toc.length < 2) return '';
  const items = toc.map(h => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join('');
  return `<nav class="toc"><div class="toc-title">Contents</div><ol>${items}</ol></nav>`;
}

// Matches fenced blocks tagged as a plain-text/ASCII diagram description - i.e. NOT ```mermaid,
// which already has a deterministic renderer. This is the only construct in the whole renderer
// that triggers an LLM call, and only when the caller opts in by passing an `llmProvider`.
const TEXT_DIAGRAM_FENCE = /```(?:diagram|ascii-diagram|text-diagram|textdiagram)\n([\s\S]*?)```/g;

function extractSvgMarkup(text: string): string | undefined {
  const match = /<svg[\s\S]*?<\/svg>/i.exec(text);
  return match?.[0];
}

// Defense in depth: the SVG body comes back from an LLM, a different trust boundary than our own
// bundled mermaid.js, so strip anything that could execute script inside the rendered page even
// though the page itself never navigates anywhere untrusted.
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/(href|xlink:href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

async function generateSvgFromDiagramText(diagramText: string, llmProvider: LLMProvider): Promise<string> {
  const prompt = [
    'Convert the following plain-text/ASCII diagram description into a single clean, minimal,',
    'self-contained inline SVG diagram suitable for embedding in a printed PDF report.',
    'Preserve the shapes, labels, and relationships from the source description as faithfully as possible.',
    'Requirements: valid standalone <svg>...</svg> markup, an explicit viewBox, no external references,',
    'no <script>, no event handler attributes, white/transparent background with dark strokes and text.',
    'Respond with ONLY the raw <svg>...</svg> markup - no markdown code fences, no explanation, no commentary.',
    '',
    'Diagram description:',
    diagramText
  ].join('\n');

  const result = await llmProvider.generate(prompt, { temperature: 0.2, maxOutputTokens: 4096 });
  const svg = result.ok ? extractSvgMarkup(result.value.text) : undefined;
  if (!svg) {
    return `<pre class="diagram-fallback">${escapeHtml(diagramText)}</pre>`;
  }
  return `<figure class="llm-diagram">${sanitizeSvg(svg)}</figure>`;
}

// Best-effort preprocessing pass over the raw markdown, run before it ever reaches marked/mermaid.
// Replacements are computed from the original match positions and spliced back in reverse order so
// earlier indices stay valid while later ones are still being resolved concurrently.
async function convertTextDiagramsToSvg(markdown: string, llmProvider: LLMProvider): Promise<string> {
  const matches = [...markdown.matchAll(TEXT_DIAGRAM_FENCE)];
  if (!matches.length) return markdown;

  const replacements = await Promise.all(
    matches.map(match => generateSvgFromDiagramText(match[1].trim(), llmProvider).catch(
      () => `<pre class="diagram-fallback">${escapeHtml(match[1].trim())}</pre>`
    ))
  );

  let result = markdown;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const start = match.index ?? 0;
    result = result.slice(0, start) + `\n\n${replacements[i]}\n\n` + result.slice(start + match[0].length);
  }
  return result;
}

const DOCUMENT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1e293b;
    font-size: 11.5px;
    line-height: 1.6;
  }
  .cover {
    padding: 8mm 0 10mm;
    margin-bottom: 8mm;
    border-bottom: 3px solid #4f46e5;
  }
  .cover .eyebrow {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #4f46e5;
    margin-bottom: 4px;
  }
  .cover h1 { font-size: 22px; margin: 0 0 6px; color: #0f172a; }
  .cover .meta { font-size: 9.5px; color: #64748b; }
  h1, h2, h3, h4 { color: #0f172a; font-weight: 700; page-break-after: avoid; }
  h2 {
    font-size: 15px;
    margin-top: 22px;
    padding-bottom: 4px;
    border-bottom: 1.5px solid #e2e8f0;
  }
  h3 { font-size: 13px; margin-top: 16px; }
  p { margin: 6px 0; }
  a { color: #4338ca; }
  ul, ol { padding-left: 22px; }
  li { margin: 3px 0; }
  li::marker { color: #6366f1; font-weight: 600; }
  .toc {
    margin: 4mm 0 8mm;
    padding: 10px 16px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    page-break-after: always;
  }
  .toc .toc-title {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4f46e5;
    margin-bottom: 8px;
  }
  .toc ol { list-style: none; counter-reset: toc-counter; padding-left: 0; margin: 0; }
  .toc li { counter-increment: toc-counter; margin: 5px 0; font-size: 11px; }
  .toc li a { color: #312e81; text-decoration: none; }
  .toc li a::before {
    content: counter(toc-counter) '. ';
    color: #6366f1;
    font-weight: 700;
  }
  blockquote {
    margin: 10px 0;
    padding: 6px 12px;
    border-left: 3px solid #a5b4fc;
    background: #f5f5ff;
    color: #4338ca;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
    font-size: 10px;
    page-break-inside: avoid;
  }
  th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eef2ff; color: #312e81; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  code {
    font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 10px 12px;
    border-radius: 6px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  pre code { background: none; padding: 0; color: inherit; }
  .mermaid {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    margin: 12px 0;
    text-align: center;
    page-break-inside: avoid;
  }
  .mermaid svg { max-width: 100%; height: auto; }
  .katex-display {
    margin: 12px 0;
    overflow-x: auto;
    overflow-y: hidden;
    page-break-inside: avoid;
  }
  figure.llm-diagram {
    margin: 12px 0;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
    text-align: center;
    page-break-inside: avoid;
  }
  figure.llm-diagram svg { max-width: 100%; height: auto; }
  pre.diagram-fallback {
    background: #0f172a;
    color: #e2e8f0;
    padding: 10px 12px;
    border-radius: 6px;
    white-space: pre-wrap;
    page-break-inside: avoid;
  }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
`;

const MERMAID_INIT_SCRIPT = `
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    themeVariables: {
      primaryColor: '#eef2ff',
      primaryTextColor: '#312e81',
      primaryBorderColor: '#6366f1',
      lineColor: '#6366f1',
      secondaryColor: '#f8fafc',
      tertiaryColor: '#ffffff',
      fontFamily: '-apple-system, Segoe UI, Helvetica, Arial, sans-serif',
      fontSize: '13px'
    },
    flowchart: { curve: 'basis', htmlLabels: true },
    sequence: { actorFontSize: 12, messageFontSize: 12 }
  });
`;

function buildHtmlDocument(bodyHtml: string, title: string, toc: readonly HeadingEntry[]): string {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${loadKatexCss()}</style>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="cover">
    <div class="eyebrow">NexusAgent Research Network &middot; Synthesized Report</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Compiled by Lead Orchestrator Dr. Astra &middot; Generated ${escapeHtml(generatedAt)}</div>
  </div>
  ${buildTocHtml(toc)}
  ${bodyHtml}
  <script>${loadMermaidBundle()}</script>
  <script>${MERMAID_INIT_SCRIPT}</script>
</body>
</html>`;
}

export interface PdfReportOptions {
  readonly markdown: string;
  readonly title?: string;
  /**
   * When provided, plain-text/ASCII ```diagram blocks are converted to real SVG via a single LLM
   * call per block before rendering. Optional and best-effort: omitting it (or a call failing)
   * just leaves those blocks as a formatted text fallback - math and mermaid are unaffected either way.
   */
  readonly llmProvider?: LLMProvider;
}

/**
 * Converts a completed markdown research report into a standalone, self-contained HTML document -
 * math (KaTeX), mermaid diagrams, and (optionally) LLM-converted plain-text diagrams all inlined,
 * no external requests needed to view it. This is also the first stage of PDF rendering below
 * (`renderMarkdownReportToPdf` loads this same HTML into headless Chromium and prints it to PDF).
 */
export async function renderMarkdownReportToHtml({ markdown, title, llmProvider }: PdfReportOptions): Promise<string> {
  const preprocessed = llmProvider ? await convertTextDiagramsToSvg(markdown, llmProvider) : markdown;
  const { html: bodyHtml, toc } = markdownToHtml(preprocessed);
  return buildHtmlDocument(bodyHtml, title || 'Synthesized Technical Research Report', toc);
}

/**
 * Converts a completed markdown research report (including ```mermaid fenced diagrams and
 * $...$/$$...$$ LaTeX math) into a paginated PDF with diagrams and math rendered as real vector
 * graphics - mermaid via mermaid.js and math via KaTeX, both running inside headless Chromium,
 * not left as raw text blocks.
 */
export async function renderMarkdownReportToPdf(options: PdfReportOptions): Promise<Buffer> {
  const html = await renderMarkdownReportToHtml(options);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });

    // suppressErrors so one malformed diagram (occasional LLM mermaid syntax slip) renders as an
    // inline error graphic instead of aborting the whole document.
    await page.evaluate(async () => {
      await (window as unknown as { mermaid: { run: (opts: unknown) => Promise<void> } }).mermaid.run({
        querySelector: '.mermaid',
        suppressErrors: true
      });
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#94a3b8;text-align:center;padding:0 16mm;font-family:Arial,sans-serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span> &middot; NexusAgent Research Network</div>`
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
