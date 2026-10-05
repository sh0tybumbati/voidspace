import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

/** An error with an HTTP status and a message that is safe to show to the user. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = 'Sign in to continue.') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to do that.') => new HttpError(403, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Wrap an async route so a thrown error reaches the error handler instead of hanging the request. */
export const handler = <Req extends Request = Request>(fn: (req: Req, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { Promise.resolve(fn(req as Req, res)).catch(next); };

/** Last-resort error middleware: known errors keep their status, everything else is a 500. */
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: statusName(err.status), message: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({ error: 'Bad Request', message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    return;
  }
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Bad Request', message: 'That request body is not valid JSON.' });
    return;
  }
  if ((err as { type?: string })?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload Too Large', message: 'That request is too large.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', message: process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : 'Something went wrong.' });
}

function statusName(status: number): string {
  return ({ 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 429: 'Too Many Requests' } as Record<number, string>)[status] ?? 'Error';
}
