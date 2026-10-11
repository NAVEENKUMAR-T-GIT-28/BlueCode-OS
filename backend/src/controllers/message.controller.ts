import type { RequestHandler } from 'express';
import { messageService } from '../services/message.service.js';

export const draftMessage: RequestHandler = async (req, res, next) => {
  try {
    const result = await messageService.draft({
      startupId: req.tenant!.startupId.toString(), userId: req.auth!.userId.toString(),
      plan: req.tenant!.plan, requestId: req.requestId,
      campaignId: req.body.campaignId, decisionMakerId: req.body.decisionMakerId,
      step: req.body.step, regenerate: req.body.regenerate,
    });
    res.status(result.created ? 201 : 200).json({ data: result.item });
  } catch (error) { next(error); }
};

export const listMessages: RequestHandler = async (req, res, next) => {
  try {
    const result = await messageService.list(req.tenant!.startupId.toString(), {
      ...(typeof req.query.campaignId === 'string' ? { campaignId: req.query.campaignId } : {}),
      ...(typeof req.query.prospectId === 'string' ? { prospectId: req.query.prospectId } : {}),
      ...(typeof req.query.decisionMakerId === 'string' ? { decisionMakerId: req.query.decisionMakerId } : {}),
      ...(typeof req.query.approvalStatus === 'string' ? { approvalStatus: req.query.approvalStatus as any } : {}),
      ...(typeof req.query.status === 'string' ? { status: req.query.status as any } : {}),
      sort: req.query.sort === 'createdAt' ? 'createdAt' : '-createdAt',
      page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20),
    });
    res.json({ data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getMessage: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.get(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
export const editMessage: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.edit(req.tenant!.startupId.toString(), req.params['id'] as string, req.body) }); }
  catch (error) { next(error); }
};
export const approveMessage: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.approve(req.tenant!.startupId.toString(), req.params['id'] as string, req.auth!.userId.toString()) }); }
  catch (error) { next(error); }
};
export const rejectMessage: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.reject(req.tenant!.startupId.toString(), req.params['id'] as string, req.body.reason) }); }
  catch (error) { next(error); }
};
export const requestMessageRevision: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.requestRevision(req.tenant!.startupId.toString(), req.params['id'] as string, req.body.note) }); }
  catch (error) { next(error); }
};
export const handoffMessage: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.handoff(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
export const markMessageSent: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.markSent(req.tenant!.startupId.toString(), req.params['id'] as string, req.body.sentAt) }); }
  catch (error) { next(error); }
};
export const cancelMessage: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await messageService.cancel(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
