import { Pool, type QueryResultRow } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.dbUrl,
  max: 20,
  ssl: env.dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

export async function connectDatabase(): Promise<void> {
  await pool.query('SELECT 1');
  await initializeDatabase();
  console.log('BumpAlert server: connected to PostgreSQL');
}

export async function initializeDatabase(): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT,
      provider VARCHAR(20) NOT NULL DEFAULT 'local',
      google_id VARCHAR(255),
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT,
      submitted_at TIMESTAMPTZ NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      timestamp BIGINT NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('moderate', 'severe', 'alarming')),
      g_force DOUBLE PRECISION NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'submitted')),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_user_status ON reports(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_reports_location ON reports (latitude, longitude);
  `);
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  return pool.query<T>(text, params);
}
