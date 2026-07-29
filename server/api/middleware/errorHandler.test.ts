import { describe, expect, it, vi } from 'vitest';
import { errorMiddleware, sendErrorResponse } from './errorHandler';
import { ToolError, ValidationError } from '../../errors/AppError';

function makeMockRes() {
  const res: any = {
    headersSent: false,
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
  return res;
}

describe('sendErrorResponse', () => {
  it('maps an AppError to its httpStatus and message', () => {
    const res = makeMockRes();
    sendErrorResponse(res, new ValidationError('bad input'));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'bad input' });
  });

  it('falls back to the provided message when the error has none', () => {
    const res = makeMockRes();
    sendErrorResponse(res, new ValidationError(''), 'fallback message');
    expect(res.body.error).toBe('fallback message');
  });
});

describe('errorMiddleware', () => {
  it('maps a known AppError without leaking internals', () => {
    const res = makeMockRes();
    const next = vi.fn();
    errorMiddleware(new ToolError('tool blew up', 'mcp_doc_search'), { method: 'POST', path: '/api/mcp/execute' } as any, res, next);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'tool blew up' });
    expect(next).not.toHaveBeenCalled();
  });

  it('maps an unknown thrown value to a generic 500 without leaking it to the client', () => {
    const res = makeMockRes();
    const next = vi.fn();
    errorMiddleware(new Error('some internal stack trace detail'), { method: 'GET', path: '/api/health' } as any, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'An unexpected error occurred' });
  });

  it('defers to next() if headers were already sent', () => {
    const res = makeMockRes();
    res.headersSent = true;
    const next = vi.fn();
    const err = new Error('too late');

    errorMiddleware(err, { method: 'GET', path: '/x' } as any, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
