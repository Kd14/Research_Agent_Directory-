import PptxGenJS from 'pptxgenjs';
import type { Token, Tokens } from 'marked';
import { inlineTokensToPlainText, inlineTokensToRuns, tokenizeMarkdownBlocks, type InlineRun } from './markdownTokens';

// Markdown -> presentation outline (PPTX) conversion, for the "Artifact Generation" export set.
// This is deliberately an *outline*, not a full slide deck design: H1 becomes the title slide, each
// H2 starts a new content slide, and everything else under it (paragraphs, lists, blockquotes)
// becomes bullet text on that slide. It gives a presenter a structured starting point to build a
// real deck from, rather than attempting automatic layout/design decisions no local tool can make well.

const MAX_BULLETS_PER_SLIDE = 9;
const ACCENT = '4F46E5';
const TEXT_DARK = '0F172A';
const TEXT_MUTED = '64748B';

interface Bullet {
  readonly runs: InlineRun[];
  readonly level: number;
}

interface Section {
  readonly title: string;
  readonly bullets: Bullet[];
}

function pushParagraphBullet(bullets: Bullet[], tokens: readonly Tokens.Generic[] | undefined, level: number): void {
  const runs = inlineTokensToRuns(tokens);
  if (runs.some(r => r.text.trim())) bullets.push({ runs, level });
}

function pushListBullets(bullets: Bullet[], items: readonly Tokens.ListItem[], level: number): void {
  for (const item of items) {
    const inline = item.tokens.filter(t => t.type !== 'list');
    pushParagraphBullet(bullets, inline, level);
    const nested = item.tokens.find((t): t is Tokens.List => t.type === 'list');
    if (nested) pushListBullets(bullets, nested.items, level + 1);
  }
}

function summarizeTable(token: Tokens.Table): string {
  const cols = token.header.map(c => inlineTokensToPlainText(c.tokens)).join(', ');
  return `Table (${token.rows.length} rows): ${cols}`;
}

// Groups the document's block tokens into one Section per H2 (or per H1 after the first, if the
// document has multiple top-level headings) - everything before the first H2 that isn't the title
// itself becomes an "Overview" section so leading content is never silently dropped.
function buildSections(blocks: readonly Token[], titleText: string | undefined): Section[] {
  const sections: Section[] = [];
  let current: Section | undefined;
  let usedTitleHeading = false;

  const ensureCurrent = (fallbackTitle: string): Section => {
    if (!current) {
      current = { title: fallbackTitle, bullets: [] };
      sections.push(current);
    }
    return current;
  };

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const heading = block as Tokens.Heading;
        const text = inlineTokensToPlainText(heading.tokens);
        if (heading.depth === 1 && !usedTitleHeading && (!titleText || text === titleText)) {
          usedTitleHeading = true;
          continue;
        }
        if (heading.depth <= 2) {
          current = { title: text, bullets: [] };
          sections.push(current);
        } else {
          ensureCurrent(text).bullets.push({ runs: [{ text, bold: true }], level: 0 });
        }
        break;
      }
      case 'paragraph':
        pushParagraphBullet(ensureCurrent('Overview').bullets, (block as Tokens.Paragraph).tokens, 0);
        break;
      case 'list': {
        const list = block as Tokens.List;
        pushListBullets(ensureCurrent('Overview').bullets, list.items, 0);
        break;
      }
      case 'blockquote': {
        const quote = block as Tokens.Blockquote;
        const text = quote.tokens
          .filter((t): t is Tokens.Paragraph => t.type === 'paragraph')
          .map(p => inlineTokensToPlainText(p.tokens))
          .join(' ');
        if (text.trim()) ensureCurrent('Overview').bullets.push({ runs: [{ text, italic: true }], level: 0 });
        break;
      }
      case 'table':
        ensureCurrent('Overview').bullets.push({ runs: [{ text: summarizeTable(block as Tokens.Table) }], level: 0 });
        break;
      case 'code':
        ensureCurrent('Overview').bullets.push({ runs: [{ text: `Code: ${(block as Tokens.Code).lang || 'snippet'}`, italic: true }], level: 0 });
        break;
      default:
        break;
    }
  }

  return sections.filter(s => s.bullets.length > 0);
}

