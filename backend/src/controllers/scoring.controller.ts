import type { RequestHandler } from 'express';
import { scoringService } from '../services/scoring.service.js';

export const scoreMany: RequestHandler = async (req, res, next) => {
  try {
    const result = await scoringService.scoreMany(req.tenant!.startupId.toString(), req.body);
    res.json({ data: result });
  } catch (error) { next(error); }
};

export const getProspectScores: RequestHandler = async (req, res, next) => {
  try {
    const prospectId = req.params['id'] as string;
    const rawIcpId = req.query['icpId'];
    const result = await scoringService.getScores(req.tenant!.startupId.toString(), prospectId, {
      ...(typeof rawIcpId === 'string' ? { icpId: rawIcpId } : {}),
      history: req.query['history'] === 'true',
      page: Number(req.query['page'] ?? 1),
      limit: Number(req.query['limit'] ?? 20),
    });
    if (result.history) res.json({ data: result.data, meta: result.meta });
    else res.json({ data: result.data });
  } catch (error) { next(error); }
};
