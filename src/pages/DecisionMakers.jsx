
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { prospects } from "../data/mockData";
import { Card } from "../components/UI";

const priorityFromScore = (score = 0) => {
  if (score >= 90) return "Hot";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  return "Low";
};

const priorityStyles = {
  Hot: "border-red-500/30 bg-red-500/15 text-red-400",
  High: "border-orange-400/40 bg-orange-500/20 text-orange-200",
  Medium: "border-amber-400/40 bg-amber-500/20 text-amber-200",
  Low: "border-slate-500 bg-slate-700 text-slate-200",
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "DM";

function LinkedInMark({ size = 16 }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm bg-current/10 font-bold leading-none"
      style={{ width: size, height: size, fontSize: size * 0.7 }}
      aria-label="LinkedIn"
    >
      in
    </span>
  );
}

export default function DecisionMakers() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");
  const [role, setRole] = useState("All");
  const [view, setView] = useState("Grid");

  const contacts = useMemo(() => {
    return (prospects || [])
      .filter((prospect) => prospect.decisionMaker?.name)
      .map((prospect) => ({
        ...prospect,
        contact: prospect.decisionMaker,
        priority: priorityFromScore(prospect.score),
      }))
      .filter((item) => {
        const contact = item.contact;
        const query = search.trim().toLowerCase();

        const matchesSearch =
          !query ||
          [
            contact.name,
            contact.title,
            contact.email,
            item.company,
            item.industry,
            item.location,
          ].some((value) =>
            String(value || "").toLowerCase().includes(query)
          );

        const matchesPriority =
          priority === "All" || item.priority === priority;

        const title = String(contact.title || "").toLowerCase();

        const matchesRole =
          role === "All" ||
          (role === "Founder" &&
            (title.includes("founder") || title.includes("owner"))) ||
          (role === "Executive" &&
            (title.includes("ceo") ||
              title.includes("chief") ||
              title.includes("president") ||
              title.includes("director"))) ||
          (role === "Sales & Growth" &&
            (title.includes("sales") ||
              title.includes("revenue") ||
              title.includes("growth") ||
              title.includes("marketing")));

        return matchesSearch && matchesPriority && matchesRole;
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [search, priority, role]);

  const totalContacts = (prospects || []).filter(
    (prospect) => prospect.decisionMaker?.name
  ).length;

  const hotContacts = contacts.filter(
    (contact) => contact.priority === "Hot"
  ).length;

  const withEmail = contacts.filter(
    (contact) => contact.contact.email
  ).length;

  const withLinkedIn = contacts.filter(
    (contact) => contact.contact.linkedin
  ).length;

  const clearFilters = () => {
    setSearch("");
    setPriority("All");
    setRole("All");
  };

  return (
    <div className="space-y-7 pb-10 text-slate-100">
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm font-semibold text-black">
            <Users size={16} />
            <span>CONTACT INTELLIGENCE</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Decision Makers
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-black">
            Discover key decision-makers, understand who matters most, and find
            the right contacts for your next sales conversation.
          </p>
        </div>

        <Link
          to="/prospects"
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-400 hover:bg-slate-700 md:self-auto"
        >
          View companies
          <ArrowUpRight size={16} />
        </Link>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard
          icon={<Users size={19} />}
          label="Total contacts"
          value={totalContacts}
          note="Across your prospects"
          iconClass="bg-blue-500/20 text-blue-300"
        />

        <SummaryCard
          icon={<Sparkles size={19} />}
          label="Hot contacts"
          value={hotContacts}
          note="Scores of 90 and above"
          iconClass="bg-red-500/20 text-red-300"
        />

        <SummaryCard
          icon={<Mail size={19} />}
          label="Email available"
          value={withEmail}
          note="Contacts with an email"
          iconClass="bg-cyan-500/20 text-cyan-300"
        />

        <SummaryCard
          icon={<LinkedInMark size={19} />}
          label="LinkedIn profiles"
          value={withLinkedIn}
          note="Profiles available in data"
          iconClass="bg-violet-500/20 text-violet-300"
        />
      </div>

      {/* SEARCH AND FILTERS */}
      <Card variant="dark" className="p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, company, title, or email..."
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 pl-11 pr-10 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Filter size={17} className="text-cyan-300" />
              <span>Priority</span>

              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="min-w-28 rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option>All</option>
                <option>Hot</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              aria-label="Filter by role"
              className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
            >
              <option value="All">All roles</option>
              <option value="Founder">Founders &amp; owners</option>
              <option value="Executive">Executives</option>
              <option value="Sales & Growth">Sales &amp; growth</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-4">
            <p className="text-sm text-slate-200">
              Showing{" "}
              <span className="font-bold text-white">
                {contacts.length}
              </span>{" "}
              of {totalContacts} contacts
            </p>

            <div className="flex items-center gap-3">
              {(search || priority !== "All" || role !== "All") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Clear filters
                </button>
              )}

              <div className="flex rounded-lg border border-slate-600 bg-slate-950 p-1">
                {["Grid", "List"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setView(item)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                      view === item
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-200 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* CONTACT RESULTS */}
      {contacts.length === 0 ? (
        <Card variant="dark" className="p-6">
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-600 bg-slate-800 text-cyan-300">
              <Users size={25} />
            </div>

            <h3 className="text-lg font-bold text-white">
              No contacts found
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-200">
              Try another search or clear your filters to see more decision
              makers.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Clear filters
            </button>
          </div>
        </Card>
      ) : view === "Grid" ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {contacts.map((item) => (
            <ContactCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Card variant="dark" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-800">
                <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-200">
                  <th className="px-4 py-4 font-bold">Contact</th>
                  <th className="px-4 py-4 font-bold">Company</th>
                  <th className="px-4 py-4 font-bold">Priority</th>
                  <th className="px-4 py-4 font-bold">Score</th>
                  <th className="px-4 py-4 font-bold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {contacts.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-700 last:border-0 transition hover:bg-slate-800/70"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={item.contact.name} />
                        <div>
                          <p className="font-bold text-white">
                            {item.contact.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-200">
                            {item.contact.title || "Decision Maker"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-white">
                        {item.company || "Company not specified"}
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        {item.industry || "Industry not specified"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <PriorityBadge priority={item.priority} />
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-bold text-white">
                        {item.score ?? 0}
                      </span>
                      <span className="text-slate-300">/100</span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {item.contact.email && (
                          <ActionIcon
                            href={`mailto:${item.contact.email}`}
                            label="Email contact"
                          >
                            <Mail size={16} />
                          </ActionIcon>
                        )}

                        {item.contact.linkedin && (
                          <ActionIcon
                            href={item.contact.linkedin}
                            label="Open LinkedIn"
                            external
                          >
                            <LinkedInMark size={16} />
                          </ActionIcon>
                        )}

                        <Link
                          to={`/prospects/${item.id}`}
                          title="View company research"
                          className="rounded-lg border border-slate-600 bg-slate-800 p-2 text-white transition hover:border-cyan-400 hover:text-cyan-300"
                        >
                          <ArrowUpRight size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* NEXT STEP */}
      <div className="flex flex-col gap-5 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-slate-900 to-blue-950 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
            <Sparkles size={23} />
          </div>

          <div className="max-w-xl">
            <p className="text-lg font-bold text-white">
              Ready to start a conversation?
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-200">
              Choose your priority contacts and move to Outreach to prepare
              your next sales message.
            </p>
          </div>
        </div>

        <Link
          to="/outreach"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
        >
          Go to Outreach
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </div>
  );
}

/* SUMMARY CARD */
function SummaryCard({ icon, label, value, note, iconClass }) {
  return (
    <Card
      variant="dark"
      className="p-4 transition hover:border-cyan-400/40 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{note}</p>
        </div>
      </div>
    </Card>
  );
}

/* CONTACT AVATAR */
function Avatar({ name }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/15 text-sm font-bold text-cyan-200">
      {initials(name)}
    </div>
  );
}

/* PRIORITY BADGE */
function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
        priorityStyles[priority] || priorityStyles.Low
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {priority}
    </span>
  );
}

/* ACTION ICON */
function ActionIcon({ href, label, external = false, children }) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="rounded-lg border border-slate-600 bg-slate-800 p-2.5 text-slate-200 transition hover:border-cyan-400 hover:bg-slate-700 hover:text-cyan-300"
    >
      {children}
    </a>
  );
}

/* CONTACT CARD */
function ContactCard({ item }) {
  const contact = item.contact;

  return (
    <Card
      variant="dark"
      className="group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/50 hover:shadow-xl hover:shadow-slate-950/30"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-3">
          <Avatar name={contact.name} />

          <div className="min-w-0 flex-1">
            <h3 className="!text-white break-words text-base font-bold">
  {contact.name}
</h3>
            <p className="mt-1 text-sm leading-5 text-slate-200">
              {contact.title || "Decision Maker"}
            </p>
          </div>

          <PriorityBadge priority={item.priority} />
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-700 pt-4">
          <div className="flex items-start gap-2.5">
            <Building2
              size={17}
              className="mt-0.5 shrink-0 text-cyan-300"
            />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-white">
                {item.company || "Company not specified"}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                {item.industry || "Industry not specified"}
              </p>
            </div>
          </div>

          {item.location && (
            <div className="flex items-start gap-2.5 text-sm text-slate-200">
              <MapPin size={17} className="mt-0.5 shrink-0 text-cyan-300" />
              <span className="break-words">{item.location}</span>
            </div>
          )}

          {contact.email && (
            <div className="flex items-start gap-2.5 text-sm text-slate-200">
              <Mail size={17} className="mt-0.5 shrink-0 text-cyan-300" />
              <span className="min-w-0 break-all">{contact.email}</span>
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-emerald-400"
                aria-label="Email available"
              />
            </div>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Lead score</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {item.score ?? 0}
                <span className="ml-1 text-sm font-medium text-slate-300">
                  /100
                </span>
              </p>
            </div>

            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full ${
                  item.score >= 90
                    ? "bg-red-400"
                    : item.score >= 70
                      ? "bg-orange-400"
                      : item.score >= 50
                        ? "bg-amber-400"
                        : "bg-cyan-400"
                }`}
                style={{
                  width: `${Math.min(100, Math.max(0, item.score || 0))}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-auto flex gap-2 pt-5">
          <Link
            to={`/prospects/${item.id}`}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-sm font-semibold text-white transition hover:border-cyan-400 hover:bg-slate-700"
          >
            Research <ExternalLink size={15} />
          </Link>

          <Link
            to="/outreach"
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
          >
            Outreach <ArrowUpRight size={16} />
          </Link>
        </div>

        {(contact.email || contact.linkedin) && (
          <div className="mt-3 flex gap-2">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
              >
                <Mail size={15} /> Email
              </a>
            )}

            {contact.linkedin && (
              <a
                href={contact.linkedin}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
              >
                <LinkedInMark size={15} /> LinkedIn
              </a>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
