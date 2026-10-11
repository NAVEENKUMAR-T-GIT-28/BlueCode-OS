import type { RequestHandler } from 'express';
import { startupService } from '../services/startup.service.js';

export const listStartups: RequestHandler = async (req, res, next) => {
  try { res.json({ data: { startups: await startupService.list(req.auth!.userId.toString()) } }); }
  catch (error) { next(error); }
};

export const createStartup: RequestHandler = async (req, res, next) => {
  try {
    const startup = await startupService.create(req.auth!.userId.toString(), req.body.name);
    res.status(201).json({ data: startup });
  } catch (error) { next(error); }
};

export const currentStartup: RequestHandler = async (req, res, next) => {
  try {
    const result = await startupService.resolveCurrent(req.auth!.userId.toString(), req.header('x-startup-id') ?? '');
    const spend = {
      capPaise: result.startup.apiSpendCap,
      committedPaise: result.startup.spendCommitted,
      reservedPaise: result.startup.spendReserved,
      remainingPaise: Math.max(0, result.startup.apiSpendCap - result.startup.spendCommitted - result.startup.spendReserved),
    };
    res.json({ data: { startup: {
      id: result.startup.id, name: result.startup.name, plan: result.startup.plan, status: result.startup.status,
      trialEndsAt: result.startup.trialEndsAt, settings: result.startup.settings ?? {}, spend,
      me: { role: result.membership.role, permissions: result.permissions },
      // Provider capabilities stay off until the Apollo account and commercial permissions are verified.
      capabilities: { searchOrgs: false, searchPeople: false, enrich: false },
      createdAt: result.startup.createdAt,
    } } });
  } catch (error) { next(error); }
};
