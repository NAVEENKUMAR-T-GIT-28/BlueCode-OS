import type { RequestHandler } from 'express';
import { campaignService } from '../services/campaign.service.js';

export const createCampaign: RequestHandler = async (req, res, next) => {
  try {
    const item = await campaignService.create({
      startupId: req.tenant!.startupId.toString(), userId: req.auth!.userId.toString(),
      icpId: req.body.icpId, name: req.body.name, channel: req.body.channel,
    });
    res.status(201).json({ data: item });
  } catch (error) { next(error); }
};

export const listCampaigns: RequestHandler = async (req, res, next) => {
  try {
    const result = await campaignService.list(req.tenant!.startupId.toString(), {
      ...(typeof req.query.status === 'string' ? { status: req.query.status as any } : {}),
      sort: req.query.sort === 'createdAt' ? 'createdAt' : '-createdAt',
      page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20),
    });
    res.json({ data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.get(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};

export const updateCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.updateName(req.tenant!.startupId.toString(), req.params['id'] as string, req.body.name) }); }
  catch (error) { next(error); }
};

export const submitCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.submit(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
export const approveCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.approve(req.tenant!.startupId.toString(), req.params['id'] as string, req.auth!.userId.toString()) }); }
  catch (error) { next(error); }
};
export const pauseCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.pause(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
export const resumeCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.resume(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
export const completeCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.complete(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
export const cancelCampaign: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await campaignService.cancel(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
