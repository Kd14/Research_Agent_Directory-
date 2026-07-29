import { Router, type Request, type Response } from 'express';
import type { ToolService } from '../services/ToolService';

export function createMcpRouter(toolService: ToolService): Router {
  const router = Router();

  router.get('/api/mcp/tools', (req: Request, res: Response) => {
    res.json({ tools: toolService.listDisplayTools(), status: 'online', protocolVersion: '2026-06-MCP' });
  });

  router.post('/api/mcp/execute', async (req: Request, res: Response) => {
    const { toolName, args, agentId } = req.body;

    if (!toolService.findDisplayTool(toolName)) {
      return res.status(404).json({ error: `Tool ${toolName} not found on MCP Server` });
    }

    const result = await toolService.executeDirect(toolName, args || {});

    if (!result.ok) {
      return res.status(result.error.httpStatus).json({
        success: false,
        toolName,
        error: result.error.message
      });
    }

    res.json({
      success: true,
      toolName,
      agentId,
      args,
      result: result.value,
      mcpTimestamp: new Date().toISOString()
    });
  });

  return router;
}
