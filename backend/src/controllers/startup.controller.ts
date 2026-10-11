import type { RequestHandler } from 'express';
import { startupService } from '../services/startup.service.js';

function startupDto(result: Awaited<ReturnType<typeof startupService.resolveCurrent>>) {
  const startup = result.startup;
  const spend = {
    capPaise: startup.apiSpendCap,
    committedPaise: startup.spendCommitted,
    reservedPaise: startup.spendReserved,
    remainingPaise: Math.max(0, startup.apiSpendCap - startup.spendCommitted - startup.spendReserved),
  };
  return {
    id: startup.id, name: startup.name, plan: startup.plan, status: startup.status,
    trialEndsAt: startup.trialEndsAt, settings: startup.settings ?? {}, spend,
    me: { role: result.membership.role, permissions: result.permissions },
    capabilities: { searchOrgs: false, searchPeople: false, enrich: false },
    createdAt: startup.createdAt, updatedAt: startup.updatedAt,
  };
}

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
    res.json({ data: { startup: startupDto(result) } });
  } catch (error) { next(error); }
};

export const updateCurrentStartup: RequestHandler = async (req, res, next) => {
  try {
    await startupService.updateSettings(req.tenant!.startupId.toString(), req.body);
    const result = await startupService.resolveCurrent(req.auth!.userId.toString(), req.tenant!.startupId.toString());
    res.json({ data: { startup: startupDto(result) } });
  } catch (error) { next(error); }
};

export const listCurrentMembers: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await startupService.listMembers(req.tenant!.startupId.toString()) });
  } catch (error) { next(error); }
};

export const inviteCurrentMember: RequestHandler = async (req, res, next) => {
  try {
    const member = await startupService.inviteMember({
      startupId: req.tenant!.startupId.toString(),
      plan: req.tenant!.plan,
      email: req.body.email,
      role: req.body.role,
    });
    res.status(201).json({ data: member });
  } catch (error) { next(error); }
};

export const updateCurrentMemberRole: RequestHandler = async (req, res, next) => {
  try {
    const memberId = req.params['memberId'] as string;
    const member = await startupService.updateMemberRole(
      req.tenant!.startupId.toString(), memberId, req.body.role,
    );
    res.json({ data: member });
  } catch (error) { next(error); }
};

export const removeCurrentMember: RequestHandler = async (req, res, next) => {
  try {
    const memberId = req.params['memberId'] as string;
    await startupService.removeMember(req.tenant!.startupId.toString(), memberId);
    res.status(204).end();
  } catch (error) { next(error); }
};
