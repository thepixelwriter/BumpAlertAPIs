import type { Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/postgres';
import { ApiError } from '../middleware/error-handler';
import type { AuthenticatedRequest } from '../middleware/auth';

const reportPayloadSchema = z.object({
  deviceId: z.string().max(128).optional(),
  submittedAt: z.number().int().positive(),
  hazards: z.array(z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timestamp: z.number().int().positive(),
    severity: z.enum(['moderate', 'severe', 'alarming']),
    gForce: z.number().min(0).max(20).optional(),
  })).min(1),
});

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'dismissed', 'submitted']),
});

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  status: z.enum(['pending', 'confirmed', 'dismissed', 'submitted']).optional(),
});

function serializeReport(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    submittedAt: row.submitted_at,
    latitude: row.latitude,
    longitude: row.longitude,
    timestamp: row.timestamp,
    severity: row.severity,
    gForce: row.g_force,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export async function createReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  const payload = reportPayloadSchema.parse(req.body);

  const rows = payload.hazards.map((hazard) => ({
    userId: req.user!.id,
    deviceId: payload.deviceId ?? null,
    submittedAt: new Date(payload.submittedAt).toISOString(),
    latitude: hazard.latitude,
    longitude: hazard.longitude,
    timestamp: hazard.timestamp,
    severity: hazard.severity,
    gForce: hazard.gForce ?? 0,
    status: 'submitted',
    metadata: {
      source: 'mobile-app',
      detectionWindow: payload.submittedAt,
    },
  }));

  const result = await Promise.all(rows.map((row) => pool.query(
    `INSERT INTO reports (user_id, device_id, submitted_at, latitude, longitude, timestamp, severity, g_force, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [row.userId, row.deviceId, row.submittedAt, row.latitude, row.longitude, row.timestamp, row.severity, row.gForce, row.status, JSON.stringify(row.metadata)],
  )));

  res.status(201).json({ inserted: result.length, reports: result.map((r) => serializeReport(r.rows[0])) });
}

export async function getMyReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const query = listSchema.parse(req.query);

  const offset = (query.page - 1) * query.limit;
  const statusParam = query.status ? 'AND status = $2' : '';
  const values: unknown[] = [req.user!.id];
  if (query.status) values.push(query.status);
  values.push(query.limit, offset);

  const limitIndex = values.length - 1;
  const offsetIndex = values.length;

  const result = await pool.query(
    `SELECT * FROM reports
     WHERE user_id = $1 ${statusParam}
     ORDER BY created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values,
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM reports WHERE user_id = $1 ${query.status ? 'AND status = $2' : ''}`,
    query.status ? [req.user!.id, query.status] : [req.user!.id],
  );

  res.json({
    page: query.page,
    limit: query.limit,
    total: countResult.rows[0].total,
    reports: result.rows.map((row) => serializeReport(row)),
  });
}

export async function listNearbyReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  const query = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusMeters: z.coerce.number().positive().max(50000).default(2000),
  }).parse(req.query);

  const result = await pool.query(
    `SELECT * FROM reports
     WHERE user_id = $1
       AND ABS(latitude - $2) <= ($3 / 111000)
       AND ABS(longitude - $4) <= ($3 / (111000 * COS(RADIANS($2))))
     ORDER BY created_at DESC`,
    [req.user!.id, query.lat, query.radiusMeters, query.lng],
  );

  res.json({ reports: result.rows.map((row) => serializeReport(row)) });
}

export async function getReportById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await pool.query(
    'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id],
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, `Report not found: ${req.params.id}`);
  }

  res.json({ report: serializeReport(result.rows[0]) });
}

export async function updateReportStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const payload = statusSchema.parse(req.body);

  const result = await pool.query(
    `UPDATE reports
     SET status = $1
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [payload.status, req.params.id, req.user!.id],
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, `Report not found: ${req.params.id}`);
  }

  res.json({ report: serializeReport(result.rows[0]) });
}
