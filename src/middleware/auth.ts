import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './error-handler';
import { asyncHandler } from './async-handler';
import { pool } from '../db/sqlite';
import { getPasswordVersion, verifyToken, type JwtUserPayload } from '../utils/security';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const requireAuth = asyncHandler(async (request: Request, _res: Response, next: NextFunction) => {
  const req = request as AuthenticatedRequest;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required');
  }

  const token = header.replace('Bearer ', '').trim();
  let payload: JwtUserPayload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Your session is no longer valid. Sign in again.');
    }
    throw error;
  }
  const userResult = await pool.query<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [payload.userId],
  );
  const user = userResult.rows[0];
  if (!user || payload.passwordVersion !== getPasswordVersion(user.password_hash)) {
    throw new ApiError(401, 'Your session is no longer valid. Sign in again.');
  }

  req.user = {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
  };

  next();
});
