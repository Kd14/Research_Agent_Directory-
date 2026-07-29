import { Router, type Request, type Response } from 'express';
import path from 'path';
import type { AppConfig } from '../config';
import type { DocumentService } from '../services/DocumentService';

export function createHealthRouter(config: AppConfig, documentService: DocumentService): Router {
  const router = Router();

  router.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      hasGeminiApiKey: Boolean(config.llm.apiKey),
      mcpServerStatus: 'online',
      documentCount: documentService.list().length,
      timestamp: new Date().toISOString()
    });
  });

  // Download codebase ZIP endpoint
  router.get('/api/download-zip', (req: Request, res: Response) => {
    const zipPath = path.join(process.cwd(), 'public', 'aether_orchestrator_source.zip');
    res.download(zipPath, 'aether_orchestrator_source.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'ZIP file not found or could not be generated.' });
      }
    });
  });

  return router;
}
