import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";

import { prospects } from "../data/mockData";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const valueOf = (...values) =>
  values.find((value) => typeof value === "string" && value.trim())?.trim() || "";

const companyName = (p) =>
  valueOf(p?.companyName, p?.company, p?.organization, p?.company?.name) ||
  "your company";

const contactName = (p) =>
  valueOf(
    p?.decisionMakerName,
    typeof p?.decisionMaker === "string" ? p.decisionMaker : p?.decisionMaker?.name,
    p?.contactName,
    p?.fullName,
    p?.name
  ) || "there";

const industryOf = (p) => valueOf(p?.industry) || "your industry";

const contextOf = (p) =>
  valueOf(p?.whyContact, p?.whyNow, p?.signal, p?.description);

const emailOf = (p) =>
  valueOf(
    p?.email,
    p?.contactEmail,
    p?.decisionMakerEmail,
    p?.decisionMaker?.email,
    p?.contact?.email,
    p?.person?.email
  );

const prospectId = (p, index) =>
  String(p?._id ?? p?.id ?? p?.companyId ?? `${companyName(p)}-${index}`);

function createEmail(prospect, settings) {
  const company = companyName(prospect);
  const firstName = contactName(prospect).split(" ")[0];
  const context = contextOf(prospect);

  const opening =
    settings.tone === "Friendly"
      ? `Hope you're having a great week, ${firstName}.`
      : settings.tone === "Direct"
        ? `I'm reaching out with an idea for ${company}.`
        : `Hi ${firstName},`;

  const personalization = context
    ? `I came across ${company} and noticed ${context.replace(/[.!?]+$/, "")}.`
    : `I came across ${company} and wanted to connect about opportunities relevant to your work in ${industryOf(prospect)}.`;

  const objective =
    settings.goal === "Share a solution"
      ? "Would you be open to seeing a few practical ideas tailored to your team's needs?"
      : settings.goal === "Start a conversation"
        ? "Would you be open to a quick conversation to see whether there could be a fit?"
        : "Would you be available for a brief introductory meeting to explore whether this could be useful?";

  return {
    subject: `A quick idea for ${company}`,
    body: `${opening}

${personalization}

At ${settings.senderCompany || "AI Founder OS"}, we're focused on helping teams make their sales outreach more targeted and effective. I thought there might be an opportunity to explore how this could support ${company}.

${objective}

Best regards,
${settings.senderName || "Aslesha"}
${settings.senderCompany || "AI Founder OS"}`,
  };
}

