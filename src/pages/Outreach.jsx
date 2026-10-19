
import {
  CheckCircle2,
  Clipboard,
  Mail,
  Send,
  CalendarDays,
  ExternalLink,
  RefreshCw,
  MessageCircle,
  Ban,
  BrainCircuit,
  Inbox,
  Clock3
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePrototype } from "../context/PrototypeContext";
import { PageHeader, Pill } from "../components/UI";

const STORAGE_KEY = "aiFounderOsSelectedConversation";

const demoReplies = [
  {
    text: "Thanks for reaching out! This sounds interesting. I'd love to learn more. Could we schedule a call?",
    intent: "positive"
  },
  {
    text: "Thanks for your email. Could you share a little more information about how this works?",
    intent: "neutral"
  },
  {
    text: "Thank you for reaching out, but this isn't something we're looking for right now.",
    intent: "negative"
  }
];

const companyReplyIndex = {
  vantageloop: 0,
  "northstar labs": 1,
  orbitscale: 2,
  "brightpath systems": 0,
  cloudharbor: 1,
  "evergreen digital": 2,
  "fieldnote tech": 0,
  "bluepeak analytics": 1,
  "novagrid systems": 2
};

function getKey(item) {
  return item ? String(item.id) : "";
}

function getDemoReply(item) {
  const company = String(item?.company || "").trim().toLowerCase();

  if (Object.prototype.hasOwnProperty.call(companyReplyIndex, company)) {
    return demoReplies[companyReplyIndex[company]].text;
  }

  let hash = 0;
  const identity = `${item?.id || ""}${item?.company || ""}${item?.person || ""}`;

  for (const character of identity) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return demoReplies[hash % demoReplies.length].text;
}

function classifyReply(reply) {
  const text = String(reply || "").toLowerCase();

  const negativePatterns = [
    "not interested",
    "isn't something we're looking for",
    "is not something we're looking for",
    "no longer interested",
    "please don't contact",
    "do not contact",
    "remove me",
    "not a fit",
    "not looking for",
    "unsubscribe",
    "stop emailing"
  ];

  const positivePatterns = [
    "schedule a call",
    "book a meeting",
    "book a call",
    "let's meet",
    "lets meet",
    "sounds interesting",
    "interested",
    "love to learn more",
    "happy to discuss",
    "set up a meeting",
    "available next week",
    "sounds great",
    "like to learn more"
  ];

  if (negativePatterns.some(pattern => text.includes(pattern))) {
    return "negative";
  }

  if (positivePatterns.some(pattern => text.includes(pattern))) {
    return "positive";
  }

  return "neutral";
}

const responseTemplates = {
  positive: [
    {
      subject: "Let's schedule a conversation",
      body: (firstName, company, url, founder) => `Hi ${firstName},

Thanks for getting back to me! I'm glad you're interested.

I'd love to arrange a short conversation to learn more about your needs and explore how we could help ${company}.

You can choose a convenient time here:
${url}

Looking forward to speaking with you.

Best,
${founder}`
    },
    {
      subject: "Great to hear from you — let's connect",
      body: (firstName, company, url, founder) => `Hi ${firstName},

Thank you for your interest. I'd be happy to discuss this further and learn more about what your team at ${company} is looking for.

Please choose a suitable time for a quick conversation here:
${url}

Looking forward to connecting.

Best,
${founder}`
    }
  ],
  neutral: [
    {
      subject: "Re: A little more information",
      body: (firstName, company, url, founder) => `Hi ${firstName},

Thanks for getting back to me.

I'd be happy to share more details about our solution and how it could be relevant to your team's needs at ${company}.

Is there a particular feature or challenge you'd like me to explain? I'll share the most relevant information.

Best,
${founder}`
    },
    {
      subject: "Re: Exploring a potential fit",
      body: (firstName, company, url, founder) => `Hi ${firstName},

Thanks for your response.

I'd be glad to explain our approach in more detail and clarify how it may be relevant to ${company}.

What would be most useful for you to understand at this stage?

Best regards,
${founder}`
    }
  ],
  negative: [
    {
      subject: "Thank you for letting me know",
      body: (firstName, company, url, founder) => `Hi ${firstName},

Thank you for letting me know. I understand, and I appreciate you taking the time to respond.

I'll close the loop here and won't send further follow-ups about this opportunity.

Wishing you and the ${company} team all the best.

Best regards,
${founder}`
    }
  ]
};

