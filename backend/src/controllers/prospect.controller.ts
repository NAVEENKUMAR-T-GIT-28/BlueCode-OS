import type { RequestHandler } from 'express';
import { prospectService } from '../services/prospect.service.js';
import type { ProspectListQuery, ProspectStatus, ScoreCategory } from '../types/prospect.js';

export const searchProspects: RequestHandler = async (req, res, next) => {
  try {
    const data = await prospectService.search({
      startupId: req.tenant!.startupId.toString(),
      plan: req.tenant!.plan,
      icpId: req.body.icpId,
      page: req.body.page,
      perPage: req.body.perPage,
      requestId: req.requestId,
    });
    res.json({ data });
  } catch (error) { next(error); }
};

export const listProspects: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.query;
    const categories = typeof raw.category === 'string' ? raw.category.split(',') as ScoreCategory[] : undefined;
    const query: ProspectListQuery = {
      ...(typeof raw.icpId === 'string' ? { icpId: raw.icpId } : {}),
      ...(typeof raw.scoredAgainstIcpId === 'string' ? { scoredAgainstIcpId: raw.scoredAgainstIcpId } : {}),
      ...(typeof raw.status === 'string' ? { status: raw.status as ProspectStatus } : {}),
      ...(categories ? { category: categories } : {}),
      ...(raw.minScore !== undefined ? { minScore: Number(raw.minScore) } : {}),
      ...(typeof raw.q === 'string' ? { q: raw.q } : {}),
      includeLow: raw.includeLow === 'true',
      sort: typeof raw.sort === 'string' ? raw.sort as ProspectListQuery['sort'] : '-createdAt',
      page: Number(raw.page ?? 1), limit: Number(raw.limit ?? 20),
    };
    const result = await prospectService.list(req.tenant!.startupId.toString(), query);
    res.json({ data: result.items, meta: result.meta });
  } catch (error) { next(error); }
};

export const getProspect: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await prospectService.get(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};

export const selectProspects: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await prospectService.select(req.tenant!.startupId.toString(), req.body.prospectIds) }); }
  catch (error) { next(error); }
};

export const disqualifyProspect: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await prospectService.disqualify(req.tenant!.startupId.toString(), req.params['id'] as string, req.body.reason) }); }
  catch (error) { next(error); }
};

export const markProspectDoNotContact: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await prospectService.markDoNotContact(req.tenant!.startupId.toString(), req.params['id'] as string, req.body.reason) }); }
  catch (error) { next(error); }
};

export const clearProspectDoNotContact: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await prospectService.clearDoNotContact(req.tenant!.startupId.toString(), req.params['id'] as string, req.body.reason) }); }
  catch (error) { next(error); }
};
