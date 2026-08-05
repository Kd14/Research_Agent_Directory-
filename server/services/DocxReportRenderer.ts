import type { Token, Tokens } from 'marked';
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild
} from 'docx';
import { inlineTokensToPlainText, inlineTokensToRuns, tokenizeMarkdownBlocks, type InlineRun } from './markdownTokens';

// Markdown -> DOCX conversion for the "Artifact Generation" export set (alongside PDF/HTML). Unlike
// PdfReportRenderer, this never touches headless Chromium or an LLM - it walks marked's block/inline
// token tree directly and maps it onto docx.js primitives, so it stays fast and fully offline.
//
// Diagrams (```mermaid and ```diagram fences) and LaTeX math have no native DOCX equivalent without
// a much heavier rendering pipeline (rasterizing via the same Chromium path PdfReportRenderer uses),
// so - deliberately, to keep this exporter simple and dependency-light - they're preserved as
// monospace source blocks rather than rendered graphics. Readers who need the rendered diagrams
// should use the PDF or HTML export instead.

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6
] as const;

function runsToTextRuns(runs: readonly InlineRun[]): ParagraphChild[] {
  return runs.map(run => {
    const textRun = new TextRun({
      text: run.text,
      bold: run.bold,
      italics: run.italic,
      font: run.code ? 'Consolas' : undefined
    });
    if (!run.link) return textRun;
    return new ExternalHyperlink({ link: run.link, children: [textRun] });
  });
}

function codeBlockParagraphs(text: string): Paragraph[] {
  return text.split('\n').map(
    line =>
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
        children: [new TextRun({ text: line.length ? line : ' ', font: 'Consolas', size: 18 })]
      })
  );
}

function listItemParagraphs(items: readonly Tokens.ListItem[], ordered: boolean, level: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  items.forEach((item, index) => {
    const inlineTokens = item.tokens.filter(t => t.type !== 'list') as Tokens.Generic[];
    const runs = inlineTokensToRuns(inlineTokens);
    paragraphs.push(
      new Paragraph({
        children: runsToTextRuns(runs),
        ...(ordered
          ? { numbering: { reference: 'ordered-list', level } }
          : { bullet: { level } })
      })
    );
    const nested = item.tokens.find((t): t is Tokens.List => t.type === 'list');
    if (nested) paragraphs.push(...listItemParagraphs(nested.items, nested.ordered, level + 1));
  });
  return paragraphs;
}

function tableToDocx(token: Tokens.Table): Table {
  const headerRow = new TableRow({
    children: token.header.map(
      cell =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: 'EEF2FF' },
          children: [new Paragraph({ children: runsToTextRuns(inlineTokensToRuns(cell.tokens)) })]
        })
    )
  });
  const bodyRows = token.rows.map(
    row =>
      new TableRow({
        children: row.map(
          cell => new TableCell({ children: [new Paragraph({ children: runsToTextRuns(inlineTokensToRuns(cell.tokens)) })] })
        )
      })
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });
}

function blockToDocxNodes(token: Token): (Paragraph | Table)[] {
  switch (token.type) {
    case 'heading': {
      const heading = token as Tokens.Heading;
      const level = HEADING_LEVELS[Math.min(heading.depth, 6) - 1];
      return [new Paragraph({ heading: level, children: runsToTextRuns(inlineTokensToRuns(heading.tokens)) })];
    }
    case 'paragraph':
      return [new Paragraph({ children: runsToTextRuns(inlineTokensToRuns((token as Tokens.Paragraph).tokens)) })];
    case 'blockquote': {
      const quote = token as Tokens.Blockquote;
      const text = quote.tokens
        .filter((t): t is Tokens.Paragraph => t.type === 'paragraph')
        .map(p => inlineTokensToPlainText(p.tokens))
        .join(' ');
      return [
        new Paragraph({
          indent: { left: 360 },
          border: { left: { style: 'single', size: 12, color: 'A5B4FC', space: 8 } },
          children: [new TextRun({ text, italics: true, color: '4338CA' })]
        })
      ];
    }
    case 'code':
      return codeBlockParagraphs((token as Tokens.Code).text);
    case 'list': {
      const list = token as Tokens.List;
      return listItemParagraphs(list.items, list.ordered, 0);
    }
    case 'table':
      return [tableToDocx(token as Tokens.Table)];
    case 'hr':
      return [new Paragraph({ border: { bottom: { style: 'single', size: 6, color: 'E2E8F0', space: 4 } }, children: [] })];
    case 'space':
      return [];
    default: {
      const fallback = token as Tokens.Generic & { text?: string };
      return typeof fallback.text === 'string' ? [new Paragraph({ text: fallback.text })] : [];
    }
  }
}

export interface DocxReportOptions {
  readonly markdown: string;
  readonly title?: string;
}

/**
 * Converts a completed markdown research report into a DOCX document, preserving headings, prose
 * formatting, lists, tables, and blockquotes. Runs fully locally with no LLM call and no headless
 * browser (unlike the PDF/HTML exporters) - see the module comment for why diagrams/math are kept
 * as source text rather than rendered graphics here.
 */
export async function renderMarkdownReportToDocx({ markdown, title }: DocxReportOptions): Promise<Buffer> {
  const blocks = tokenizeMarkdownBlocks(markdown);
  const body = blocks.flatMap(blockToDocxNodes);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [
            { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START },
            { level: 1, format: 'lowerLetter', text: '%2.', alignment: AlignmentType.START }
          ]
        }
      ]
    },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title || 'Synthesized Technical Research Report' })]
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `NexusAgent Research Network · Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`,
                color: '64748B',
                size: 18
              })
            ]
          }),
          new Paragraph({ text: '' }),
          ...body
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
}
