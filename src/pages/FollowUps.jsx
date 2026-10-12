
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Inbox,
  Mail,
  MessageSquare,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { prospects } from "../data/mockData";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const TABS = [
  { id: "followup1", label: "Follow-up 1", icon: Send },
  { id: "followup2", label: "Follow-up 2", icon: RefreshCw },
  { id: "replies", label: "Replies", icon: Inbox },
];

const STATUS_STYLES = {
  "Due today": "bg-amber-50 text-amber-700 border-amber-200",
  Overdue: "bg-rose-50 text-rose-700 border-rose-200",
  Upcoming: "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Replied: "bg-violet-50 text-violet-700 border-violet-200",
};

function getCompany(prospect) {
  if (typeof prospect?.company === "string") return prospect.company;
  return (
    prospect?.company?.name ||
    prospect?.companyName ||
    prospect?.name ||
    "Unknown company"
  );
}

function getContact(prospect) {
  return (
    prospect?.decisionMaker?.name ||
    prospect?.contactName ||
    prospect?.name ||
    "Prospect"
  );
}

function getEmail(prospect) {
  return (
    prospect?.decisionMaker?.email ||
    prospect?.email ||
    prospect?.contactEmail ||
    ""
  );
}

function getTitle(prospect) {
  return (
    prospect?.decisionMaker?.title ||
    prospect?.contactTitle ||
    "Decision maker"
  );
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
}

function createMessage(prospect, step = 1) {
  const contact = getContact(prospect).split(" ")[0] || "there";
  const company = getCompany(prospect);
  const reason =
    prospect?.whyContact ||
    prospect?.reasonForContact ||
    `how we could support ${company}`;

  if (step === 2) {
    return {
      subject: `Checking in — ${company}`,
      body: `Hi ${contact},

I wanted to follow up once more on my previous email regarding ${reason}.

I understand you may have a busy schedule. If this is a priority for your team, I'd be happy to share more details or arrange a convenient time to connect.

Please let me know what works best for you.

Best regards,
Aslesha`,
    };
  }

  return {
    subject: `Exploring an opportunity with ${company}`,
    body: `Hi ${contact},

I came across ${company} and wanted to reach out regarding ${reason}.

I'd be happy to share a few ideas that may be relevant to your team and learn more about your current priorities.

Would you be available for a brief conversation sometime this week?

Best regards,
Aslesha`,
  };
}

