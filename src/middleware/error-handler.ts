import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function isValidationError(err: unknown): err is { issues?: unknown[]; flatten?: () => unknown } {
  return err instanceof ZodError
    || (typeof err === 'object' && err !== null && ('issues' in err || (err as { name?: unknown }).name === 'ZodError'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isValidationError(err)) {
    const details = typeof err.flatten === 'function' ? err.flatten() : { issues: err.issues ?? [] };
    res.status(400).json({ error: 'Validation failed', details });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'Request body must be valid JSON' });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('BumpAlert server: unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
}
