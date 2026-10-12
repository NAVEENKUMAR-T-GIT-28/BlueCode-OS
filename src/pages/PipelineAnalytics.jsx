
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Mail,
  MessageCircle,
  Search,
  Settings2,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";

import { prospects as mockProspects } from "../data/mockData";

const STAGES = [
  "Target",
  "Ready to Contact",
  "Contacted",
  "Interested",
  "Meeting Requested",
  "Meeting Booked",
];

const STAGE_STYLES = {
  Target: "bg-slate-100 text-slate-600",
  "Ready to Contact": "bg-sky-50 text-sky-700",
  Contacted: "bg-blue-50 text-blue-700",
  Interested: "bg-emerald-50 text-emerald-700",
  "Meeting Requested": "bg-violet-50 text-violet-700",
  "Meeting Booked": "bg-green-50 text-green-700",
};

const INTENT_STYLES = {
  Positive: "bg-emerald-50 text-emerald-700",
  Neutral: "bg-amber-50 text-amber-700",
  Negative: "bg-rose-50 text-rose-700",
};

const buttonPrimary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

const buttonSecondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/50";

const inputClass =
  "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

function getValue(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== ""
  );
}

function displayText(value, fallback = "") {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => displayText(item))
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return displayText(
      value.name ??
        value.fullName ??
        value.companyName ??
        value.title ??
        value.email,
      fallback
    );
  }

  return fallback;
}

function getPerson(item) {
  const person =
    item.decisionMaker ??
    item.contact ??
    item.contactPerson ??
    item.contactName ??
    item.fullName ??
    item.personName;

  if (typeof person === "string") {
    return { name: person, title: "", email: "" };
  }

  if (person && typeof person === "object") {
    return {
      name: displayText(
        person.name ?? person.fullName ?? person.full_name,
        "Contact not added"
      ),
      title: displayText(
        person.title ?? person.jobTitle ?? person.position
      ),
      email: displayText(person.email ?? person.workEmail),
    };
  }

  return {
    name: "Contact not added",
    title: "",
    email: "",
  };
}

function inferStage(status) {
  const text = displayText(status).toLowerCase();

  if (text.includes("booked") || text.includes("scheduled")) {
    return "Meeting Booked";
  }

  if (text.includes("meeting requested")) {
    return "Meeting Requested";
  }

  if (text.includes("interested") || text.includes("positive")) {
    return "Interested";
  }

  if (text.includes("ready")) {
    return "Ready to Contact";
  }

  if (
    text.includes("contacted") ||
    text.includes("email sent") ||
    text === "sent" ||
    text.includes("reached out")
  ) {
    return "Contacted";
  }

  return "Target";
}

function normalizeProspect(item, index) {
  const person = getPerson(item);

  const rawStage = getValue(
    item.pipelineStage,
    item.stage,
    item.status
  );

  const rawIntent = displayText(
    getValue(item.replyIntent, item.intent, item.sentiment)
  ).toLowerCase();

  let replyIntent = "—";

  if (
    rawIntent.includes("positive") ||
    rawIntent.includes("interested") ||
    rawIntent.includes("favorable")
  ) {
    replyIntent = "Positive";
  } else if (
    rawIntent.includes("negative") ||
    rawIntent.includes("not interested")
  ) {
    replyIntent = "Negative";
  } else if (
    rawIntent.includes("neutral") ||
    rawIntent.includes("maybe")
  ) {
    replyIntent = "Neutral";
  }

  const matchingStage = STAGES.find(
    (stage) =>
      stage.toLowerCase() === displayText(rawStage).toLowerCase()
  );

  return {
    id: displayText(
      getValue(item._id, item.id, item.prospectId),
      `prospect-${index}`
    ),
    name: displayText(
      getValue(
        item.companyName,
        item.company,
        item.organization,
        item.company_name,
        item.name
      ),
      `Prospect ${index + 1}`
    ),
    contact: person.name,
    title: person.title,
    email: displayText(
      getValue(item.email, item.emailAddress, item.workEmail),
      person.email
    ),
    industry: displayText(
      getValue(item.industry, item.category),
      "Industry not specified"
    ),
    replyIntent,
    stage: matchingStage || inferStage(rawStage),
  };
}