export default function Outreach() {
  const list = useMemo(
    () => (Array.isArray(prospects) ? prospects : []),
    []
  );

  const [selectedId, setSelectedId] = useState(() =>
    list.length ? prospectId(list[0], 0) : ""
  );

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState("");
  const [senderName, setSenderName] = useState("Aslesha");
  const [senderCompany, setSenderCompany] = useState("AI Founder OS");
  const [tone, setTone] = useState("Professional");
  const [goal, setGoal] = useState("Book a meeting");

  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);

  const selectedIndex = list.findIndex(
    (p, index) => prospectId(p, index) === selectedId
  );

  const selectedProspect =
    selectedIndex >= 0 ? list[selectedIndex] : null;

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500";

  function generateEmail(prospect = selectedProspect) {
    if (!prospect) return;

    const generated = createEmail(prospect, {
      senderName,
      senderCompany,
      tone,
      goal,
    });

    setSubject(generated.subject);
    setBody(generated.body);
    setRecipient(emailOf(prospect));
    setCopied(false);
    setNotice(null);
  }

  useEffect(() => {
    if (selectedProspect) generateEmail(selectedProspect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(
        `To: ${recipient}\nSubject: ${subject}\n\n${body}`
      );
      setCopied(true);
      setNotice({ type: "success", text: "Email copied successfully." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({
        type: "error",
        text: "Unable to copy automatically. Please select and copy the email.",
      });
    }
  }

  async function sendEmail() {
    setNotice(null);

    if (!recipient.trim()) {
      setNotice({
        type: "error",
        text: "This prospect has no email address. Enter the correct address first.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())) {
      setNotice({
        type: "error",
        text: "Please enter a valid recipient email address.",
      });
      return;
    }

    if (!subject.trim() || !body.trim()) {
      setNotice({
        type: "error",
        text: "Please add both a subject and an email message.",
      });
      return;
    }

    if (!API_URL) {
      setNotice({
        type: "error",
        text: "Email sending is not configured. Connect your backend email provider first.",
      });
      return;
    }

    try {
      setSending(true);

      const response = await fetch(`${API_URL}/api/outreach/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: recipient.trim(),
          subject: subject.trim(),
          body: body.trim(),
          prospectId: selectedProspect?._id ?? selectedProspect?.id ?? null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "The email could not be sent.");
      }

      setNotice({
        type: "success",
        text: "Email sent successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to send the email. Check your email integration.",
      });
    } finally {
      setSending(false);
    }
  }

  if (!list.length) {
    return (
      <div className="bc-page bc-fade-in">
        <section className="bc-card p-8 md:p-10">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <Target className="text-blue-600" size={24} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            AI SALES COPILOT
          </p>
          <h1>Personalized Outreach</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Add prospects to your leads data to start creating personalized cold emails.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="bc-page bc-fade-in">
      {/* Header */}
      <header className="bc-page-header flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
            AI SALES COPILOT
          </p>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50">
              <Mail className="text-blue-600" size={23} />
            </div>

            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-slate-900">
                Personalized Outreach
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Turn prospect insights into a relevant first impression.
              </p>
            </div>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
          <Sparkles size={17} className="text-blue-600" />
          <span className="text-sm font-semibold text-slate-700">
            Cold email generator
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-5">
          {/* Prospect selection */}
          <section className="bc-card p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Target className="text-blue-600" size={19} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Select prospect
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Choose who you want to contact
                </p>
              </div>
            </div>

            <label className={labelClass}>Company / Contact</label>
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className={inputClass}
            >
              {list.map((prospect, index) => {
                const id = prospectId(prospect, index);
                return (
                  <option key={id} value={id}>
                    {companyName(prospect)} — {contactName(prospect)}
                  </option>
                );
              })}
            </select>

            {selectedProspect && (
              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white">
                    <Building2 size={17} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-800">
                      {companyName(selectedProspect)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <UserRound size={14} />
                      {contactName(selectedProspect)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {industryOf(selectedProspect)}
                    </p>
                  </div>
                </div>

                {contextOf(selectedProspect) && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className={labelClass}>Personalization context</p>
                    <p className="text-sm leading-6 text-slate-600">
                      {contextOf(selectedProspect)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Preferences */}
          <section className="bc-card p-5">
            <h3 className="mb-5 text-base font-semibold text-slate-900">
              Email preferences
            </h3>

            <div className="mb-4">
              <label className={labelClass}>Your name</label>
              <input
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
                placeholder="Aslesha"
                className={inputClass}
              />
            </div>

            <div className="mb-4">
              <label className={labelClass}>Company name</label>
              <input
                value={senderCompany}
                onChange={(event) => setSenderCompany(event.target.value)}
                placeholder="AI Founder OS"
                className={inputClass}
              />
            </div>

            <div className="mb-4">
              <label className={labelClass}>Email tone</label>
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className={inputClass}
              >
                <option>Professional</option>
                <option>Friendly</option>
                <option>Direct</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Email objective</label>
              <select
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className={inputClass}
              >
                <option>Book a meeting</option>
                <option>Share a solution</option>
                <option>Start a conversation</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => generateEmail()}
              className="bc-btn-secondary mt-5 w-full"
            >
              <RefreshCw size={15} />
              Regenerate email
            </button>
          </section>
        </aside>

        <main className="min-w-0 space-y-5">
          {/* Selected step */}
          <section className="bc-card relative overflow-hidden border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/70 p-5 md:p-6">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-100/40 blur-3xl" />

            <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-600 text-white shadow-md shadow-blue-600/15">
                  <span className="text-sm font-bold">01</span>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    STEP 01
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">
                    Cold email
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Make the first impression
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm">
                <span className="bc-status-dot bc-status-dot-blue" />
                Draft ready for review
              </span>
            </div>
          </section>

          {/* Editor */}
          <section className="bc-card p-5 md:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Compose email
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Personalize your message and review it before sending.
                </p>
              </div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-blue-50 sm:flex">
                <Mail className="text-blue-600" size={19} />
              </div>
            </div>

            <div className="mb-5">
              <label className={labelClass}>Recipient email</label>
              <input
                type="email"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="Prospect email from your leads"
                className={inputClass}
              />
              {!recipient && (
                <p className="mt-2 text-xs text-amber-700">
                  No email is available for this prospect. Enter the correct address before sending.
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className={labelClass}>Subject line</label>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Write a clear, relevant subject"
                className={inputClass}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className={`${labelClass} mb-0`}>Email body</label>
                <span className="text-xs text-slate-400">Editable draft</span>
              </div>

              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={15}
                placeholder="Your personalized cold email will appear here..."
                className={`${inputClass} resize-y leading-7`}
              />

              <div className="mt-2 text-right text-xs text-slate-400">
                {body.trim() ? body.trim().split(/\s+/).length : 0} words
              </div>
            </div>

            {/* Yellow review reminder */}
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <AlertTriangle size={18} className="text-amber-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Before sending
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    Verify the recipient, names, company details, and claims.
                    Review the entire message before sending it to a prospect.
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback */}
            {notice && (
              <div
                role="status"
                className={`mt-5 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                  notice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
              >
                {notice.type === "success" ? (
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                )}
                <span>{notice.text}</span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={copyEmail}
                className="bc-btn-secondary flex-1"
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? "Copied" : "Copy email"}
              </button>

              <button
                type="button"
                onClick={sendEmail}
                disabled={sending}
                className="bc-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={17} />
                {sending ? "Sending..." : "Send email"}
                {!sending && <ArrowRight size={16} />}
              </button>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Direct email sending requires a configured backend email provider.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}