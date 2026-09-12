import { Router } from 'express';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db/sqlite';
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

function toUserResponse(user: Record<string, any>) {
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
         SET name = $1, google_id = COALESCE(google_id, $2), avatar_url = COALESCE($3, avatar_url), updated_at = CURRENT_TIMESTAMP
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

  await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, datetime('now', '+1 hour'))`,
    [userId, tokenHash],
  );

  const resendApiKey = (req.app.locals as { resendApiKey?: string }).resendApiKey;
  const resetUrl = (req.app.locals as { resetUrl?: string }).resetUrl;
  const emailFrom = (req.app.locals as { emailFrom?: string }).emailFrom;
  const emailFromName = (req.app.locals as { emailFromName?: string }).emailFromName;
  if (!resendApiKey || !resetUrl || !emailFrom || !emailFromName) {
    throw new ApiError(503, 'Password reset email is not configured');
  }

  const resetLink = new URL(resetUrl);
  resetLink.searchParams.set('token', token);
  const resetLinkValue = resetLink.toString();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${emailFromName} <${emailFrom}>`,
        to: [payload.email.toLowerCase()],
        subject: 'Reset your BumpAlert password',
        text: `Use this link to reset your BumpAlert password: ${resetLinkValue}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
        html: `<p>We received a request to reset your BumpAlert password.</p><p><a href="${resetLinkValue}">Reset your password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error('BumpAlert server: Resend rejected password reset email', response.status, details.slice(0, 500));
      throw new Error(`Resend request failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('BumpAlert server: failed to send password reset email', error);
    throw new ApiError(503, 'Password reset email could not be sent');
  }

  res.json({
    message: 'If an account exists for that email, a reset link has been prepared.',
  });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const payload = resetPasswordSchema.parse(req.body);

  const tokenHash = hashToken(payload.token);
  const resetResult = await pool.query(
    `SELECT user_id FROM password_resets
    WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [tokenHash],
  );

  if (resetResult.rows.length === 0) {
    throw new ApiError(400, 'Password reset token is invalid or expired');
  }

  const userId = resetResult.rows[0].user_id;
  const passwordHash = hashPassword(payload.password);

  await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [passwordHash, userId]);
  await pool.query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND token_hash = $2', [userId, tokenHash]);

  res.json({ message: 'Password updated successfully' });
}));

export const authRouter = router;
