import fs from 'fs';
import os from 'os';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { AppConfig } from '../config';
import { sendErrorResponse } from './middleware/errorHandler';
import type { DocumentService } from '../services/DocumentService';

// Above this, buffering the whole upload in process memory during the multipart parse is wasteful;
// multer streams straight to a temp file instead, and we read it back once, briefly, afterward.
const DISK_STORAGE_THRESHOLD_BYTES = 5 * 1024 * 1024;

function readAndCleanupTempFile(filePath: string): Buffer {
  const buffer = fs.readFileSync(filePath);
  fs.unlink(filePath, () => {});
  return buffer;
}

export function createDocumentsRouter(config: AppConfig, documentService: DocumentService): Router {
  const router = Router();
  const useDiskStorage = config.upload.maxFileSizeBytes > DISK_STORAGE_THRESHOLD_BYTES;
  const upload = multer({
    storage: useDiskStorage ? multer.diskStorage({ destination: os.tmpdir() }) : multer.memoryStorage(),
    limits: { fileSize: config.upload.maxFileSizeBytes }
  });

  router.get('/api/documents', (req: Request, res: Response) => {
    res.json({ documents: documentService.list() });
  });

  router.post('/api/documents/upload', upload.single('file'), (req: Request, res: Response) => {
    try {
      const { category, title, tags } = req.body;
      const file = req.file;
      const fileForService = file
        ? {
            buffer: file.buffer ?? readAndCleanupTempFile(file.path),
            originalname: file.originalname,
            size: file.size
          }
        : undefined;

      const result = documentService.upload(fileForService, { category, title, tags });

      if (!result.ok) {
        return sendErrorResponse(res, result.error);
      }
      res.json({ success: true, document: result.value });
    } catch (err: any) {
      console.error('Document upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload document' });
    }
  });

  router.post('/api/documents/create', (req: Request, res: Response) => {
    try {
      const { title, category, fileName, content, tags } = req.body;
      const result = documentService.createFromText({ title, category, fileName, content, tags });

      if (!result.ok) {
        return sendErrorResponse(res, result.error);
      }
      res.json({ success: true, document: result.value });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/api/documents/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const remainingCount = documentService.delete(id);
    res.json({ success: true, remainingCount });
  });

  return router;
}
