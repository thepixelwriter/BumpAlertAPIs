import { Router } from 'express';
import { pool } from '../db/sqlite';
import { asyncHandler } from '../middleware/async-handler';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(async (_req, res) => {
  await pool.query('SELECT 1 AS connected');
  res.json({ status: 'ok', service: 'bumpalert-server', database: 'ok' });
}));
