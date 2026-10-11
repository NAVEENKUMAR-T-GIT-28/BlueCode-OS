import type { RequestHandler } from 'express';
import { icpService } from '../services/icp.service.js';
import { aiService } from '../providers/ai/ai.service.js';

export const proposeIcp: RequestHandler = async (req, res, next) => {
  try {
    const proposal = await aiService.runIcpExtract({
      startupId: req.tenant!.startupId.toString(),
      requestId: req.requestId,
    }, req.body);
    res.json({ data: proposal });
  } catch (error) { next(error); }
};

export const createIcp: RequestHandler = async (req, res, next) => {
  try {
    const item = await icpService.create({
      startupId: req.tenant!.startupId.toString(),
      userId: req.auth!.userId.toString(),
      plan: req.tenant!.plan,
      name: req.body.name,
      criteria: req.body.criteria,
    });
    res.status(201).json({ data: item });
  } catch (error) { next(error); }
};

export const listIcps: RequestHandler = async (req, res, next) => {
  try {
    // exactOptionalPropertyTypes: never pass `undefined` for an optional property —
    // use a conditional spread so the key is omitted entirely when absent.
    const isActiveRaw = req.query.isActive;
    const result = await icpService.list({
      startupId: req.tenant!.startupId.toString(),
      ...(isActiveRaw !== undefined && { isActive: isActiveRaw === 'true' }),
      sort: req.query.sort === 'createdAt' ? 'createdAt' : '-createdAt',
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
    });
    res.json({ data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getIcp: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params['id'] as string;
    res.json({ data: await icpService.get(req.tenant!.startupId.toString(), id) });
  } catch (error) { next(error); }
};

export const updateIcp: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params['id'] as string;
    res.json({ data: await icpService.update(req.tenant!.startupId.toString(), id, req.body) });
  } catch (error) { next(error); }
};

export const archiveIcp: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params['id'] as string;
    await icpService.archive(req.tenant!.startupId.toString(), id);
    res.status(204).end();
  } catch (error) { next(error); }
};