// Splits a section's bullets into multiple slides if it exceeds MAX_BULLETS_PER_SLIDE, so no single
// slide gets overloaded with content that would be unreadable in an actual presentation.
function paginateSections(sections: readonly Section[]): Section[] {
  const paginated: Section[] = [];
  for (const section of sections) {
    if (section.bullets.length <= MAX_BULLETS_PER_SLIDE) {
      paginated.push(section);
      continue;
    }
    for (let i = 0; i < section.bullets.length; i += MAX_BULLETS_PER_SLIDE) {
      const chunk = section.bullets.slice(i, i + MAX_BULLETS_PER_SLIDE);
      paginated.push({ title: i === 0 ? section.title : `${section.title} (cont.)`, bullets: chunk });
    }
  }
  return paginated;
}

function bulletToTextProps(bullet: Bullet): PptxGenJS.TextProps[] {
  const runs = bullet.runs.length ? bullet.runs : [{ text: '' }];
  return runs.map((run, index) => ({
    text: run.text,
    options: {
      bold: run.bold,
      italic: run.italic,
      fontFace: run.code ? 'Consolas' : undefined,
      hyperlink: run.link ? { url: run.link } : undefined,
      ...(index === runs.length - 1 ? { bullet: { indent: 14 }, indentLevel: bullet.level, breakLine: true } : {})
    }
  }));
}

export interface PresentationOutlineOptions {
  readonly markdown: string;
  readonly title?: string;
}

/**
 * Converts a completed markdown research report into a presentation outline (PPTX): a title slide
 * followed by one content slide per H2 section, with the section's prose/lists/blockquotes flattened
 * into bullet text. Runs fully locally, no LLM call.
 */
export async function renderMarkdownReportToPptxOutline({ markdown, title }: PresentationOutlineOptions): Promise<Buffer> {
  const blocks = tokenizeMarkdownBlocks(markdown);
  const resolvedTitle = title || inlineTokensToPlainText((blocks.find(b => b.type === 'heading') as Tokens.Heading | undefined)?.tokens) || 'Synthesized Technical Research Report';

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'NEXUS_16x9', width: 10, height: 5.625 });
  pptx.layout = 'NEXUS_16x9';

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: TEXT_DARK };
  titleSlide.addText(resolvedTitle, {
    x: 0.6,
    y: 2.0,
    w: 8.8,
    h: 1.5,
    fontSize: 32,
    bold: true,
    color: 'FFFFFF',
    valign: 'middle'
  });
  titleSlide.addText('NexusAgent Research Network · Presentation Outline', {
    x: 0.6,
    y: 3.5,
    w: 8.8,
    h: 0.5,
    fontSize: 14,
    color: 'A5B4FC'
  });

  const allSlides = [titleSlide];
  const sections = paginateSections(buildSections(blocks, resolvedTitle));

  for (const section of sections) {
    const slide = pptx.addSlide();
    allSlides.push(slide);
    slide.addText(section.title, {
      x: 0.5,
      y: 0.35,
      w: 9,
      h: 0.7,
      fontSize: 22,
      bold: true,
      color: TEXT_DARK
    });
    slide.addShape('rect', { x: 0.5, y: 1.05, w: 1.2, h: 0.04, fill: { color: ACCENT } });

    const bulletProps = section.bullets.flatMap(bulletToTextProps);
    slide.addText(bulletProps, {
      x: 0.5,
      y: 1.3,
      w: 9,
      h: 4.0,
      fontSize: 14,
      color: TEXT_DARK,
      valign: 'top',
      lineSpacingMultiple: 1.3
    });
  }

  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  for (const slide of allSlides) {
    slide.addText(`Generated ${generatedAt}`, {
      x: 0.5,
      y: 5.3,
      w: 6,
      h: 0.25,
      fontSize: 8,
      color: TEXT_MUTED
    });
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}