function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <div className="flex items-center gap-2">
          <Icon size={19} className="text-blue-600" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
        </div>

        <p className="mt-1 text-sm leading-5 text-slate-500">
          {description}
        </p>
      </div>

      {action}
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-600",
    cyan: "bg-cyan-50 text-cyan-700",
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="bc-metric group rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${accents[accent]}`}>
          <Icon size={21} />
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
      <div className="mb-3 rounded-2xl bg-blue-50 p-3 text-blue-600">
        <Inbox size={24} />
      </div>

      <p className="font-semibold text-slate-800">{title}</p>

      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function PipelineAnalytics() {
  const [stageOverrides, setStageOverrides] = useState({});
  const [stageFilter, setStageFilter] = useState("All");
  const [replyFilter, setReplyFilter] = useState("All");
  const [search, setSearch] = useState("");

  const [bookingUrl, setBookingUrl] = useState("");
  const [savedBookingUrl, setSavedBookingUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(null);

  const prospects = useMemo(() => {
    const items = Array.isArray(mockProspects)
      ? mockProspects
      : [];

    return items.map((item, index) => {
      const prospect = normalizeProspect(item, index);

      return {
        ...prospect,
        stage:
          stageOverrides[prospect.id] ?? prospect.stage,
      };
    });
  }, [stageOverrides]);

  const metrics = useMemo(() => {
    const count = (stage) =>
      prospects.filter(
        (prospect) => prospect.stage === stage
      ).length;

    const contacted = prospects.filter((prospect) =>
      [
        "Contacted",
        "Interested",
        "Meeting Requested",
        "Meeting Booked",
      ].includes(prospect.stage)
    ).length;

    return {
      targets: prospects.length,
      contacted,
      interested: count("Interested"),
      booked: count("Meeting Booked"),
    };
  }, [prospects]);

  const filteredProspects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return prospects.filter((prospect) => {
      const searchable = [
        prospect.name,
        prospect.contact,
        prospect.title,
        prospect.email,
        prospect.industry,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (stageFilter === "All" ||
          prospect.stage === stageFilter)
      );
    });
  }, [prospects, search, stageFilter]);

  const replyProspects = useMemo(
    () =>
      prospects.filter(
        (prospect) =>
          prospect.replyIntent !== "—" &&
          (replyFilter === "All" ||
            prospect.replyIntent === replyFilter)
      ),
    [prospects, replyFilter]
  );

  function updateStage(id, nextStage) {
    setStageOverrides((previous) => ({
      ...previous,
      [id]: nextStage,
    }));

    setNotice(`Stage updated to "${nextStage}".`);
  }

  function saveBookingUrl(event) {
    event.preventDefault();

    try {
      const parsed = new URL(bookingUrl.trim());

      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        !parsed.hostname.includes(".")
      ) {
        throw new Error("Invalid URL");
      }

      setSavedBookingUrl(parsed.href);
      setBookingUrl(parsed.href);
      setShowSettings(false);

      setNotice(
        "Booking link saved for this session. Backend storage is not connected yet."
      );
    } catch {
      setNotice(
        "Enter a valid booking link beginning with https://"
      );
    }
  }

  function prepareMeeting(prospect) {
    if (!savedBookingUrl) {
      setShowSettings(true);
      setNotice(
        "Add and save your personal booking link first."
      );
      return;
    }

    updateStage(prospect.id, "Meeting Requested");

    const openedWindow = window.open(
      savedBookingUrl,
      "_blank",
      "noopener,noreferrer"
    );

    if (!openedWindow) {
      setNotice(
        "Your booking page may have been blocked. Allow pop-ups or open your saved booking link from settings."
      );
      return;
    }

    setNotice(
      `Booking page opened for ${prospect.name}. The meeting is not confirmed until the prospect actually books.`
    );
  }

  function confirmMeeting(prospect) {
    updateStage(prospect.id, "Meeting Booked");
    setConfirming(null);

    setNotice(
      "Meeting marked as booked manually. Automatic booking verification is not connected."
    );
  }

  return (
    <main className="bc-page bc-fade-in space-y-7">
      {/* Page header */}
      <header className="bc-page-header flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <Sparkles size={14} />
            AI SALES COPILOT
          </div>

          <h1 className="bc-page-title">
            Pipeline &amp; Analytics
          </h1>

          <p className="bc-page-description max-w-2xl leading-6">
            Track your outreach emails, understand prospect
            replies, and turn interested companies into meetings.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowSettings((previous) => !previous)
          }
          className={buttonSecondary}
        >
          <Settings2 size={16} />
          Booking settings
        </button>
      </header>

      {/* Notifications */}
      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <p>{notice}</p>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
            className="rounded-md p-0.5 hover:bg-blue-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Personal booking settings */}
      {showSettings && (
        <section className="bc-card rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Your meeting booking link
              </h2>

              <p className="mt-1 text-sm leading-5 text-slate-500">
                Add your own Calendly or another booking page.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close booking settings"
              onClick={() => setShowSettings(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          <form
            onSubmit={saveBookingUrl}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="url"
              value={bookingUrl}
              onChange={(event) =>
                setBookingUrl(event.target.value)
              }
              placeholder="https://calendly.com/your-name/meeting"
              aria-label="Your booking URL"
              className={inputClass}
              required
            />

            <button type="submit" className={buttonPrimary}>
              Save link
            </button>
          </form>

          {savedBookingUrl && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="break-all text-xs text-emerald-700">
                Your booking link is set for this session.
              </p>

              <button
                type="button"
                onClick={() =>
                  window.open(
                    savedBookingUrl,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Test booking link
              </button>
            </div>
          )}

          <p className="mt-3 text-xs leading-5 text-slate-500">
            This frontend demo does not save your link to your
            account yet. Backend persistence will be needed.
          </p>
        </section>
      )}

      {/* Overview */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Target companies"
          value={metrics.targets}
          description="Companies in your current dataset"
          icon={Target}
          accent="blue"
        />

        <MetricCard
          title="Contacted"
          value={metrics.contacted}
          description="Companies contacted or further along"
          icon={Users}
          accent="cyan"
        />

        <MetricCard
          title="Interested"
          value={metrics.interested}
          description="Prospects showing sales interest"
          icon={MessageCircle}
          accent="violet"
        />

        <MetricCard
          title="Meetings booked"
          value={metrics.booked}
          description="Meetings currently marked as booked"
          icon={CalendarCheck}
          accent="green"
        />
      </section>

      {/* Sales pipeline */}
      <section className="bc-card rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
        <SectionHeading
          icon={Target}
          title="Sales pipeline"
          description="Select a stage to view the companies in that stage."
          action={
            stageFilter !== "All" ? (
              <button
                type="button"
                onClick={() => setStageFilter("All")}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Clear filter
              </button>
            ) : null
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((stage) => {
            const count = prospects.filter(
              (prospect) => prospect.stage === stage
            ).length;

            const selected = stageFilter === stage;

            return (
              <button
                type="button"
                key={stage}
                aria-pressed={selected}
                onClick={() =>
                  setStageFilter(selected ? "All" : stage)
                }
                className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${
                  selected
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-500/10"
                    : "border-slate-200 bg-white hover:border-blue-200"
                }`}
              >
                <span className="block text-2xl font-semibold text-slate-900">
                  {count}
                </span>

                <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">
                  {stage}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Target companies */}
      <section className="bc-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <SectionHeading
            icon={Users}
            title="Target companies"
            description="Find prospects, track outreach, and prepare meetings."
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search company, contact or email..."
                aria-label="Search target companies"
                className={`${inputClass} pl-10`}
              />
            </div>

            <label className="relative">
              <span className="sr-only">
                Filter by pipeline stage
              </span>

              <select
                value={stageFilter}
                onChange={(event) =>
                  setStageFilter(event.target.value)
                }
                className={`${inputClass} appearance-none pr-9`}
              >
                <option value="All">All stages</option>

                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </label>
          </div>
        </div>

        {filteredProspects.length === 0 ? (
          <EmptyState
            title="No matching companies"
            description="Try another search term or clear the stage filter."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProspects.map((prospect) => (
              <article
                key={prospect.id}
                className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/70 sm:p-6 xl:flex-row xl:items-center xl:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                    <Target size={20} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-slate-900">
                      {prospect.name}
                    </h3>

                    <p className="mt-1 break-words text-sm text-slate-600">
                      {prospect.contact}
                      {prospect.title
                        ? ` · ${prospect.title}`
                        : ""}
                    </p>

                    <p className="mt-1 break-all text-xs text-slate-500">
                      {prospect.email || prospect.industry}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Badge className="bg-blue-50 text-blue-700">
                        Target company
                      </Badge>

                      {prospect.replyIntent !== "—" && (
                        <Badge
                          className={
                            INTENT_STYLES[prospect.replyIntent]
                          }
                        >
                          {prospect.replyIntent} reply
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="relative min-w-0 sm:w-48">
                    <span className="sr-only">
                      Stage for {prospect.name}
                    </span>

                    <select
                      value={prospect.stage}
                      onChange={(event) =>
                        updateStage(
                          prospect.id,
                          event.target.value
                        )
                      }
                      className={`min-h-10 w-full appearance-none rounded-xl border border-slate-200 py-2 pl-3 pr-9 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 ${
                        STAGE_STYLES[prospect.stage] ||
                        "bg-white text-slate-700"
                      }`}
                    >
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                    />
                  </label>

                  {prospect.stage === "Meeting Booked" ? (
                    <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
                      <CalendarCheck size={16} />
                      Meeting booked
                    </div>
                  ) : prospect.stage === "Meeting Requested" ? (
                    <button
                      type="button"
                      onClick={() => setConfirming(prospect)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={16} />
                      Confirm booking
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => prepareMeeting(prospect)}
                      className={buttonPrimary}
                    >
                      <CalendarDays size={16} />
                      Open booking page
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex flex-col justify-between gap-1 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center">
          <span>
            Showing {filteredProspects.length} of {prospects.length} companies
          </span>

          <span>
            Stage changes are temporary until backend storage is connected.
          </span>
        </div>
      </section>

      {/* Replies to outreach emails */}
      <section className="bc-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <SectionHeading
            icon={MessageCircle}
            title="Email reply insights"
            description="Understand replies to the outreach emails sent to your prospects."
            action={
              <Badge className="bg-blue-50 text-blue-700">
                {replyProspects.length} classified
              </Badge>
            }
          />

          <div className="flex flex-wrap gap-2">
            {["All", "Positive", "Neutral", "Negative"].map(
              (filter) => (
                <button
                  type="button"
                  key={filter}
                  aria-pressed={replyFilter === filter}
                  onClick={() => setReplyFilter(filter)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    replyFilter === filter
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"
                  }`}
                >
                  {filter}
                </button>
              )
            )}
          </div>
        </div>

        {replyProspects.length === 0 ? (
          <EmptyState
            title="No classified replies yet"
            description="Replies will appear here once email synchronization and AI classification are connected."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {replyProspects.map((prospect) => (
              <div
                key={prospect.id}
                className="flex flex-col justify-between gap-3 p-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:p-6"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                    <Mail size={18} />
                  </div>

                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">
                      {prospect.name}
                    </p>

                    <p className="mt-1 break-words text-sm text-slate-500">
                      {prospect.contact}
                      {prospect.email
                        ? ` · ${prospect.email}`
                        : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge
                        className={
                          INTENT_STYLES[prospect.replyIntent]
                        }
                      >
                        {prospect.replyIntent} intent
                      </Badge>

                      <Badge
                        className={
                          STAGE_STYLES[prospect.stage] ||
                          "bg-slate-100 text-slate-600"
                        }
                      >
                        {prospect.stage}
                      </Badge>
                    </div>
                  </div>
                </div>

                {prospect.replyIntent === "Positive" &&
                  ![
                    "Meeting Requested",
                    "Meeting Booked",
                  ].includes(prospect.stage) && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStage(
                          prospect.id,
                          "Interested"
                        )
                      }
                      className={`${buttonSecondary} self-start text-emerald-700 sm:self-center`}
                    >
                      <Sparkles size={15} />
                      Mark interested
                    </button>
                  )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs leading-5 text-slate-500 sm:px-6">
          Only replies to outreach emails belong in this workflow.
          General inbox management and additional email sequences
          are outside this MVP.
        </div>
      </section>

      {/* Simple workflow status */}
      <section className="bc-card rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
        <SectionHeading
          icon={Settings2}
          title="Workflow status"
          description="The three things needed to complete your sales workflow."
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Mail size={19} />
            </div>

            <p className="text-sm font-semibold text-slate-800">
              Outreach email &amp; reply
            </p>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              Send an email and associate its reply with the correct
              prospect.
            </p>

            <p className="mt-3 text-xs font-semibold text-amber-700">
              Email backend required
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 inline-flex rounded-xl bg-violet-50 p-2.5 text-violet-600">
              <Sparkles size={19} />
            </div>

            <p className="text-sm font-semibold text-slate-800">
              AI reply analysis
            </p>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              Classify each reply as positive, neutral, or negative.
            </p>

            <p className="mt-3 text-xs font-semibold text-amber-700">
              AI integration required
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 inline-flex rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <CalendarCheck size={19} />
            </div>

            <p className="text-sm font-semibold text-slate-800">
              Meeting booking
            </p>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              Use your personal booking link and verify the meeting.
            </p>

            <p className="mt-3 text-xs font-semibold text-amber-700">
              Booking verification required
            </p>
          </div>
        </div>
      </section>

      {/* Confirm meeting dialog */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setConfirming(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-dialog-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <CalendarCheck size={22} />
              </div>

              <button
                type="button"
                aria-label="Close confirmation dialog"
                onClick={() => setConfirming(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <h2
              id="booking-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              Confirm meeting booking
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Have you verified that a meeting with{" "}
              <strong className="text-slate-900">
                {confirming.name}
              </strong>{" "}
              has actually been booked?
            </p>

            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Only confirm after the booking is real. Automatic
              verification is not connected yet.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className={`${buttonSecondary} flex-1`}
              >
                Not yet
              </button>

              <button
                type="button"
                onClick={() => confirmMeeting(confirming)}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <CheckCircle2 size={16} />
                Yes, confirmed
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
