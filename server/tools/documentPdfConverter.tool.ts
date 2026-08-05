import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import { renderMarkdownReportToPdf } from '../services/PdfReportRenderer';
import type { ToolDefinition, ToolExecutionContext } from './types';

interface DocumentPdfConverterArgs {
  readonly markdown: string;
  readonly title?: string;
  readonly renderDiagramsWithLlm?: boolean;
}

// Standalone document -> PDF conversion utility, independent of the research pipeline: a user can
// paste/upload any markdown (LaTeX math, mermaid diagrams, or plain-text/ASCII diagram
// descriptions) via the PDF Studio tab and get back a polished PDF, with no agentic run involved.
// It shares the exact same rendering engine (PdfReportRenderer) the agentic pipeline uses for its
// final report export, so math/diagram fidelity is identical either way. The only optional LLM
// call is the text-diagram-to-SVG conversion, gated by `renderDiagramsWithLlm` (defaults on).
const documentPdfConverterTool: ToolDefinition<DocumentPdfConverterArgs, Buffer> = {
  name: 'mcp_document_pdf_converter',
  description: 'Converts arbitrary markdown (LaTeX math, mermaid diagrams, plain-text/ASCII diagram descriptions) into a polished, paginated PDF. Runs locally via headless Chromium + KaTeX; optionally calls the LLM once per plain-text diagram block to render it as real SVG.',
  category: 'Report Engine',
  parameters: {
    type: Type.OBJECT,
    properties: {
      markdown: { type: Type.STRING, description: 'The markdown/document text to convert, including any $...$/$$...$$ math, ```mermaid blocks, or ```diagram (plain-text/ASCII) blocks.' },
      title: { type: Type.STRING, description: 'Document title for the cover header.' },
      renderDiagramsWithLlm: { type: Type.BOOLEAN, description: 'Whether to convert ```diagram/```ascii-diagram blocks to SVG via an LLM call. Defaults to true.' }
    },
    required: ['markdown']
  },
  supportsFunctionCalling: false,
  cacheable: false,
  examples: [
    {
      input: { markdown: '# Notes\n\nEnergy-mass equivalence: $E = mc^2$\n\n```diagram\nUser -> API -> Database\n```', title: 'Sample Document' },
      output: '<PDF binary buffer>',
      description: 'Renders a document with inline LaTeX math and a plain-text diagram (converted to SVG via LLM) into a polished PDF.'
    }
  ],

  validate(args: unknown): Result<DocumentPdfConverterArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (typeof a.markdown !== 'string' || !a.markdown.trim()) {
      return Err(new ValidationError('mcp_document_pdf_converter: "markdown" is required and must be a non-empty string'));
    }
    if (a.title !== undefined && typeof a.title !== 'string') {
      return Err(new ValidationError('mcp_document_pdf_converter: "title" must be a string if provided'));
    }
    if (a.renderDiagramsWithLlm !== undefined && typeof a.renderDiagramsWithLlm !== 'boolean') {
      return Err(new ValidationError('mcp_document_pdf_converter: "renderDiagramsWithLlm" must be a boolean if provided'));
    }
    return Ok({
      markdown: a.markdown,
      title: a.title as string | undefined,
      renderDiagramsWithLlm: a.renderDiagramsWithLlm as boolean | undefined
    });
  },

  async execute(args: DocumentPdfConverterArgs, ctx: ToolExecutionContext): Promise<Result<Buffer, ToolError>> {
    try {
      const useLlmDiagrams = args.renderDiagramsWithLlm !== false;
      const pdf = await renderMarkdownReportToPdf({
        markdown: args.markdown,
        title: args.title,
        llmProvider: useLlmDiagrams ? ctx.llmProvider : undefined
      });
      return Ok(pdf);
    } catch (err) {
      return Err(new ToolError('Document PDF conversion failed', 'mcp_document_pdf_converter', err));
    }
  }
};

export default documentPdfConverterTool;
