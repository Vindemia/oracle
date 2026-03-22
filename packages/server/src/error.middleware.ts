import type { NextFunction, Request, Response } from 'express';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log server-side but don't expose details to client
  console.error('[Error]', err);

  if (res.headersSent) return;

  if (err instanceof Error) {
    // Do not expose internal messages — only generic response
    res.status(500).json({ error: 'Une erreur est survenue', code: 'INTERNAL_ERROR' });
    return;
  }

  res.status(500).json({ error: 'Une erreur est survenue', code: 'INTERNAL_ERROR' });
}
