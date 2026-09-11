import 'dotenv/config';

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(requireEnv('PORT', '3000'), 10),
  corsOrigin: requireEnv('CORS_ORIGIN', 'http://localhost:4200'),
  jwtSecret: requireEnv('JWT_SECRET', 'bumpalert-dev-secret'),
  jwtExpiresIn: requireEnv('JWT_EXPIRES_IN', '7d'),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
};
