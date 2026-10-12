
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ChevronDown,
  Flame,
  Info,
  Mail,
  MapPin,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
  ChartNoAxesColumn,
  Building2,
  Trash2,
} from "lucide-react";

import { prospects } from "../data/mockData";

const STORAGE_KEY = "ai-founder-os-selected-prospects";

const readSelected = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch {
    return [];
  }
};

const companyName = (p) =>
  p.company || p.companyName || p.name || "Unnamed company";

const employeeLabel = (p) =>
  p.employees || p.employeeCount || p.companySize || "Not specified";

const signalLabel = (p) =>
  p.signal || p.buyingSignal || p.researchSignal || "No research signal available";

const getScore = (p) => {
  const raw = Number(p.score ?? p.aiScore ?? p.fitScore ?? 0);
  return Number.isFinite(raw)
    ? Math.max(0, Math.min(100, Math.round(raw)))
    : 0;
};

const getBand = (score) => {
  if (score >= 90) return "Hot";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  return "Low";
};

const bandStyles = {
  Hot: "border-orange-200 bg-orange-50 text-orange-700",
  High: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-slate-200 bg-slate-100 text-slate-600",
};

function ScoreRing({ score }) {
  const color =
    score >= 90
      ? "#EA580C"
      : score >= 70
        ? "#059669"
        : score >= 50
          ? "#D97706"
          : "#64748B";

  return (
    <div
      className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, #E9EEF5 0deg)`,
      }}
      aria-label={`Lead score ${score} out of 100`}
    >
      <div className="flex h-[46px] w-[46px] flex-col items-center justify-center rounded-full bg-white">
        <span className="text-sm font-bold leading-none text-slate-900">
          {score}
        </span>
        <span className="mt-1 text-[9px] text-slate-400">/100</span>
      </div>
    </div>
  );
}

function CompanyAvatar({ name }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-100 text-sm font-bold text-blue-700">
      {name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase()}
    </div>
  );
}

