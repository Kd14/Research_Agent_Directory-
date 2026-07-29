import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import { renderMarkdownReportToPdf } from '../services/PdfReportRenderer';
import type { ToolDefinition } from './types';

interface PdfReportGeneratorArgs {
  readonly markdown: string;
  readonly title?: string;
}

// Deterministic post-processing step, not a Gemini function call: it converts the already-
// synthesized markdown report (produced by the earlier LLM synthesis call) into a polished PDF
// with mermaid diagrams rendered as real vector graphics via headless Chromium. Invoked directly
// by ResearchPipeline/ResearchService right after synthesis completes - never offered to the LLM
// for function-calling, since there is no decision for the model to make here.
const pdfReportGeneratorTool: ToolDefinition<PdfReportGeneratorArgs, Buffer> = {
  name: 'mcp_pdf_report_generator',
  description: 'Converts a finished markdown research report (including mermaid diagram blocks) into a polished, paginated PDF with vector-rendered diagrams. Runs locally via headless Chromium - no LLM call.',
  category: 'Report Engine',
  parameters: {
    type: Type.OBJECT,
    properties: {
      markdown: { type: Type.STRING, description: 'The finished markdown report text, including any ```mermaid fenced diagram blocks.' },
      title: { type: Type.STRING, description: 'Report title for the cover header.' }
    },
    required: ['markdown']
  },
  supportsFunctionCalling: false,
  examples: [
    {
      input: { markdown: '# Report\n\n## Architectural Diagram\n\n```mermaid\ngraph TD; A-->B;\n```', title: 'Sample Report' },
      output: '<PDF binary buffer>',
      description: 'Renders a markdown report with an embedded mermaid diagram into a polished PDF document.'
    }
  ],

  validate(args: unknown): Result<PdfReportGeneratorArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (typeof a.markdown !== 'string' || !a.markdown.trim()) {
      return Err(new ValidationError('mcp_pdf_report_generator: "markdown" is required and must be a non-empty string'));
    }
    if (a.title !== undefined && typeof a.title !== 'string') {
      return Err(new ValidationError('mcp_pdf_report_generator: "title" must be a string if provided'));
    }
    return Ok({ markdown: a.markdown, title: a.title as string | undefined });
  },

  async execute(args: PdfReportGeneratorArgs): Promise<Result<Buffer, ToolError>> {
    try {
      const pdf = await renderMarkdownReportToPdf(args);
      return Ok(pdf);
    } catch (err) {
      return Err(new ToolError('PDF rendering failed', 'mcp_pdf_report_generator', err));
    }
  }
};

export default pdfReportGeneratorTool;
