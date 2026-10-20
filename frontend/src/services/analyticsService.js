import { apiRequest } from './api';

/**
 * analyticsService.js — NEW
 * Wraps GET /api/analytics/progress. No response normalization needed —
 * the backend's shape is already exactly what the Progress page consumes
 * (summary, chartData, tests, availableRange), unlike most other service
 * files which translate Mongo's _id into the frontend's id convention —
 * this endpoint never returns raw Mongoose documents, only a purpose-built
 * response shape.
 */

export async function getProgressAnalytics({ groupBy, startDate, endDate }) {
  const params = { groupBy };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  return apiRequest('/analytics/progress', { params });
}
