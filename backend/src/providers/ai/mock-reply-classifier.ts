export const REPLY_INTENTS = [
  'interested', 'buying_interest', 'not_now', 'wrong_person', 'referral', 'objection', 'unsubscribe', 'out_of_office', 'other',
] as const;
export type ReplyIntent = typeof REPLY_INTENTS[number];
export interface ReplyClassification { intent: ReplyIntent; confidence: number }

const UNSUBSCRIBE = /\b(unsubscribe|stop\s+(?:email(?:ing)?|contacting)|do\s+not\s+(?:email|contact)|don't\s+(?:email|contact)|do not want (?:any )?more emails|don't want (?:any )?more emails|no more emails|remove\s+(?:me|my email|my address|us)(?:\s+from\s+(?:your\s+)?(?:mailing\s+)?list)?|take\s+me\s+off|opt\s+out|cease\s+(?:emailing|contacting))\b/i;

/** Local mock-only keyword guard. This always runs independently of any classifier. */
export function detectUnsubscribe(text: string): boolean {
  return UNSUBSCRIBE.test(text);
}

/**
 * Deterministic test/development fixture, not an AI model. Confidence values are illustrative
 * fixture outputs and must not be presented as live model confidence.
 */
export function classifyMockReply(text: string): ReplyClassification {
  const value = text.toLocaleLowerCase('en');
  if (detectUnsubscribe(text)) return { intent: 'unsubscribe', confidence: 0.99 };
  if (/\b(out of office|out-of-office|on leave|away until|back on (?:\w+\s+)?\d{1,2}|returning on)\b/i.test(value)) {
    return { intent: 'out_of_office', confidence: 0.9 };
  }
  if (/\b(wrong person|not the right person|no longer works here|doesn't work here|does not work here)\b/i.test(value)) {
    return { intent: 'wrong_person', confidence: 0.9 };
  }
  if (/\b(speak to|talk to|contact|reach out to)\s+(?:our|the)?\s*[A-Z][a-z]+\b/i.test(text) || /\b(refer you to|you should speak with|try contacting)\b/i.test(value)) {
    return { intent: 'referral', confidence: 0.82 };
  }
  if (/\b(not right now|not at this time|maybe later|next quarter|check back|perhaps another time)\b/i.test(value)) {
    return { intent: 'not_now', confidence: 0.82 };
  }
  if (/\b(interested|interesting|sounds good|sounds interesting|let's talk|lets talk|can we (?:talk|meet|speak)|would like to (?:talk|meet|speak)|schedule a (?:call|meeting)|book a (?:call|meeting)|set up a demo|send me (?:more|details)|available next week)\b/i.test(value)) {
    return { intent: 'buying_interest', confidence: 0.86 };
  }
  if (/\b(concern|too expensive|pricing|security review|integration|not sure|doesn't fit|does not fit|objection)\b/i.test(value)) {
    return { intent: 'objection', confidence: 0.76 };
  }
  return { intent: 'other', confidence: 0.45 };
}
