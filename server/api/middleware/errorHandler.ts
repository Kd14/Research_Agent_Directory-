import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/AppError';

export function sendErrorResponse(res: Response, error: AppError, fallbackMessage?: string): Response {
  return res.status(error.httpStatus).json({
    success: false,
    error: error.message || fallbackMessage || 'An unexpected error occurred'
  });
}

// Final safety net for anything a route handler passes to next(err) instead of handling itself
// (e.g. a synchronous throw inside middleware). Never leaks stack traces to the client; the full
// error is still logged server-side. Must be registered last, after every other app.use().
export function errorMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error(`Unhandled error on ${req.method} ${req.path}:`, err);

  if (err instanceof AppError) {
    sendErrorResponse(res, err);
    return;
  }

  res.status(500).json({ success: false, error: 'An unexpected error occurred' });
}
