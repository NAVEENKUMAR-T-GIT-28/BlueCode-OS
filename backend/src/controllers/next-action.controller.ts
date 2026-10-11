import type { RequestHandler } from 'express';
import { nextBestActionService } from '../services/next-action.service.js';

export const listNextActions: RequestHandler = async (req, res, next) => {
  try {
    const data = await nextBestActionService.list(req.tenant!.startupId.toString(), {
      status: typeof req.query.status === 'string' ? req.query.status as 'pending' | 'accepted' | 'dismissed' | 'completed' | 'expired' : 'pending',
      ...(typeof req.query.prospectId === 'string' ? { prospectId: req.query.prospectId } : {}),
      sort: 'priority',
    });
    res.json({ data: data.items, meta: data.meta });
  } catch (error) { next(error); }
};

export const acceptNextAction: RequestHandler = async (req, res, next) => {
  try {
    const result = await nextBestActionService.accept(req.tenant!.startupId.toString(), req.params['id'] as string);
    res.json({ data: result.item, next: result.next });
  } catch (error) { next(error); }
};
export const dismissNextAction: RequestHandler = async (req, res, next) => {
  try {
    // `reason` is accepted by the frozen API contract, but the frozen collection has no field for it.
    res.json({ data: await nextBestActionService.dismiss(req.tenant!.startupId.toString(), req.params['id'] as string) });
  } catch (error) { next(error); }
};
export const completeNextAction: RequestHandler = async (req, res, next) => {
  try { res.json({ data: await nextBestActionService.complete(req.tenant!.startupId.toString(), req.params['id'] as string) }); }
  catch (error) { next(error); }
};
