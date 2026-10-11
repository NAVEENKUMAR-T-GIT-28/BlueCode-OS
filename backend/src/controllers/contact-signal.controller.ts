import type { RequestHandler } from 'express';
import { contactSignalService } from '../services/contact-signal.service.js';

export const listProspectContacts: RequestHandler = async (req, res, next) => {
  try {
    const items = await contactSignalService.listContacts(req.tenant!.startupId.toString(), req.params['id'] as string);
    res.json({ data: items });
  } catch (error) { next(error); }
};

export const addProspectContact: RequestHandler = async (req, res, next) => {
  try {
    const item = await contactSignalService.addManualContact(
      req.tenant!.startupId.toString(),
      req.params['id'] as string,
      req.body,
    );
    res.status(201).json({ data: item });
  } catch (error) { next(error); }
};

export const searchProspectContacts: RequestHandler = async (req, _res, next) => {
  try {
    await contactSignalService.searchContacts(req.tenant!.startupId.toString(), req.params['id'] as string);
  }
  catch (error) { next(error); }
};

export const enrichContact: RequestHandler = async (req, _res, next) => {
  try {
    await contactSignalService.enrichContact(req.tenant!.startupId.toString(), req.params['id'] as string);
  }
  catch (error) { next(error); }
};

export const markContactDoNotContact: RequestHandler = async (req, res, next) => {
  try {
    const item = await contactSignalService.markContactDnc(
      req.tenant!.startupId.toString(),
      req.params['id'] as string,
    );
    res.json({ data: item });
  } catch (error) { next(error); }
};

export const listProspectSignals: RequestHandler = async (req, res, next) => {
  try {
    const status = req.query['status'];
    const item = await contactSignalService.listSignals(
      req.tenant!.startupId.toString(),
      req.params['id'] as string,
      typeof status === 'string' ? status as 'active' | 'dismissed' | 'stale' : undefined,
    );
    res.json({ data: item });
  } catch (error) { next(error); }
};

export const detectProspectSignals: RequestHandler = async (req, res, next) => {
  try {
    const result = await contactSignalService.detectSignals(req.tenant!.startupId.toString(), req.params['id'] as string);
    res.json({ data: result });
  } catch (error) { next(error); }
};

export const interpretProspectSignals: RequestHandler = async (req, _res, next) => {
  try {
    await contactSignalService.interpretSignal(req.tenant!.startupId.toString(), req.params['id'] as string);
  }
  catch (error) { next(error); }
};

export const dismissSignal: RequestHandler = async (req, res, next) => {
  try {
    const item = await contactSignalService.dismissSignal(
      req.tenant!.startupId.toString(),
      req.params['id'] as string,
    );
    res.json({ data: item });
  } catch (error) { next(error); }
};
