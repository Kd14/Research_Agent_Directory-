import { Router, type Request, type Response } from 'express';
import { sendErrorResponse } from './middleware/errorHandler';
import type { SessionService } from '../services/SessionService';
import { citationsToCsv, citationsToJson, citationsToMarkdown } from '../services/CitationExporter';

export function createSessionsRouter(sessionService: SessionService): Router {
  const router = Router();

  router.get('/api/sessions', (req: Request, res: Response) => {
    res.json({ sessions: sessionService.list() });
  });

  router.get('/api/sessions/:id', (req: Request, res: Response) => {
    const result = sessionService.load(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);

    const { metadata, history } = result.value;
    const report = history.finalReportArtifact
      ? sessionService.readArtifact(req.params.id, history.finalReportArtifact)
      : undefined;

    res.json({ success: true, metadata, history, report });
  });

  router.get('/api/sessions/:id/report.pdf', (req: Request, res: Response) => {
    const result = sessionService.load(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);

    const { history } = result.value;
    const pdf = history.finalReportPdfArtifact
      ? sessionService.readBinaryArtifact(req.params.id, history.finalReportPdfArtifact)
      : undefined;
    if (!pdf) return res.status(404).json({ error: 'No PDF report available for this session yet' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.id}.pdf"`);
    res.send(pdf);
  });

  router.get('/api/sessions/:id/report.docx', (req: Request, res: Response) => {
    const result = sessionService.load(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);

    const { history } = result.value;
    const docx = history.finalReportDocxArtifact
      ? sessionService.readBinaryArtifact(req.params.id, history.finalReportDocxArtifact)
      : undefined;
    if (!docx) return res.status(404).json({ error: 'No DOCX report available for this session yet' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.docx"`);
    res.send(docx);
  });

  router.get('/api/sessions/:id/report.pptx', (req: Request, res: Response) => {
    const result = sessionService.load(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);

    const { history } = result.value;
    const pptx = history.finalReportPptxArtifact
      ? sessionService.readBinaryArtifact(req.params.id, history.finalReportPptxArtifact)
      : undefined;
    if (!pptx) return res.status(404).json({ error: 'No presentation outline available for this session yet' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.pptx"`);
    res.send(pptx);
  });

  // Citation graph export: which tool/document produced each claim and which instruction step
  // consumed it (CitationRecord.consumedBy) - resolved here to step titles from the persisted
  // instructionSet, in the researcher's preferred archival format.
  router.get('/api/sessions/:id/citations.:format', (req: Request, res: Response) => {
    const result = sessionService.load(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);

    const { history } = result.value;
    const format = req.params.format;
    const stepTitleById = Object.fromEntries(history.instructionSet.map(s => [s.id, s.title]));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}-citations.json"`);
      return res.send(citationsToJson(history.citations));
    }
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}-citations.csv"`);
      return res.send(citationsToCsv(history.citations));
    }
    if (format === 'md') {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}-citations.md"`);
      return res.send(citationsToMarkdown(history.citations, stepTitleById));
    }
    res.status(400).json({ error: 'Unsupported citation export format - use json, csv, or md' });
  });

  // PATCH /api/sessions/:id/instruction-set -> edit the persisted instructionSet and/or seek
  // currentStepIndex while a session is paused, so a subsequent POST /api/research/resume/:id
  // picks up the change (the SSE pipeline reads the persisted history, not anything client-held).
  router.patch('/api/sessions/:id/instruction-set', (req: Request, res: Response) => {
    const { instructionSet, currentStepIndex } = req.body;

    if (instructionSet !== undefined && !Array.isArray(instructionSet)) {
      return res.status(400).json({ error: 'instructionSet must be an array if provided' });
    }
    if (currentStepIndex !== undefined && typeof currentStepIndex !== 'number') {
      return res.status(400).json({ error: 'currentStepIndex must be a number if provided' });
    }

    const result = sessionService.save(req.params.id, {
      ...(instructionSet !== undefined ? { instructionSet } : {}),
      ...(currentStepIndex !== undefined ? { currentStepIndex } : {})
    });
    if (!result.ok) return sendErrorResponse(res, result.error);
    res.json({ success: true });
  });

  router.post('/api/sessions/:id/rename', (req: Request, res: Response) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const result = sessionService.rename(req.params.id, title);
    if (!result.ok) return sendErrorResponse(res, result.error);
    res.json({ success: true, metadata: result.value });
  });

  router.post('/api/sessions/:id/duplicate', (req: Request, res: Response) => {
    const result = sessionService.duplicate(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);
    res.json({ success: true, metadata: result.value });
  });

  router.get('/api/sessions/:id/export', (req: Request, res: Response) => {
    const result = sessionService.exportBundle(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);

    res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.json"`);
    res.json(result.value);
  });

  router.delete('/api/sessions/:id', (req: Request, res: Response) => {
    const result = sessionService.remove(req.params.id);
    if (!result.ok) return sendErrorResponse(res, result.error);
    res.json({ success: true });
  });

  return router;
}