function BandBadge({ band }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${bandStyles[band]}`}
    >
      {band === "Hot" && <Flame size={12} />}
      {band} priority
    </span>
  );
}

function StatCard({ label, value, caption, icon: Icon, iconStyle }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconStyle}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">{caption}</p>
    </div>
  );
}

function FactorBar({ label, value, color }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function getFactors(p, score) {
  // Demo values only; replace with actual scoring API results later.
  const industryFit = Math.min(98, Math.max(25, Math.round(score * 0.92 + 6)));
  const companyFit = Math.min(98, Math.max(20, Math.round(score * 0.84 + 12)));
  const signalFit = Math.min(
    98,
    Math.max(15, Math.round(score * 0.78 + (p.signal ? 16 : 5)))
  );

  return [
    { label: "Industry fit", value: industryFit, color: "bg-blue-500" },
    { label: "Company fit", value: companyFit, color: "bg-cyan-500" },
    { label: "Research signal", value: signalFit, color: "bg-indigo-500" },
  ];
}

function getReasoning(p, score) {
  const company = companyName(p);
  const industry = p.industry || "its industry";
  const signal = signalLabel(p);

  if (score >= 90) {
    return `${company} is a high-priority candidate in ${industry}. Review the available research signal — "${signal}" — before deciding on outreach.`;
  }

  if (score >= 70) {
    return `${company} appears promising for ${industry}. Validate the company fit and research signal before starting outreach.`;
  }

  if (score >= 50) {
    return `${company} may be worth nurturing. Gather more company context and confirm relevance before prioritizing outreach.`;
  }

  return `${company} currently has a lower relative demo score. Review the available evidence and confirm ICP fit before investing in outreach.`;
}

export default function Leads() {
  const [selectedIds, setSelectedIds] = useState(() => readSelected());
  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("score");
  const [expanded, setExpanded] = useState([]);

  const selectedLeads = useMemo(() => {
    const selectedSet = new Set(selectedIds);

    return prospects
      .filter((p) => selectedSet.has(String(p.id)))
      .map((p) => {
        const score = getScore(p);
        return { ...p, _score: score, _band: getBand(score) };
      });
  }, [selectedIds]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return selectedLeads
      .filter((p) => {
        const name = companyName(p);
        const dm =
          typeof p.decisionMaker === "string"
            ? p.decisionMaker
            : p.decisionMaker?.name || p.decisionMaker?.title || "";

        const matchesSearch =
          !query ||
          [
            name,
            p.industry,
            p.location,
            signalLabel(p),
            dm,
            employeeLabel(p),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);

        const matchesBand = bandFilter === "All" || p._band === bandFilter;

        return matchesSearch && matchesBand;
      })
      .sort((a, b) =>
        sortOrder === "score"
          ? b._score - a._score
          : companyName(a).localeCompare(companyName(b))
      );
  }, [selectedLeads, search, bandFilter, sortOrder]);

  const counts = useMemo(
    () => ({
      Hot: selectedLeads.filter((p) => p._band === "Hot").length,
      High: selectedLeads.filter((p) => p._band === "High").length,
      Medium: selectedLeads.filter((p) => p._band === "Medium").length,
      Low: selectedLeads.filter((p) => p._band === "Low").length,
    }),
    [selectedLeads]
  );

  const removeLead = (id) => {
    const next = selectedIds.filter((item) => item !== String(id));
    setSelectedIds(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setExpanded((current) => current.filter((item) => item !== String(id)));
  };

  const toggleExpanded = (id) => {
    const key = String(id);

    setExpanded((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setBandFilter("All");
  };

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page heading */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
              <Target size={16} />
              Lead qualification
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Prioritize your leads<span className="text-blue-600">.</span>
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Compare selected companies, understand their relative scores, and
              decide where your sales team should focus first.
            </p>
          </div>

          <Link
            to="/prospects"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            <Search size={16} />
            Discover companies
          </Link>
        </header>

        {/* Overview banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg shadow-blue-950/10 sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />

          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                <Sparkles size={14} />
                Lead scoring workspace
              </div>

              
<h2
  className="max-w-xl text-xl font-semibold leading-snug sm:text-2xl"
  style={{
    color: "#ffffff",
    WebkitTextFillColor: "#ffffff",
  }}
>
  Spend time on the leads most worth pursuing.
</h2>


              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/80">
                Review selected companies, compare their scores, and check the
                available evidence before reaching out.
              </p>

              <div className="mt-4 inline-flex max-w-xl items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-blue-100/90">
                <Info size={15} className="mt-0.5 shrink-0" />
                Scores and factor breakdowns are illustrative demo values until
                connected to a real scoring service.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-60">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <Target size={18} className="mb-3 text-cyan-300" />
                <p className="text-2xl font-bold">{selectedLeads.length}</p>
                <p className="mt-1 text-xs text-blue-100/80">Selected leads</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <TrendingUp size={18} className="mb-3 text-cyan-300" />
                <p className="text-2xl font-bold">
                  {selectedLeads.length
                    ? Math.round(
                        selectedLeads.reduce((sum, p) => sum + p._score, 0) /
                          selectedLeads.length
                      )
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-blue-100/80">
                  Average demo score
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Priority statistics */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Hot priority"
            value={counts.Hot}
            caption="Scores from 90 to 100"
            icon={Flame}
            iconStyle="bg-orange-50 text-orange-600"
          />
          <StatCard
            label="High priority"
            value={counts.High}
            caption="Scores from 70 to 89"
            icon={Zap}
            iconStyle="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Medium priority"
            value={counts.Medium}
            caption="Scores from 50 to 69"
            icon={TrendingUp}
            iconStyle="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="Low priority"
            value={counts.Low}
            caption="Scores below 50"
            icon={Users}
            iconStyle="bg-slate-100 text-slate-600"
          />
        </section>

        {/* Empty state */}
        {selectedLeads.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-sm sm:py-20">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Target size={28} />
            </div>

            <h2 className="text-xl font-bold text-slate-900">
              Your lead list starts here
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Discover companies in Prospects, then choose “Add to Leads” for
              the companies you want to evaluate. They will appear here for
              score comparison and prioritization.
            </p>

            <Link
              to="/prospects"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Discover prospects
              <ArrowRight size={16} />
            </Link>
          </section>
        ) : (
          <>
            {/* Search, filters and sorting */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search selected leads..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
                  <label className="relative">
                    <span className="sr-only">Filter by priority</span>
                    <select
                      value={bandFilter}
                      onChange={(e) => setBandFilter(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-9 text-sm text-slate-700 outline-none focus:border-blue-400 sm:w-44"
                    >
                      {["All", "Hot", "High", "Medium", "Low"].map((band) => (
                        <option key={band} value={band}>
                          {band === "All"
                            ? "All priorities"
                            : `${band} priority`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </label>

                  <label className="relative">
                    <span className="sr-only">Sort leads</span>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-9 text-sm text-slate-700 outline-none focus:border-blue-400 sm:w-48"
                    >
                      <option value="score">Highest score first</option>
                      <option value="name">Company name A–Z</option>
                    </select>
                    <ArrowDownWideNarrow
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {["All", "Hot", "High", "Medium", "Low"].map((band) => (
                  <button
                    type="button"
                    key={band}
                    onClick={() => setBandFilter(band)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      bandFilter === band
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700"
                    }`}
                  >
                    {band}
                    {band !== "All" && (
                      <span className="ml-1.5 opacity-75">{counts[band]}</span>
                    )}
                  </button>
                ))}

                <span className="ml-auto text-xs text-slate-400">
                  {filtered.length} of {selectedLeads.length} leads
                </span>
              </div>
            </section>

            {/* No search/filter results */}
            {filtered.length === 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center">
                <Search size={24} className="mx-auto mb-3 text-slate-300" />
                <h3 className="font-semibold text-slate-900">
                  No matching leads
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Change the search or priority filter to see your leads.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  Clear filters
                </button>
              </section>
            ) : (
              <section className="space-y-4">
                {/* List heading */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">
                      Ranked lead list
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Review each company’s score and available evidence before
                      outreach.
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    Ranked by {sortOrder === "score" ? "demo score" : "company name"}
                  </span>
                </div>

                {/* Responsive company cards */}
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                  {filtered.map((p) => {
                    const id = String(p.id);
                    const name = companyName(p);
                    const factors = getFactors(p, p._score);
                    const isExpanded = expanded.includes(id);

                    return (
                      <article
                        key={id}
                        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md"
                      >
                        {/* Company heading */}
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start gap-3">
                            <CompanyAvatar name={name} />

                            <div className="min-w-0 flex-1">
                              <h3 className="break-words text-base font-bold text-slate-900 sm:text-lg">
                                {name}
                              </h3>

                              <p className="mt-1 text-sm text-slate-500">
                                {p.industry || "Industry not specified"}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={12} />
                                  {p.location || "Location not specified"}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Users size={12} />
                                  {employeeLabel(p)}
                                </span>
                              </div>
                            </div>

                            <ScoreRing score={p._score} />
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <BandBadge band={p._band} />
                            <span className="text-xs font-medium text-slate-400">
                              Demo score
                            </span>
                          </div>
                        </div>

                        {/* Research signal */}
                        <div className="mx-4 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3.5 sm:mx-5">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 rounded-lg bg-white p-2 text-cyan-700 shadow-sm">
                              <Sparkles size={15} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-900">
                                Research signal
                              </p>
                              <p className="mt-1 break-words text-sm leading-5 text-slate-700">
                                {signalLabel(p)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Scoring rationale */}
                        <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                          <div className="flex items-center gap-2">
                            <ChartNoAxesColumn
                              size={16}
                              className="text-blue-600"
                            />
                            <h4 className="text-sm font-semibold text-slate-900">
                              Scoring rationale
                            </h4>
                          </div>

                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {getReasoning(p, p._score)}
                          </p>

                          <button
                            type="button"
                            onClick={() => toggleExpanded(id)}
                            aria-expanded={isExpanded}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                          >
                            {isExpanded
                              ? "Hide score breakdown"
                              : "View score breakdown"}
                            <ChevronDown
                              size={15}
                              className={`transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  Score factors
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  These are illustrative demo values, not
                                  verified AI analysis.
                                </p>
                              </div>

                              {factors.map((factor) => (
                                <FactorBar
                                  key={factor.label}
                                  {...factor}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:px-5">
                          <div className="grid grid-cols-2 gap-2">
                            <Link
                              to="/outreach"
                              className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2.5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                              <Mail size={15} className="shrink-0" />
                              <span>Create outreach</span>
                            </Link>

                            <Link
                              to={`/prospects/${encodeURIComponent(id)}`}
                              className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                            >
                              <Search size={15} className="shrink-0" />
                              <span>View research</span>
                            </Link>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLead(id)}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                            Remove from Leads
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <p className="text-xs leading-5 text-slate-400">
          Lead selection is saved in this browser for the frontend demo. The
          current scoring rationale and factor bars are illustrative. Real
          scoring requires a backend scoring service and evidence-based inputs.
        </p>
      </div>
    </main>
  );
}