function buildQueue(source) {
  return source
    .filter((prospect) => prospect?.id != null)
    .map((prospect, index) => {
      const step = index % 3 === 1 ? 2 : 1;

      return {
        id: String(prospect.id),
        prospect,
        step,
        status: index % 5 === 0
          ? "Overdue"
          : index % 5 === 1
            ? "Upcoming"
            : index % 5 === 2
              ? "Due today"
              : index % 5 === 3
                ? "Completed"
                : "Due today",
        message: createMessage(prospect, step),
      };
    });
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, detail, iconClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconClass}`}>
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

export default function FollowUps() {
  const [queue, setQueue] = useState(() => buildQueue(prospects));
  const [activeTab, setActiveTab] = useState("followup1");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState("");

  const filteredQueue = useMemo(() => {
    const query = search.trim().toLowerCase();

    return queue.filter((item) => {
      const company = getCompany(item.prospect).toLowerCase();
      const contact = getContact(item.prospect).toLowerCase();
      const email = getEmail(item.prospect).toLowerCase();

      const matchesSearch =
        !query ||
        company.includes(query) ||
        contact.includes(query) ||
        email.includes(query);

      if (!matchesSearch) return false;

      if (activeTab === "followup1") {
        return item.step === 1 && item.status !== "Completed";
      }

      if (activeTab === "followup2") {
        return item.step === 2 && item.status !== "Completed";
      }

      // Do not invent received messages. This tab shows only records
      // that have actually been populated with a reply by the backend.
      return Boolean(item.reply?.body || item.reply?.text);
    });
  }, [queue, search, activeTab]);

  const selectedItem = useMemo(() => {
    return (
      filteredQueue.find((item) => item.id === selectedId) ||
      filteredQueue[0] ||
      null
    );
  }, [filteredQueue, selectedId]);

  const counts = useMemo(
    () => ({
      followup1: queue.filter(
        (item) => item.step === 1 && item.status !== "Completed"
      ).length,
      followup2: queue.filter(
        (item) => item.step === 2 && item.status !== "Completed"
      ).length,
      replies: queue.filter(
        (item) => Boolean(item.reply?.body || item.reply?.text)
      ).length,
      overdue: queue.filter(
        (item) => item.status === "Overdue"
      ).length,
      completed: queue.filter(
        (item) => item.status === "Completed"
      ).length,
    }),
    [queue]
  );

  function updateStatus(id, status) {
    setQueue((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );

    setNotice(
      status === "Completed"
        ? "Marked as completed in this session."
        : "Follow-up status updated in this session."
    );
  }

  function updateMessage(field, value) {
    if (!selectedItem) return;

    setQueue((current) =>
      current.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              message: {
                ...item.message,
                [field]: value,
              },
            }
          : item
      )
    );
  }

  async function copyMessage() {
    if (!selectedItem) return;

    const content = `${selectedItem.message.subject}\n\n${selectedItem.message.body}`;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setNotice("Email subject and message copied.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice("Copy failed. Please select and copy the message manually.");
    }
  }

  async function sendFollowUp() {
    if (!selectedItem || sending) return;

    const email = getEmail(selectedItem.prospect);

    if (!email) {
      setNotice("This prospect has no email address. Add one before sending.");
      return;
    }

    setSending(true);
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/api/outreach/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prospectId: selectedItem.id,
          to: email,
          subject: selectedItem.message.subject,
          body: selectedItem.message.body,
          followUpNumber: selectedItem.step,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "The email service could not send this message."
        );
      }

      setNotice("Follow-up sent successfully.");
    } catch (error) {
      setNotice(
        error.message ||
          "Sending is not connected yet. Configure the backend email service."
      );
    } finally {
      setSending(false);
    }
  }

  async function sendReply() {
    if (!selectedItem || !replyText.trim() || sending) return;

    const email = getEmail(selectedItem.prospect);

    if (!email) {
      setNotice("This prospect has no email address. Add one before replying.");
      return;
    }

    setSending(true);
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/api/outreach/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prospectId: selectedItem.id,
          to: email,
          body: replyText.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "The reply service could not send this message."
        );
      }

      setReplyText("");
      setNotice("Reply sent successfully.");
    } catch (error) {
      setNotice(
        error.message ||
          "Reply sending is not connected. Configure the backend email service."
      );
    } finally {
      setSending(false);
    }
  }

  const isRepliesTab = activeTab === "replies";

  return (
    <main className="bc-page min-h-screen space-y-6 bg-white pb-10 text-slate-900">
      {/* Page heading */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
            <Sparkles size={16} />
            Sales engagement
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Follow-up Assistant
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Organize your follow-ups, prepare personalized messages, and
            manage prospect conversations in one place.
          </p>
        </div>

        <Link
          to="/prospects"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View prospects
          <ArrowUpRight size={16} />
        </Link>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Send}
          label="Follow-up 1"
          value={counts.followup1}
          detail="First-touch queue"
          iconClass="bg-blue-50 text-blue-600"
        />

        <MetricCard
          icon={RefreshCw}
          label="Follow-up 2"
          value={counts.followup2}
          detail="Second-touch queue"
          iconClass="bg-amber-50 text-amber-600"
        />

        <MetricCard
          icon={Inbox}
          label="Replies"
          value={counts.replies}
          detail="Replies available in records"
          iconClass="bg-violet-50 text-violet-600"
        />

        <MetricCard
          icon={BellRing}
          label="Overdue"
          value={counts.overdue}
          detail="Need attention"
          iconClass="bg-rose-50 text-rose-600"
        />
      </section>

      {/* Main workspace */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Tabs and search */}
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                const count =
                  id === "followup1"
                    ? counts.followup1
                    : id === "followup2"
                      ? counts.followup2
                      : counts.replies;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveTab(id);
                      setSelectedId(null);
                      setNotice("");
                    }}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full xl:max-w-xs">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search prospects..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>
        </div>

        <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Left: prospect list */}
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {isRepliesTab
                    ? "Conversations"
                    : activeTab === "followup1"
                      ? "First follow-ups"
                      : "Second follow-ups"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredQueue.length} prospect
                  {filteredQueue.length === 1 ? "" : "s"}
                </p>
              </div>

              <MessageSquareText size={18} className="text-slate-400" />
            </div>

            <div className="max-h-[620px] overflow-y-auto">
              {filteredQueue.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    {isRepliesTab ? (
                      <Inbox size={22} />
                    ) : (
                      <CheckCircle2 size={22} />
                    )}
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-slate-800">
                    {isRepliesTab
                      ? "No replies available"
                      : "No prospects found"}
                  </h3>

                  <p className="mx-auto mt-2 max-w-[230px] text-xs leading-5 text-slate-500">
                    {isRepliesTab
                      ? "Replies will appear here when your backend receives and stores incoming email messages."
                      : "Try another search or check your prospect list."}
                  </p>
                </div>
              ) : (
                filteredQueue.map((item) => {
                  const active = selectedItem?.id === item.id;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setNotice("");
                      }}
                      className={`block w-full border-b border-slate-100 p-4 text-left transition ${
                        active
                          ? "bg-blue-50/70"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                            active
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {getInitials(getContact(item.prospect))}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {getContact(item.prospect)}
                            </p>
                            {active && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                            )}
                          </div>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {getCompany(item.prospect)}
                          </p>

                          <p className="mt-2 truncate text-xs text-slate-600">
                            {isRepliesTab
                              ? item.reply?.body || item.reply?.text
                              : item.message.subject}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {isRepliesTab ? (
                              <StatusBadge status="Replied" />
                            ) : (
                              <StatusBadge status={item.status} />
                            )}

                            {!isRepliesTab && (
                              <span className="text-xs text-slate-400">
                                Step {item.step}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right: message editor or reply conversation */}
          <section className="min-w-0">
            {!selectedItem ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <MessageSquare size={25} />
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {isRepliesTab
                    ? "Your conversations"
                    : "Prepare your next follow-up"}
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  {isRepliesTab
                    ? "Select a conversation to review a reply and respond."
                    : "Select a prospect from the list to personalize the email before sending."}
                </p>
              </div>
            ) : isRepliesTab ? (
              <div className="flex min-h-[560px] flex-col">
                <div className="flex items-center gap-3 border-b border-slate-100 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                    <UserRound size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-slate-900">
                      {getContact(selectedItem.prospect)}
                    </h2>
                    <p className="truncate text-sm text-slate-500">
                      {getCompany(selectedItem.prospect)}
                    </p>
                  </div>

                  {getEmail(selectedItem.prospect) && (
                    <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
                      <Mail size={14} />
                      {getEmail(selectedItem.prospect)}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-5 bg-slate-50/70 p-5">
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                    <ArrowDownLeft size={14} />
                    Incoming message
                  </div>

                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-4 shadow-sm sm:max-w-[80%]">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        {getContact(selectedItem.prospect)}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {selectedItem.reply?.body ||
                          selectedItem.reply?.text ||
                          ""}
                      </p>
                    </div>
                  </div>

                  {selectedItem.reply?.receivedAt && (
                    <p className="text-center text-xs text-slate-400">
                      Received{" "}
                      {new Date(
                        selectedItem.reply.receivedAt
                      ).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                  <label
                    htmlFor="reply-message"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Write a reply
                  </label>

                  <textarea
                    id="reply-message"
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    rows={4}
                    placeholder="Write a thoughtful response..."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />

                  <div className="mt-3 flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-xs text-slate-400">
                      Check your message before sending.
                    </p>

                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={sending || !replyText.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={16} />
                      {sending ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Selected prospect */}
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                      {getInitials(getContact(selectedItem.prospect))}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-900">
                        {getContact(selectedItem.prospect)}
                      </h2>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {getTitle(selectedItem.prospect)} ·{" "}
                        {getCompany(selectedItem.prospect)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedItem.status} />

                    <Link
                      to={`/prospects/${selectedItem.prospect.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      View prospect
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Email editor */}
                <div className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                      <Sparkles size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {activeTab === "followup1"
                          ? "First follow-up message"
                          : "Second follow-up message"}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Review and personalize this draft before sending.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="followup-to"
                      className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      To
                    </label>
                    <input
                      id="followup-to"
                      readOnly
                      value={getEmail(selectedItem.prospect)}
                      placeholder="No email address available"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600 outline-none placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="followup-subject"
                      className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Subject
                    </label>
                    <input
                      id="followup-subject"
                      value={selectedItem.message.subject}
                      onChange={(event) =>
                        updateMessage("subject", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="followup-body"
                      className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Message
                    </label>
                    <textarea
                      id="followup-body"
                      rows={12}
                      value={selectedItem.message.body}
                      onChange={(event) =>
                        updateMessage("body", event.target.value)
                      }
                      className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={copyMessage}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copied" : "Copy message"}
                    </button>

                    <button
                      type="button"
                      onClick={sendFollowUp}
                      disabled={sending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={16} />
                      {sending ? "Sending..." : "Send follow-up"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <Clock3
                        size={17}
                        className="mt-0.5 shrink-0 text-slate-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Follow-up status
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Statuses and queues currently use demo data. Connect
                          persistent backend records to track actual sends,
                          delivery, and scheduled follow-ups.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              selectedItem.id,
                              selectedItem.status === "Completed"
                                ? "Due today"
                                : "Completed"
                            )
                          }
                          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-800"
                        >
                          <CheckCircle2 size={15} />
                          {selectedItem.status === "Completed"
                            ? "Reopen follow-up"
                            : "Mark as completed"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      {/* Honest integration note */}
      <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <BellRing size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div>
          <h3 className="text-sm font-semibold text-amber-900">
            Email integration
          </h3>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            Sending uses the backend endpoints{" "}
            <code className="rounded bg-white/80 px-1 py-0.5">
              /api/outreach/send
            </code>{" "}
            and{" "}
            <code className="rounded bg-white/80 px-1 py-0.5">
              /api/outreach/reply
            </code>
            . Those endpoints must be implemented and connected to an email
            provider. Incoming replies also require inbox/webhook integration;
            they are not automatically detected by this frontend.
          </p>
        </div>
      </section>

      {/* Feedback */}
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-lg"
        >
          <MessageSquareText
            size={18}
            className="mt-0.5 shrink-0 text-blue-600"
          />
          <p className="flex-1 leading-5">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
