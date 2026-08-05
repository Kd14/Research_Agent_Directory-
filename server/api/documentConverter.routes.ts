import { Router, type Request, type Response } from 'express';
import { sendErrorResponse } from './middleware/errorHandler';
import type { ToolService } from '../services/ToolService';

// Standalone document -> PDF conversion endpoint. Deliberately separate from /api/research/* and
// /api/sessions/*: it takes raw markdown directly from the client (no research session, no
// planning/execution, no agentic run) and renders straight to a PDF response, so the "PDF Studio"
// tab can be used entirely on its own.
export function createDocumentConverterRouter(toolService: ToolService): Router {
  const router = Router();

  router.post('/api/tools/pdf-convert', async (req: Request, res: Response) => {
    const { markdown, title, renderDiagramsWithLlm } = req.body;

    if (typeof markdown !== 'string' || !markdown.trim()) {
      return res.status(400).json({ error: 'markdown is required' });
    }

    const result = await toolService.run('mcp_document_pdf_converter', { markdown, title, renderDiagramsWithLlm });
    if (!result.ok) return sendErrorResponse(res, result.error, 'Document conversion failed');

    const pdf = result.value as Buffer;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.send(pdf);
  });

  return router;
}
