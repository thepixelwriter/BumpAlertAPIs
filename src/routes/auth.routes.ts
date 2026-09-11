import { Router } from 'express';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db/postgres';
import { ApiError } from '../middleware/error-handler';
import { asyncHandler } from '../middleware/async-handler';
import { hashPassword, createResetToken, hashToken, signToken, comparePassword } from '../utils/security';
import { env } from '../config/env';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

const googleSchema = z.object({
  credential: z.string().min(20),
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().optional(),
  avatarUrl: z.string().url().optional(),
});

const router = Router();

function toUserResponse(user: { id: string; name: string; email: string; provider: string; google_id?: string | null; avatar_url?: string | null; }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
    googleId: user.google_id ?? null,
    avatarUrl: user.avatar_url ?? null,
  };
}

router.post('/register', asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [payload.email.toLowerCase()]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'An account already exists for this email');
  }

  const passwordHash = hashPassword(payload.password);
  const userResult = await pool.query(
    `INSERT INTO users (name, email, password_hash, provider)
     VALUES ($1, $2, $3, 'local')
     RETURNING id, name, email, provider, google_id, avatar_url`,
    [payload.name.trim(), payload.email.toLowerCase(), passwordHash],
  );

  const user = userResult.rows[0];
  const token = signToken({ userId: user.id, email: user.email, name: user.name });

  res.status(201).json({ token, user: toUserResponse(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);

  const userResult = await pool.query(
    `SELECT id, name, email, password_hash, provider, google_id, avatar_url
     FROM users WHERE email = $1`,
    [payload.email.toLowerCase()],
  );

  const user = userResult.rows[0];
  if (!user || !user.password_hash || !comparePassword(payload.password, user.password_hash)) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = signToken({ userId: user.id, email: user.email, name: user.name });
  res.json({ token, user: toUserResponse(user) });
}));

router.post('/google', asyncHandler(async (req, res) => {
  const payload = googleSchema.parse(req.body);
  if (!env.googleClientId) {
    throw new ApiError(500, 'Google sign in is not configured on the server');
  }

  const client = new OAuth2Client(env.googleClientId);
  const ticket = await client.verifyIdToken({
    idToken: payload.credential,
    audience: env.googleClientId,
  });

  const googleUser = ticket.getPayload();
  if (!googleUser?.email) {
    throw new ApiError(401, 'Google authentication failed');
  }

  const email = googleUser.email.toLowerCase();
  const name = payload.name ?? googleUser.name ?? 'Google User';
  const avatarUrl = payload.avatarUrl ?? googleUser.picture ?? null;

  let userResult = await pool.query(
    `SELECT id, name, email, provider, google_id, avatar_url FROM users WHERE email = $1`,
    [email],
  );

  if (userResult.rows.length === 0) {
    userResult = await pool.query(
      `INSERT INTO users (name, email, provider, google_id, avatar_url)
       VALUES ($1, $2, 'google', $3, $4)
       RETURNING id, name, email, provider, google_id, avatar_url`,
      [name, email, googleUser.sub, avatarUrl],
    );
  } else {
    userResult = await pool.query(
      `UPDATE users
       SET name = $1, google_id = COALESCE(google_id, $2), avatar_url = COALESCE($3, avatar_url), updated_at = NOW()
       WHERE email = $4
       RETURNING id, name, email, provider, google_id, avatar_url`,
      [name, googleUser.sub, avatarUrl, email],
    );
  }

  const user = userResult.rows[0];
  const token = signToken({ userId: user.id, email: user.email, name: user.name });
  res.json({ token, user: toUserResponse(user) });
}));

router.post('/forgot-password', asyncHandler(async (req, res) => {
  const payload = forgotPasswordSchema.parse(req.body);

  const userResult = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [payload.email.toLowerCase()],
  );

  if (userResult.rows.length === 0) {
    res.json({ message: 'If an account exists for that email, a reset link has been prepared.' });
    return;
  }

  const userId = userResult.rows[0].id;
  const token = createResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  res.json({
    message: 'If an account exists for that email, a reset link has been prepared.',
    resetToken: token,
  });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const payload = resetPasswordSchema.parse(req.body);

  const tokenHash = hashToken(payload.token);
  const resetResult = await pool.query(
    `SELECT user_id FROM password_resets
     WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [tokenHash],
  );

  if (resetResult.rows.length === 0) {
    throw new ApiError(400, 'Password reset token is invalid or expired');
  }

  const userId = resetResult.rows[0].user_id;
  const passwordHash = hashPassword(payload.password);

  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND token_hash = $2', [userId, tokenHash]);

  res.json({ message: 'Password updated successfully' });
}));

export const authRouter = router;