export default function Outreach() {
  const {
    outreach = [],
    updateOutreach,
    updateReplyIntent,
    handoffOutreach,
    markBookingLinkSentDemo,
    prospects = [],
    bookingUrl,
    account
  } = usePrototype();

  const founder = account?.name?.trim().toLowerCase() === "aslesha1008"
    ? "Aslesha"
    : account?.name?.trim() || "Aslesha";

  // Restore the last opened conversation.
  const [selectedId, setSelectedId] = useState(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    return outreach.some(item => getKey(item) === savedId)
      ? savedId
      : getKey(outreach[0]);
  });

  const [copied, setCopied] = useState(false);
  const [responseVersion, setResponseVersion] = useState(0);
  const [sentResponses, setSentResponses] = useState({});

  const draft =
    outreach.find(item => getKey(item) === selectedId) || outreach[0];

  const prospect = draft
    ? prospects.find(item => String(item.id) === String(draft.prospectId))
    : null;

  // Use the selected prospect's own reply where available.
  const incomingReply = draft
    ? draft.incomingReply ||
      draft.replyText ||
      draft.receivedReply ||
      prospect?.incomingReply ||
      prospect?.replyText ||
      getDemoReply(draft)
    : "";

  const intent = classifyReply(incomingReply);

  useEffect(() => {
    if (!draft || typeof updateReplyIntent !== "function") return;

    const label = intent.charAt(0).toUpperCase() + intent.slice(1);

    if (
      String(draft.intent || "").toLowerCase() !== intent ||
      draft.replyReceived !== true
    ) {
      updateReplyIntent(draft.id, label);
    }
  }, [draft?.id, draft?.intent, draft?.replyReceived, intent, updateReplyIntent]);

  const firstName = (draft?.person || "there").trim().split(/\s+/)[0];
  const company = draft?.company || prospect?.company || "your team";
  const email = prospect?.email || draft?.email || "example@example.com";
  const savedBookingUrl = bookingUrl?.trim() || "[Booking URL not configured]";

  const options = responseTemplates[intent] || responseTemplates.neutral;
  const responseDraft = options[responseVersion % options.length];

  const responseBody = responseDraft.body(
    firstName,
    company,
    savedBookingUrl,
    founder
  );

  const responseAlreadySent = Boolean(sentResponses[selectedId]);

  const selectConversation = item => {
    const id = getKey(item);

    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setCopied(false);
    setResponseVersion(0);
  };

  const copyText = async text => {
    setCopied(false);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      alert("Please select and copy the email manually.");
    }
  };

  const sendResponseDemo = () => {
    if (intent === "positive" && !bookingUrl?.trim()) {
      alert("Please configure the booking URL in Booking Setup first.");
      return;
    }

    updateOutreach(draft.id, {
      responseIntent: intent,
      responseSubject: responseDraft.subject,
      responseBody,
      responseSentDemo: true
    });

    if (intent === "positive") {
      markBookingLinkSentDemo(draft.id);
    }

    setSentResponses(current => ({
      ...current,
      [selectedId]: true
    }));
  };

  if (!draft) {
    return (
      <div>
        <PageHeader
          eyebrow="SALES ENGAGEMENT"
          title="Outreach"
          description="Manage prospect conversations and personalized email responses."
        />
        <section className="panel">
          <p>No email drafts are available yet. Create drafts from Prospects first.</p>
        </section>
      </div>
    );
  }

  const intentLabel = intent.charAt(0).toUpperCase() + intent.slice(1);
  const IntentIcon = intent === "positive"
    ? CalendarDays
    : intent === "neutral"
      ? MessageCircle
      : Ban;

  const intentTone = intent === "positive"
    ? "green"
    : intent === "neutral"
      ? "orange"
      : "red";

  return (
    <div>
      <PageHeader
        eyebrow="SALES ENGAGEMENT"
        title="Outreach"
        description="Manage prospect emails, understand replies, and move promising conversations toward meetings."
      />

      <div className="outreach-layout">
        <section className="panel draft-list-panel">
          <div className="panel-heading">
            <div>
              <h2>Prospect conversations</h2>
              <p>{outreach.length} conversations</p>
            </div>
            <Inbox size={19} className="muted-icon" />
          </div>

          {outreach.map(item => {
            const isSelected = selectedId === getKey(item);

            return (
              <button
                type="button"
                className={`draft-list-item ${isSelected ? "draft-selected" : ""}`}
                key={item.id}
                aria-pressed={isSelected}
                onClick={() => selectConversation(item)}
              >
                <div className="draft-list-icon">
                  <Mail size={17} />
                </div>
                <div className="draft-list-copy">
                  <strong>{item.company}</strong>
                  <span>{item.person}</span>
                  <small>{item.status || "Outreach in progress"}</small>
                </div>
                <Pill
                  tone={
                    isSelected
                      ? "green"
                      : item.status?.toLowerCase().includes("approved")
                        ? "green"
                        : "orange"
                  }
                >
                  {isSelected ? "Open" : "View"}
                </Pill>
              </button>
            );
          })}
        </section>

        <section className="panel email-editor">
          <div className="email-editor-header">
            <div>
              <div className="eyebrow">PROSPECT CONVERSATION</div>
              <h2>{draft.company}</h2>
              <p>{draft.person}</p>
            </div>
            <Pill tone={intentTone}>Reply: {intentLabel}</Pill>
          </div>

          <div className="email-meta">
            <span>Contact</span>
            <strong>{draft.person} &lt;{email}&gt;</strong>
          </div>

          <div className="panel" style={{ marginTop: "18px", padding: "18px" }}>
            <div className="email-editor-header">
              <div>
                <div className="eyebrow">ORIGINAL OUTREACH</div>
                <h3>Initial email</h3>
              </div>
              <Mail size={18} />
            </div>

            <div className="email-meta">
              <span>Subject</span>
              <strong>{draft.subject}</strong>
            </div>

            <label className="field-label">Message</label>
            <textarea
              className="input email-body"
              value={draft.body || ""}
              onChange={event => updateOutreach(draft.id, { body: event.target.value })}
              rows={6}
            />

            <div className="email-editor-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => copyText(`Subject: ${draft.subject}\n\n${draft.body || ""}`)}
              >
                <Clipboard size={15} />
                Copy email
              </button>

              <button
                type="button"
                className="button button-primary"
                onClick={() => updateOutreach(draft.id, { status: "Approved (demo)" })}
              >
                <CheckCircle2 size={16} />
                Approve initial email
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={() => alert("Email sending will be connected during backend integration.")}
              >
                <Send size={15} />
                Send initial email
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  const status = String(draft.status || "").toLowerCase();

                  if (!status.includes("approved") && !status.includes("queued")) {
                    alert("Approve the initial email before queuing it.");
                    return;
                  }

                  handoffOutreach(draft.id);
                }}
              >
                Queue for Apollo
              </button>
            </div>
          </div>

          <div className="panel" style={{ marginTop: "18px", padding: "18px" }}>
            <div className="email-editor-header">
              <div>
                <div className="eyebrow">INCOMING EMAIL</div>
                <h3>
                  <Inbox size={18} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                  Prospect's reply
                </h3>
              </div>
              <Pill tone="green">Reply received</Pill>
            </div>

            <div className="email-meta">
              <span>From</span>
              <strong>{draft.person} &lt;{email}&gt;</strong>
            </div>
            <div className="email-meta">
              <span>Subject</span>
              <strong>Re: {draft.subject}</strong>
            </div>

            <div
              className="input"
              style={{
                whiteSpace: "pre-wrap",
                minHeight: "100px",
                padding: "16px",
                lineHeight: 1.7
              }}
            >
              {incomingReply}
            </div>

            <div className="draft-context" style={{ marginTop: "14px" }}>
              <BrainCircuit size={17} />
              <span>
                <strong>AI reply analysis:</strong> This demo classifies the
                selected prospect's reply as {intentLabel.toLowerCase()} and
                prepares a matching response.
              </span>
            </div>
          </div>

          <div className="panel" style={{ marginTop: "18px", padding: "18px" }}>
            <div className="email-editor-header">
              <div>
                <div className="eyebrow">AI-GENERATED RESPONSE</div>
                <h3>
                  <IntentIcon size={19} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                  {intent === "positive"
                    ? "Meeting-booking email"
                    : intent === "neutral"
                      ? "Personalized reply"
                      : "Closing response"}
                </h3>
              </div>
              <Pill tone={intentTone}>{intentLabel} reply</Pill>
            </div>

            <p>
              {intent === "positive"
                ? "The prospect is interested. This response invites them to book a meeting."
                : intent === "neutral"
                  ? "This response addresses the prospect's message and helps move the conversation forward."
                  : "This response closes the conversation politely and prevents unnecessary follow-ups."}
            </p>

            <div className="email-meta">
              <span>To</span>
              <strong>{draft.person} &lt;{email}&gt;</strong>
            </div>
            <div className="email-meta">
              <span>Subject</span>
              <strong>{responseDraft.subject}</strong>
            </div>

            <label className="field-label">Email preview</label>
            <textarea
              className="input email-body"
              value={responseBody}
              readOnly
              rows={9}
            />

            {intent === "positive" && bookingUrl?.trim() && (
              <div className="draft-context" style={{ alignItems: "center", marginTop: "14px" }}>
                <CalendarDays size={17} />
                <span>
                  <strong>Meeting booking:</strong>{" "}
                  <a href={bookingUrl} target="_blank" rel="noreferrer">
                    {bookingUrl}
                  </a>
                </span>
                <ExternalLink size={14} />
              </div>
            )}

            {intent === "negative" && (
              <div className="draft-context" style={{ marginTop: "14px" }}>
                <Ban size={17} />
                <span>Further follow-ups should stop for this prospect.</span>
              </div>
            )}

            <div className="email-editor-actions" style={{ marginTop: "18px" }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  copyText(`To: ${email}\nSubject: ${responseDraft.subject}\n\n${responseBody}`)
                }
              >
                <Clipboard size={15} />
                {copied ? "Copied email" : "Copy response"}
              </button>

              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setCopied(false);
                  setResponseVersion(current => current + 1);
                }}
              >
                <RefreshCw size={15} />
                Regenerate
              </button>

              <button
                type="button"
                className="button button-primary"
                disabled={responseAlreadySent}
                onClick={sendResponseDemo}
              >
                <Send size={15} />
                {responseAlreadySent ? "Response recorded" : "Send response"}
              </button>
            </div>

            {responseAlreadySent && (
              <div className="draft-context" style={{ marginTop: "14px" }}>
                <CheckCircle2 size={17} />
                <span>
                  Response action recorded for this conversation. The prototype
                  does not deliver a real email.
                </span>
              </div>
            )}
          </div>

          <p className="outreach-action-note" style={{ marginTop: "16px" }}>
            <Clock3 size={13} />
            Prototype workflow · Incoming replies, classification, and sending
            are simulated. The future product will connect these steps to
            authorized email and AI services.
          </p>
        </section>
      </div>
    </div>
  );
}
