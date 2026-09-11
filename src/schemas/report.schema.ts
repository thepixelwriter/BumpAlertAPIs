import { z } from 'zod';

export const hazardSeveritySchema = z.enum(['moderate', 'severe']);

export const hazardInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.number().int().positive(),
  severity: hazardSeveritySchema,
});

export const hazardSubmissionSchema = z.object({
  deviceId: z.string().min(1).max(128).optional(),
  submittedAt: z.number().int().positive(),
  hazards: z.array(hazardInputSchema).min(1, 'At least one hazard is required'),
});

export const reportStatusSchema = z.enum(['submitted', 'in_review', 'resolved', 'rejected']);

export const updateReportStatusSchema = z.object({
  status: reportStatusSchema,
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().positive().max(50000).default(2000),
});

export const listReportsQuerySchema = z.object({
  status: reportStatusSchema.optional(),
  severity: hazardSeveritySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
