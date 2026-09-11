import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error-handler';
import { verifyToken } from '../utils/security';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required');
  }

  const token = header.replace('Bearer ', '').trim();
  const payload = verifyToken(token);

  req.user = {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
  };

  next();
}
