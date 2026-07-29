import { Router, type Request, type Response } from 'express';
import { sendErrorResponse } from './middleware/errorHandler';
import { sendEvent, startHeartbeat, startSseResponse } from './sse';
import type { ResearchPipeline } from '../orchestration/ResearchPipeline';
import type { ResearchService } from '../services/ResearchService';

export function createResearchRouter(researchService: ResearchService, researchPipeline: ResearchPipeline): Router {
  const router = Router();

  // POST /api/research/run -> SSE stream driving a full 'auto' run: plan -> steps -> streamed synthesis
  router.post('/api/research/run', async (req: Request, res: Response) => {
    const { userPrompt, docIds, activeAgentIds } = req.body;

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
        { onEvent: (event, data) => sendEvent(res, event, data), signal: controller.signal }
      );
    } catch (err: any) {
      console.error('Research run error:', err);
      sendEvent(res, 'error', { message: err.message || 'Research run failed' });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  // POST /api/research/plan -> Decomposes user request into Instruction Set & Agent Assignment
  router.post('/api/research/plan', async (req: Request, res: Response) => {
    try {
      const { userPrompt, docIds, activeAgentIds } = req.body;

      if (!userPrompt) {
        return res.status(400).json({ error: 'userPrompt is required' });
      }

      const result = await researchService.plan({ userPrompt, docIds, activeAgentIds });
      if (!result.ok) {
        return sendErrorResponse(res, result.error, 'Failed to generate a research plan. Check that GEMINI_API_KEY is set and valid.');
      }

      res.json({
        success: true,
        session: result.value
      });
    } catch (err: any) {
      console.error('Plan generation error:', err);
      res.status(502).json({
        success: false,
        error: err.message || 'Failed to generate a research plan. Check that GEMINI_API_KEY is set and valid.'
      });
    }
  });

  // POST /api/research/execute-step -> Executes single step in agentic flow
  router.post('/api/research/execute-step', async (req: Request, res: Response) => {
    try {
      const { step, selectedDocIds, userFeedback, sessionId } = req.body;

      if (!step) {
        return res.status(400).json({ error: 'Instruction step is required' });
      }

      const result = await researchService.executeStep({ step, selectedDocIds, userFeedback, sessionId });
      if (!result.ok) {
        return res.status(result.error.httpStatus).json({
          success: false,
          agentId: step?.assignedAgentId,
          error: result.error.message || 'Agent step execution failed'
        });
      }

      res.json({ success: true, ...result.value });
    } catch (err: any) {
      console.error('Execute step error:', err);
      res.status(502).json({
        success: false,
        agentId: req.body.step?.assignedAgentId,
        error: err.message || 'Agent step execution failed'
      });
    }
  });

  // POST /api/research/synthesize -> Final Synthesis into Report by Lead Agent
  router.post('/api/research/synthesize', async (req: Request, res: Response) => {
    try {
      const { userPrompt, instructionSet, agentOutputs, selectedDocIds, sessionId } = req.body;

      const result = await researchService.synthesize({ userPrompt, instructionSet, agentOutputs, selectedDocIds, sessionId });
      if (!result.ok) {
        return res.status(result.error.httpStatus).json({
          success: false,
          error: result.error.message || 'Failed to synthesize the final report. Check that GEMINI_API_KEY is set and valid.'
        });
      }

      res.json({ success: true, report: result.value });
    } catch (err: any) {
      console.error('Synthesize error:', err);
      res.status(502).json({
        success: false,
        error: err.message || 'Failed to synthesize the final report. Check that GEMINI_API_KEY is set and valid.'
      });
    }
  });

  return router;
}
