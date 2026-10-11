import { Types } from 'mongoose';
import { ApiError } from '../shared/api-error.js';
import { contactSignalRepository } from '../repositories/contact-signal.repository.js';
import { detectSignalCandidates, signalEvidenceSignature } from './signal-rules.js';
import { clock } from '../utils/clock.js';

const SIGNAL_STALE_DAYS = 45;

function id(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function contactDto(doc: any) {
  return {
    id: id(doc._id),
    prospectId: id(doc.prospectId),
    fullName: doc.fullName,
    ...(doc.jobTitle ? { jobTitle: doc.jobTitle } : {}),
    ...(doc.businessEmail ? { businessEmail: doc.businessEmail } : {}),
    ...(doc.linkedinUrl ? { linkedinUrl: doc.linkedinUrl } : {}),
    ...(doc.emailVerified !== undefined ? { emailVerified: doc.emailVerified } : {}),
    source: doc.source,
    outreachStatus: doc.outreachStatus,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function signalDto(doc: any, now: Date) {
  const staleBefore = now.getTime() - SIGNAL_STALE_DAYS * 24 * 60 * 60 * 1000;
  const isStale = doc.status === 'active' && new Date(doc.detectedAt).getTime() < staleBefore;
  return {
    id: id(doc._id),
    prospectId: id(doc.prospectId),
    ...(doc.decisionMakerId ? { decisionMakerId: id(doc.decisionMakerId) } : {}),
    signalType: doc.signalType,
    description: doc.description,
    evidence: doc.evidence,
    confidence: doc.confidence,
    status: isStale ? 'stale' : doc.status,
    detectedAt: doc.detectedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const contactSignalService = {
  async listContacts(startupIdValue: string, prospectIdValue: string) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(prospectIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const prospectId = new Types.ObjectId(prospectIdValue);
    const prospect = await contactSignalRepository.findProspect(startupId, prospectId);
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');
    const contacts = await contactSignalRepository.listContacts(startupId, prospectId);
    return contacts.map(contactDto);
  },

  async addManualContact(startupIdValue: string, prospectIdValue: string, input: {
    fullName: string; jobTitle?: string; businessEmail: string; linkedinUrl?: string;
  }) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(prospectIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const prospectId = new Types.ObjectId(prospectIdValue);
    const prospect = await contactSignalRepository.findProspect(startupId, prospectId);
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');
    if (prospect.status === 'do_not_contact') {
      throw new ApiError(409, 'DO_NOT_CONTACT', 'Cannot add a contact to a do-not-contact prospect');
    }

    const email = input.businessEmail.trim().toLowerCase();
    if (await contactSignalRepository.findContactByEmail(startupId, prospectId, email)) {
      throw new ApiError(409, 'CONFLICT', 'This business email already exists on the prospect');
    }

    try {
      const contact = await contactSignalRepository.createManualContact({
        startupId, prospectId,
        fullName: input.fullName.trim(),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle.trim() } : {}),
        businessEmail: email,
        ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl.trim() } : {}),
      });
      await contactSignalRepository.recordContactAdded({
        startupId, prospectId, decisionMakerId: contact._id, occurredAt: clock.now(),
      });
      return contactDto(contact);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ApiError(409, 'CONFLICT', 'This business email already exists on the prospect');
      }
      throw error;
    }
  },

  async searchContacts(startupIdValue: string, prospectIdValue: string) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(prospectIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const prospect = await contactSignalRepository.findProspect(startupId, new Types.ObjectId(prospectIdValue));
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');
    throw new ApiError(503, 'CAPABILITY_DISABLED', 'People search is disabled until Apollo search_people is verified and enabled', {
      capability: 'search_people',
    });
  },

  async enrichContact(startupIdValue: string, decisionMakerIdValue: string) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(decisionMakerIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed decision-maker ID');
    const contact = await contactSignalRepository.findContactById(startupId, new Types.ObjectId(decisionMakerIdValue));
    if (!contact) throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    throw new ApiError(503, 'CAPABILITY_DISABLED', 'Contact enrichment is disabled until Apollo enrich is verified and enabled', {
      capability: 'enrich',
    });
  },

  async markContactDnc(startupIdValue: string, decisionMakerIdValue: string) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(decisionMakerIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed decision-maker ID');
    const contact = await contactSignalRepository.markContactDnc(startupId, new Types.ObjectId(decisionMakerIdValue));
    if (!contact) throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    return contactDto(contact);
  },

  async listSignals(startupIdValue: string, prospectIdValue: string, status?: 'active' | 'dismissed' | 'stale') {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(prospectIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const prospectId = new Types.ObjectId(prospectIdValue);
    const prospect = await contactSignalRepository.findProspect(startupId, prospectId);
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');
    const now = clock.now();
    const items = (await contactSignalRepository.listSignals(startupId, prospectId))
      .map(signal => signalDto(signal, now))
      .filter(signal => status === undefined || signal.status === status);
    return items;
  },

  async detectSignals(startupIdValue: string, prospectIdValue: string) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(prospectIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const prospectId = new Types.ObjectId(prospectIdValue);
    const prospect = await contactSignalRepository.findProspect(startupId, prospectId);
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');

    const candidates = detectSignalCandidates(prospect.firmographics as { technologies?: unknown } | null | undefined);
    const existing = await contactSignalRepository.listSignals(startupId, prospectId);
    const known = new Set(existing.map(signal => signalEvidenceSignature({
      signalType: signal.signalType,
      evidence: signal.evidence.map(item => ({ field: item.field, value: item.value })),
    })));
    const created = [];
    for (const candidate of candidates) {
      if (known.has(signalEvidenceSignature(candidate))) continue;
      const signal = await contactSignalRepository.createSignal({
        startupId, prospectId, candidate, detectedAt: clock.now(),
      });
      created.push(signalDto(signal, clock.now()));
    }
    return {
      created: created.length,
      signals: created,
      ...(created.length === 0 ? { message: 'No new evidence-backed signals found in available data' } : {}),
    };
  },

  async interpretSignal(startupIdValue: string, prospectIdValue: string) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(prospectIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const prospect = await contactSignalRepository.findProspect(startupId, new Types.ObjectId(prospectIdValue));
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');
    throw new ApiError(503, 'CAPABILITY_DISABLED', 'Signal interpretation is disabled until the AI service is implemented and configured', {
      capability: 'signal_interpret',
    });
  },

  async dismissSignal(startupIdValue: string, signalIdValue: string) {
    const startupId = new Types.ObjectId(startupIdValue);
    if (!Types.ObjectId.isValid(signalIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed signal ID');
    const signal = await contactSignalRepository.dismissSignal(startupId, new Types.ObjectId(signalIdValue));
    if (!signal) throw new ApiError(404, 'NOT_FOUND', 'Signal not found');
    return signalDto(signal, clock.now());
  },
};
