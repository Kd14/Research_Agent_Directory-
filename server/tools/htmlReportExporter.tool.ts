import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import { renderMarkdownReportToHtml } from '../services/PdfReportRenderer';
import type { ToolDefinition, ToolExecutionContext } from './types';

interface HtmlReportExporterArgs {
  readonly markdown: string;
  readonly title?: string;
  readonly renderDiagramsWithLlm?: boolean;
}

// Standalone document -> HTML export, sharing the exact same rendering engine (PdfReportRenderer)
// as the PDF exporters - a self-contained document with math/mermaid/diagrams inlined, viewable
// without any server round-trip once downloaded.
const htmlReportExporterTool: ToolDefinition<HtmlReportExporterArgs, string> = {
  name: 'mcp_html_report_exporter',
  description: 'Converts markdown (LaTeX math, mermaid diagrams, plain-text diagram descriptions) into a self-contained standalone HTML document.',
  category: 'Report Engine',
  parameters: {
    type: Type.OBJECT,
    properties: {
      markdown: { type: Type.STRING, description: 'The markdown/document text to convert.' },
      title: { type: Type.STRING, description: 'Document title.' },
      renderDiagramsWithLlm: { type: Type.BOOLEAN, description: 'Whether to convert plain-text diagram blocks to SVG via an LLM call. Defaults to true.' }
    },
    required: ['markdown']
  },
  supportsFunctionCalling: false,
  cacheable: false,
  examples: [
    {
      input: { markdown: '# Notes\n\n$E = mc^2$', title: 'Sample Document' },
      output: '<!doctype html>...',
      description: 'Renders a document with inline LaTeX math into a standalone HTML page.'
    }
  ],

  validate(args: unknown): Result<HtmlReportExporterArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (typeof a.markdown !== 'string' || !a.markdown.trim()) {
      return Err(new ValidationError('mcp_html_report_exporter: "markdown" is required and must be a non-empty string'));
    }
    if (a.title !== undefined && typeof a.title !== 'string') {
      return Err(new ValidationError('mcp_html_report_exporter: "title" must be a string if provided'));
    }
    if (a.renderDiagramsWithLlm !== undefined && typeof a.renderDiagramsWithLlm !== 'boolean') {
      return Err(new ValidationError('mcp_html_report_exporter: "renderDiagramsWithLlm" must be a boolean if provided'));
    }
    return Ok({
      markdown: a.markdown,
      title: a.title as string | undefined,
      renderDiagramsWithLlm: a.renderDiagramsWithLlm as boolean | undefined
    });
  },

  async execute(args: HtmlReportExporterArgs, ctx: ToolExecutionContext): Promise<Result<string, ToolError>> {
    try {
      const useLlmDiagrams = args.renderDiagramsWithLlm !== false;
      const html = await renderMarkdownReportToHtml({
        markdown: args.markdown,
        title: args.title,
        llmProvider: useLlmDiagrams ? ctx.llmProvider : undefined
      });
      return Ok(html);
    } catch (err) {
      return Err(new ToolError('HTML export failed', 'mcp_html_report_exporter', err));
    }
  }
};

export default htmlReportExporterTool;
