import type { Response } from 'express';

export function startSseResponse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

export function sendEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function startHeartbeat(res: Response, intervalMs = 15000): NodeJS.Timeout {
  return setInterval(() => {
    res.write(': ping\n\n');
  }, intervalMs);
}
