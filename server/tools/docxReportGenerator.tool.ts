import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import { renderMarkdownReportToDocx } from '../services/DocxReportRenderer';
import type { ToolDefinition } from './types';

interface DocxReportGeneratorArgs {
  readonly markdown: string;
  readonly title?: string;
}

// Deterministic post-processing step, not a Gemini function call - same shape as
// pdfReportGeneratorTool. Converts the finished markdown report into an editable DOCX document, for
// users who want to hand-edit or track changes on the report in Word/Google Docs rather than the
// print-ready PDF. Runs fully locally with no LLM call and no headless browser.
const docxReportGeneratorTool: ToolDefinition<DocxReportGeneratorArgs, Buffer> = {
  name: 'mcp_docx_report_generator',
  description: 'Converts a finished markdown research report into an editable DOCX document (headings, prose, lists, tables, blockquotes). Runs locally - no LLM call, no headless browser.',
  category: 'Report Engine',
  parameters: {
    type: Type.OBJECT,
    properties: {
      markdown: { type: Type.STRING, description: 'The finished markdown report text.' },
      title: { type: Type.STRING, description: 'Report title.' }
    },
    required: ['markdown']
  },
  supportsFunctionCalling: false,
  cacheable: false,
  examples: [
    {
      input: { markdown: '# Report\n\n## Findings\n\n- First finding\n- Second finding', title: 'Sample Report' },
      output: '<DOCX binary buffer>',
      description: 'Renders a markdown report with headings and a bullet list into an editable DOCX document.'
    }
  ],

  validate(args: unknown): Result<DocxReportGeneratorArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (typeof a.markdown !== 'string' || !a.markdown.trim()) {
      return Err(new ValidationError('mcp_docx_report_generator: "markdown" is required and must be a non-empty string'));
    }
    if (a.title !== undefined && typeof a.title !== 'string') {
      return Err(new ValidationError('mcp_docx_report_generator: "title" must be a string if provided'));
    }
    return Ok({ markdown: a.markdown, title: a.title as string | undefined });
  },

  async execute(args: DocxReportGeneratorArgs): Promise<Result<Buffer, ToolError>> {
    try {
      const docx = await renderMarkdownReportToDocx(args);
      return Ok(docx);
    } catch (err) {
      return Err(new ToolError('DOCX rendering failed', 'mcp_docx_report_generator', err));
    }
  }
};

export default docxReportGeneratorTool;
