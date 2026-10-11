import type { RequestHandler } from 'express';
import { dashboardService } from '../services/dashboard.service.js';

export const getDashboard: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await dashboardService.get(req.tenant!.startupId.toString()) }); }
  catch (error) { next(error); }
};
