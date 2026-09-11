import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import {
  createReport,
  getMyReports,
  getReportById,
  listNearbyReports,
  updateReportStatus,
} from '../controllers/report.controller';

export const reportRouter = Router();

reportRouter.use(requireAuth);
reportRouter.post('/', asyncHandler(createReport));
reportRouter.get('/', asyncHandler(getMyReports));
reportRouter.get('/nearby', asyncHandler(listNearbyReports));
reportRouter.get('/:id', asyncHandler(getReportById));
reportRouter.patch('/:id/status', asyncHandler(updateReportStatus));
