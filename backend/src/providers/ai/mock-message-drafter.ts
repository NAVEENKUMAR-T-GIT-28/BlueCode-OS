export interface MockDraftInput {
  fullName: string;
  productSummary?: string;
  senderName?: string;
  senderTitle?: string;
  step: number;
}

export interface DraftContent { subject: string; body: string }

function plainText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 500);
}

/** A deterministic local fixture, not an LLM. No network calls are made by this module. */
export function buildMockMessageDraft(input: MockDraftInput): DraftContent {
  const rawFirstName = plainText(input.fullName).split(/\s+/)[0] ?? '';
  const firstName = rawFirstName.replace(/[<>]/g, '').slice(0, 60) || 'there';
  const summary = input.productSummary ? plainText(input.productSummary) : '';
  const senderName = input.senderName ? plainText(input.senderName) : 'Our team';
  const senderTitle = input.senderTitle ? plainText(input.senderTitle) : '';
  const signature = `Best,\n${senderName}${senderTitle ? `\n${senderTitle}` : ''}`;
  const topic = summary ? summary.slice(0, 36).replace(/[.,;:!?]+$/g, '') : 'your team’s workflow';

  let opening: string;
  if (input.step <= 1) {
    opening = summary
      ? `I’m reaching out to share a short overview of ${summary}.`
      : 'I’m reaching out to ask whether improving your team’s workflow is a current priority.';
  } else if (input.step === 2) {
    opening = summary
      ? `A different angle on ${summary}: would a short overview be useful?`
      : 'Would it be useful to compare approaches to a workflow your team is working on?';
  } else {
    opening = summary
      ? `I’ll leave it here after this note. If ${topic} becomes relevant, would a brief conversation be useful?`
      : 'I’ll leave it here after this note. If this becomes relevant, would a brief conversation be useful?';
  }
  const body = `Hi ${firstName},\n\n${opening}\n\n${input.step === 1 ? 'Would a brief conversation be useful?' : 'No pressure either way.'}\n\n${signature}`;
  const subject = (summary ? `A quick question about ${topic}` : 'A quick question').slice(0, 60);
  return { subject, body: body.slice(0, 1500) };
}
