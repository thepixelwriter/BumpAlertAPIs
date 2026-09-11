interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<{ results: T[] }>;
}

type DatabaseRow = Record<string, any>;

export interface D1DatabaseLike {
  prepare(query: string): D1Statement;
  exec(query: string): Promise<unknown>;
}

let database: D1DatabaseLike | undefined;
export const pool = {
  query: query,
};

export function configureDatabase(nextDatabase: D1DatabaseLike): void {
  database = nextDatabase;
}

export async function connectDatabase(nextDatabase?: D1DatabaseLike): Promise<void> {
  if (nextDatabase) {
    configureDatabase(nextDatabase);
  }

  if (!database) {
    throw new Error('D1 database is not configured');
  }

}

export async function initializeDatabase(): Promise<void> {
  if (!database) {
    throw new Error('D1 database is not configured');
  }

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      provider TEXT NOT NULL DEFAULT 'local',
      google_id TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT,
      submitted_at TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('moderate', 'severe', 'alarming')),
      g_force REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('pending', 'confirmed', 'dismissed', 'submitted')),
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reports_user_created ON reports(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_user_status ON reports(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude);
  `;

  for (const statement of schema.split(';').map((value) => value.trim()).filter(Boolean)) {
    await database.exec(statement);
  }
}

async function query<T = DatabaseRow>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  if (!database) {
    throw new Error('D1 database is not configured');
  }

  const statement = database.prepare(text);
  const result = params.length > 0 ? await statement.bind(...params).all<T>() : await statement.all<T>();
  return { rows: result.results };
}
