import { Router, type Request, type Response } from 'express';
import { sendErrorResponse } from './middleware/errorHandler';
import type { SessionService } from '../services/SessionService';

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
