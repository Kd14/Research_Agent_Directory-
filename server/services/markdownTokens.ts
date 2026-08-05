import { Marked, type Token, type Tokens } from 'marked';

// Shared markdown parsing for the non-HTML report exporters (DOCX, PPTX). The HTML/PDF path
// (PdfReportRenderer.ts) renders through marked's HTML renderer instead - these exporters need the
// raw block/inline token tree so they can map it onto docx.js Paragraphs and pptxgenjs slide text.

const lexer = new Marked({ gfm: true, breaks: false });

export function tokenizeMarkdownBlocks(markdown: string): Token[] {
  return lexer.lexer(markdown);
}

export interface InlineRun {
  readonly text: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly code?: boolean;
  readonly link?: string;
}

type InlineStyle = Partial<Pick<InlineRun, 'bold' | 'italic' | 'code'>>;

// Flattens marked's nested inline token tree (text/strong/em/codespan/link, including combinations
// like **_bold italic_**) into a flat run list - shared by the DOCX and PPTX exporters so both
// inherit the same bold/italic/code/link mapping instead of re-implementing inline-token walking twice.
export function inlineTokensToRuns(tokens: readonly Tokens.Generic[] | undefined, style: InlineStyle = {}): InlineRun[] {
  if (!tokens) return [];
  const runs: InlineRun[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
      case 'escape': {
        const t = token as Tokens.Text;
        if (t.tokens?.length) runs.push(...inlineTokensToRuns(t.tokens, style));
        else runs.push({ text: t.text, ...style });
        break;
      }
      case 'strong':
        runs.push(...inlineTokensToRuns((token as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case 'em':
        runs.push(...inlineTokensToRuns((token as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case 'codespan':
        runs.push({ text: (token as Tokens.Codespan).text, ...style, code: true });
        break;
      case 'link': {
        const linkToken = token as Tokens.Link;
        const inner = inlineTokensToRuns(linkToken.tokens, style);
        runs.push(...(inner.length ? inner.map(r => ({ ...r, link: linkToken.href })) : [{ text: linkToken.text, ...style, link: linkToken.href }]));
        break;
      }
      case 'br':
        runs.push({ text: '\n', ...style });
        break;
      default: {
        const fallback = token as Tokens.Generic & { text?: string };
        if (typeof fallback.text === 'string') runs.push({ text: fallback.text, ...style });
      }
    }
  }
  return runs;
}

export function inlineTokensToPlainText(tokens: readonly Tokens.Generic[] | undefined): string {
  return inlineTokensToRuns(tokens).map(r => r.text).join('');
}
