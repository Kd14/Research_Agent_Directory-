import { Router, type Request, type Response } from 'express';
import type { MemoryService, UserPreferences } from '../services/MemoryService';

export function createPreferencesRouter(memoryService: MemoryService): Router {
  const router = Router();

  router.get('/api/preferences', (req: Request, res: Response) => {
    res.json({ preferences: memoryService.getPreferences() });
  });

  router.put('/api/preferences', (req: Request, res: Response) => {
    const patch = (req.body || {}) as Partial<UserPreferences>;
    const preferences = memoryService.savePreferences(patch);
    res.json({ success: true, preferences });
  });

  return router;
}
