import type { RequestHandler } from 'express';
import { usageService } from '../services/usage.service.js';
import type { UsageProvider, UsageStatus } from '../types/usage.js';

export const getUsageSummary: RequestHandler = async (req, res, next) => {
  try {
    const summary = await usageService.getSummary(req.tenant!.startupId.toString());
    res.json({ data: summary });
  } catch (error) { next(error); }
};

export const getUsageRecords: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.query;
    const from = typeof raw.from === 'string' ? new Date(raw.from) : undefined;
    const to = typeof raw.to === 'string' ? new Date(raw.to) : undefined;
    const result = await usageService.listRecords(req.tenant!.startupId.toString(), {
      ...(raw.provider === 'apollo' || raw.provider === 'llm' ? { provider: raw.provider as UsageProvider } : {}),
      ...(typeof raw.operation === 'string' ? { operation: raw.operation } : {}),
      ...(raw.status === 'success' || raw.status === 'failed' || raw.status === 'blocked' ? { status: raw.status as UsageStatus } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page: Number(raw.page ?? 1),
      limit: Number(raw.limit ?? 20),
    });
    res.json({ data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};
