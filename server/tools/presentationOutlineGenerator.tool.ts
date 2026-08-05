import { Type } from '@google/genai';
import { ToolError, ValidationError } from '../errors/AppError';
import { Err, Ok, type Result } from '../result';
import { renderMarkdownReportToPptxOutline } from '../services/PresentationOutlineRenderer';
import type { ToolDefinition } from './types';

interface PresentationOutlineGeneratorArgs {
  readonly markdown: string;
  readonly title?: string;
}

// Deterministic post-processing step, not a Gemini function call - same shape as
// pdfReportGeneratorTool/docxReportGeneratorTool. Converts the finished markdown report into a
// presentation outline (PPTX): a title slide plus one content slide per H2 section, with prose/lists
// flattened to bullets. Runs fully locally, no LLM call.
const presentationOutlineGeneratorTool: ToolDefinition<PresentationOutlineGeneratorArgs, Buffer> = {
  name: 'mcp_presentation_outline_generator',
  description: 'Converts a finished markdown research report into a presentation outline (PPTX) - a title slide plus one content slide per top-level section, with prose and lists flattened into bullet points. Runs locally - no LLM call.',
  category: 'Report Engine',
  parameters: {
    type: Type.OBJECT,
    properties: {
      markdown: { type: Type.STRING, description: 'The finished markdown report text.' },
      title: { type: Type.STRING, description: 'Presentation title.' }
    },
    required: ['markdown']
  },
  supportsFunctionCalling: false,
  cacheable: false,
  examples: [
    {
      input: { markdown: '# Report\n\n## Findings\n\n- First finding\n- Second finding', title: 'Sample Report' },
      output: '<PPTX binary buffer>',
      description: 'Renders a markdown report into a title slide plus one bulleted content slide for the "Findings" section.'
    }
  ],

  validate(args: unknown): Result<PresentationOutlineGeneratorArgs, ValidationError> {
    const a = (args ?? {}) as Record<string, unknown>;
    if (typeof a.markdown !== 'string' || !a.markdown.trim()) {
      return Err(new ValidationError('mcp_presentation_outline_generator: "markdown" is required and must be a non-empty string'));
    }
    if (a.title !== undefined && typeof a.title !== 'string') {
      return Err(new ValidationError('mcp_presentation_outline_generator: "title" must be a string if provided'));
    }
    return Ok({ markdown: a.markdown, title: a.title as string | undefined });
  },

  async execute(args: PresentationOutlineGeneratorArgs): Promise<Result<Buffer, ToolError>> {
    try {
      const pptx = await renderMarkdownReportToPptxOutline(args);
      return Ok(pptx);
    } catch (err) {
      return Err(new ToolError('Presentation outline rendering failed', 'mcp_presentation_outline_generator', err));
    }
  }
};

export default presentationOutlineGeneratorTool;
