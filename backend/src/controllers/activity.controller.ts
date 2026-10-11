import type { RequestHandler } from 'express';
import { activityService } from '../services/activity.service.js';

export const listActivities: RequestHandler = async (req, res, next) => {
  try {
    const data = await activityService.list(req.tenant!.startupId.toString(), {
      ...(typeof req.query.prospectId === 'string' ? { prospectId: req.query.prospectId } : {}),
      ...(typeof req.query.messageId === 'string' ? { messageId: req.query.messageId } : {}),
      ...(typeof req.query.type === 'string' ? { type: req.query.type.split(',').filter(Boolean) } : Array.isArray(req.query.type) ? { type: req.query.type as string[] } : {}),
      ...(typeof req.query.from === 'string' ? { from: req.query.from } : {}),
      ...(typeof req.query.to === 'string' ? { to: req.query.to } : {}),
      sort: req.query.sort === 'occurredAt' ? 'occurredAt' : '-occurredAt',
    });
    res.json({ data });
  } catch (error) { next(error); }
};

export const logReply: RequestHandler = async (req, res, next) => {
  try {
    const data = await activityService.logReply({
      startupId: req.tenant!.startupId.toString(), requestId: req.requestId,
      prospectId: req.body.prospectId, ...(req.body.messageId ? { messageId: req.body.messageId } : {}), text: req.body.text,
    });
    res.status(201).json({ data });
  } catch (error) { next(error); }
};
