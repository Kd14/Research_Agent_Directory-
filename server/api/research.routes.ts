import { Router, type Request, type Response } from 'express';
import { sendEvent, startHeartbeat, startSseResponse } from './sse';
import type { ResearchPipeline } from '../orchestration/ResearchPipeline';

export function createResearchRouter(researchPipeline: ResearchPipeline): Router {
  const router = Router();

  // POST /api/research/run -> SSE stream driving a full 'auto' run: plan -> steps -> streamed synthesis
  router.post('/api/research/run', async (req: Request, res: Response) => {
    const { userPrompt, docIds, activeAgentIds, reflectionEnabled } = req.body;

    if (!userPrompt) {
      return res.status(400).json({ error: 'userPrompt is required' });
    }

    startSseResponse(res);
    const heartbeat = startHeartbeat(res);
    const controller = new AbortController();
    // `res` (not `req`) is the right stream to watch: req.on('close') fires as soon as the
    // request body is fully consumed (long before we're done responding), while res.on('close')
    // only fires when the underlying connection actually closes - client disconnect, or our own
    // res.end() below.
    res.on('close', () => controller.abort());

    try {
      await researchPipeline.run(
        { userPrompt, docIds, activeAgentIds },
        {
          onEvent: (event, data) => sendEvent(res, event, data),
          signal: controller.signal,
          reflectionOverride: typeof reflectionEnabled === 'boolean' ? reflectionEnabled : undefined
        }
      );
    } catch (err: any) {
      console.error('Research run error:', err);
      sendEvent(res, 'error', { message: err.message || 'Research run failed' });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  // POST /api/research/resume/:sessionId -> SSE stream continuing a paused/dropped session from its
  // persisted currentStepIndex (skips planning; instructionSet may have been edited while paused).
  router.post('/api/research/resume/:sessionId', async (req: Request, res: Response) => {
    startSseResponse(res);
    const heartbeat = startHeartbeat(res);
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    try {
      await researchPipeline.resume(
        req.params.sessionId,
        { onEvent: (event, data) => sendEvent(res, event, data), signal: controller.signal }
      );
    } catch (err: any) {
      console.error('Research resume error:', err);
      sendEvent(res, 'error', { message: err.message || 'Research resume failed' });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  return router;
}
