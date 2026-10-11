import { Types } from 'mongoose';
import { Prospect } from '../models/prospect.model.js';
import { DecisionMaker } from '../models/decision-maker.model.js';
import { BuyingSignal } from '../models/buying-signal.model.js';
import { SalesActivity } from '../models/sales-activity.model.js';
import type { SignalCandidate } from '../services/signal-rules.js';

export const contactSignalRepository = {
  findProspect(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    return Prospect.findOne({ _id: prospectId, startupId });
  },

  listContacts(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    return DecisionMaker.find({ startupId, prospectId })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
  },

  findContactByEmail(startupId: Types.ObjectId, prospectId: Types.ObjectId, businessEmail: string) {
    return DecisionMaker.findOne({ startupId, prospectId, businessEmail })
      .select('_id')
      .lean();
  },

  findContactById(startupId: Types.ObjectId, decisionMakerId: Types.ObjectId) {
    return DecisionMaker.findOne({ _id: decisionMakerId, startupId }).select('_id').lean();
  },

  createManualContact(input: {
    startupId: Types.ObjectId;
    prospectId: Types.ObjectId;
    fullName: string;
    jobTitle?: string;
    businessEmail: string;
    linkedinUrl?: string;
  }) {
    return DecisionMaker.create({
      startupId: input.startupId,
      prospectId: input.prospectId,
      fullName: input.fullName,
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      businessEmail: input.businessEmail.toLowerCase(),
      ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl } : {}),
      source: 'manual',
      emailVerified: false,
      outreachStatus: 'not_contacted',
    });
  },

  recordContactAdded(input: {
    startupId: Types.ObjectId;
    prospectId: Types.ObjectId;
    decisionMakerId: Types.ObjectId;
    occurredAt: Date;
  }) {
    return SalesActivity.create({
      startupId: input.startupId,
      prospectId: input.prospectId,
      activityType: 'contact_added',
      summary: 'A decision-maker contact was added manually.',
      metadata: { source: 'manual', decisionMakerId: String(input.decisionMakerId) },
      occurredAt: input.occurredAt,
    });
  },

  async markContactDnc(startupId: Types.ObjectId, decisionMakerId: Types.ObjectId) {
    const contact = await DecisionMaker.findOne({ _id: decisionMakerId, startupId });
    if (!contact) return null;
    contact.outreachStatus = 'do_not_contact';
    await contact.save();
    return contact;
  },

  listSignals(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    return BuyingSignal.find({ startupId, prospectId }).sort({ detectedAt: -1, _id: -1 }).lean();
  },

  async createSignal(input: {
    startupId: Types.ObjectId;
    prospectId: Types.ObjectId;
    candidate: SignalCandidate;
    detectedAt: Date;
  }) {
    const signal = await BuyingSignal.create({
      startupId: input.startupId,
      prospectId: input.prospectId,
      signalType: input.candidate.signalType,
      description: input.candidate.description,
      evidence: input.candidate.evidence,
      confidence: input.candidate.confidence,
      status: 'active',
      detectedAt: input.detectedAt,
    });

    await SalesActivity.create({
      startupId: input.startupId,
      prospectId: input.prospectId,
      activityType: 'signal_detected',
      summary: `Evidence-backed ${input.candidate.signalType} signal detected.`,
      metadata: { signalId: String(signal._id), signalType: input.candidate.signalType },
      occurredAt: input.detectedAt,
    });
    return signal;
  },

  findSignalById(startupId: Types.ObjectId, signalId: Types.ObjectId) {
    return BuyingSignal.findOne({ _id: signalId, startupId });
  },

  async dismissSignal(startupId: Types.ObjectId, signalId: Types.ObjectId) {
    const signal = await BuyingSignal.findOne({ _id: signalId, startupId });
    if (!signal) return null;
    if (signal.status !== 'dismissed') {
      signal.status = 'dismissed';
      await signal.save();
    }
    return signal;
  },
};
