import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtUserPayload {
  userId: string;
  email: string;
  name: string;
}

export function signToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, env.jwtSecret as jwt.Secret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as JwtUserPayload;
  return decoded;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function createResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function comparePassword(password: string, passwordHash: string): boolean {
  return bcrypt.compareSync(password, passwordHash);
}
