
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Compass,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
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

const decisionMaker = (p) => {
  if (typeof p.decisionMaker === "string") return p.decisionMaker;

  return (
    p.decisionMaker?.name ||
    p.decisionMakerName ||
    p.decisionMaker?.title ||
    "Not available"
  );
};

const employeeLabel = (p) =>
  p.employees || p.employeeCount || p.companySize || "Not specified";

const signalLabel = (p) =>
  p.signal ||
  p.buyingSignal ||
  p.researchSignal ||
  "No research signal available";

const normalize = (value) => String(value ?? "").toLowerCase().trim();

function CompanyAvatar({ name }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-100 text-sm font-bold text-blue-700">
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

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">
        {label}
      </span>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        >
          {options.map((option) => (
            <option
              key={option}
              value={option === "All" ? "" : option}
            >
              {option}
            </option>
          ))}
        </select>

        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </label>
  );
}

export default function Prospects() {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [size, setSize] = useState("");
  const [role, setRole] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(() => readSelected());
  const [notice, setNotice] = useState("");

  const industries = useMemo(
    () =>
      [...new Set(prospects.map((p) => p.industry).filter(Boolean))].sort(),
    []
  );

  const locations = useMemo(
    () =>
      [...new Set(prospects.map((p) => p.location).filter(Boolean))].sort(),
    []
  );

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      const name = companyName(p);
      const dm = decisionMaker(p);

      const searchableText = normalize(
        [
          name,
          p.industry,
          p.location,
          employeeLabel(p),
          signalLabel(p),
          dm,
          p.description,
          p.website,
        ].join(" ")
      );

      const matchesSearch =
        !normalize(search) || searchableText.includes(normalize(search));

      const matchesIndustry = !industry || p.industry === industry;
      const matchesLocation = !location || p.location === location;

      const rawSize = normalize(employeeLabel(p)).replace(/,/g, "");
      const numbers = rawSize.match(/\d+/g)?.map(Number) || [];

      const employeeCount = numbers.length
        ? Math.max(...numbers)
        : Number(p.employeeCount) || 0;

      let matchesSize = true;

      if (size === "1–49") {
        matchesSize = employeeCount > 0 && employeeCount < 50;
      }

      if (size === "50–199") {
        matchesSize = employeeCount >= 50 && employeeCount < 200;
      }

      if (size === "200–500") {
        matchesSize = employeeCount >= 200 && employeeCount <= 500;
      }

      if (size === "500+") {
        matchesSize = employeeCount > 500;
      }

      const roleText = normalize(
        `${dm} ${p.decisionMaker?.title || ""}`
      );

      const matchesRole =
        !role ||
        (role === "Founder / CEO" &&
          /founder|ceo|chief executive|owner/.test(roleText)) ||
        (role === "Sales leadership" &&
          /sales|revenue|growth|commercial/.test(roleText)) ||
        (role === "Marketing leadership" &&
          /marketing|demand generation|brand/.test(roleText)) ||
        (role === "Other" &&
          !/founder|ceo|chief executive|owner|sales|revenue|growth|commercial|marketing|demand generation|brand/.test(
            roleText
          ));

      return (
        matchesSearch &&
        matchesIndustry &&
        matchesLocation &&
        matchesSize &&
        matchesRole
      );
    });
  }, [search, industry, location, size, role]);

  const activeFilters = [industry, location, size, role].filter(
    Boolean
  ).length;

  const resetFilters = () => {
    setIndustry("");
    setLocation("");
    setSize("");
    setRole("");
    setSearch("");
  };

  const saveToLeads = (id) => {
    const key = String(id);

    if (selected.includes(key)) return;

    const next = [...selected, key];

    setSelected(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    setNotice("Company added to Leads successfully.");

    window.setTimeout(() => setNotice(""), 3500);
  };

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
              <Compass size={16} />
              Sales intelligence
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Discover prospects<span className="text-blue-600">.</span>
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Find companies that match your ideal customer profile, explore
              their research signals, and choose which ones deserve a closer look.
            </p>
          </div>

          <Link
            to="/leads"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            View selected leads
            <ArrowRight size={16} />

            {selected.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                {selected.length}
              </span>
            )}
          </Link>
        </header>

        {/* Discovery banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-lg shadow-blue-950/10 sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />

          <div className="pointer-events-none absolute bottom-0 right-1/3 h-28 w-28 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                <Sparkles size={14} />
                Company discovery workspace
              </div>

              
<h1
  style={{ color: "#ffffff" }}
  className="max-w-xl text-xl font-semibold leading-snug sm:text-2xl"
>
  Start with the right companies. Prioritize them
</h1>


              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/75">
                Search your available company dataset, narrow it down, then add
                promising matches to your Leads workspace for prioritization.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-56">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <Building2 size={18} className="mb-3 text-cyan-300" />
                <p className="text-2xl font-bold">{prospects.length}</p>
                <p className="mt-1 text-xs text-blue-100/75">
                  Available companies
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <CheckCircle2 size={18} className="mb-3 text-cyan-300" />
                <p className="text-2xl font-bold">{selected.length}</p>
                <p className="mt-1 text-xs text-blue-100/75">
                  Added to Leads
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Success notice */}
        {notice && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          >
            <CheckCircle2 size={17} />
            <span>{notice}</span>

            <Link to="/leads" className="ml-auto font-semibold underline">
              View Leads
            </Link>
          </div>
        )}

        {/* Search and filters */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company, industry, location, or research signal..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters((value) => !value)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                showFilters || activeFilters
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={17} />
              Filters

              {activeFilters > 0 && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                  {activeFilters}
                </span>
              )}

              <ChevronDown
                size={15}
                className={`transition ${showFilters ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect
                label="Industry"
                value={industry}
                onChange={setIndustry}
                options={["All", ...industries]}
              />

              <FilterSelect
                label="Location"
                value={location}
                onChange={setLocation}
                options={["All", ...locations]}
              />

              <FilterSelect
                label="Company size"
                value={size}
                onChange={setSize}
                options={["All", "1–49", "50–199", "200–500", "500+"]}
              />

              <FilterSelect
                label="Decision-maker role"
                value={role}
                onChange={setRole}
                options={[
                  "All",
                  "Founder / CEO",
                  "Sales leadership",
                  "Marketing leadership",
                  "Other",
                ]}
              />

              <button
                onClick={resetFilters}
                className="text-left text-sm font-medium text-slate-500 transition hover:text-blue-700 sm:col-span-2 lg:col-span-4"
              >
                Clear search and all filters
              </button>
            </div>
          )}
        </section>

        {/* Company directory */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="font-semibold text-slate-900">
                Company directory
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {filtered.length}{" "}
                {filtered.length === 1 ? "company" : "companies"} found
                {activeFilters ? ` · ${activeFilters} active filters` : ""}
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Search size={24} />
              </div>

              <h3 className="font-semibold text-slate-900">
                No matching companies
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Try a different search or clear some filters.
              </p>

              <button
                onClick={resetFilters}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[800px] text-left">
                  <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Company</th>
                      <th className="px-3 py-3">Location</th>
                      <th className="px-3 py-3">Company size</th>
                      <th className="px-3 py-3">Research signal</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((p) => {
                      const id = String(p.id);
                      const name = companyName(p);
                      const isSelected = selected.includes(id);

                      return (
                        <tr
                          key={id}
                          className="transition hover:bg-blue-50/30"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <CompanyAvatar name={name} />

                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">
                                  {name}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {p.industry || "Industry not specified"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <MapPin
                                size={14}
                                className="shrink-0 text-slate-400"
                              />
                              {p.location || "Not specified"}
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Users size={14} className="text-slate-400" />
                              {employeeLabel(p)}
                            </div>
                          </td>

                          <td className="max-w-xs px-3 py-4">
                            <p className="line-clamp-2 text-sm leading-5 text-slate-600">
                              {signalLabel(p)}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/prospects/${encodeURIComponent(id)}`}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
                              >
                                Research
                              </Link>

                              <button
                                onClick={() => saveToLeads(id)}
                                disabled={isSelected}
                                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                  isSelected
                                    ? "cursor-default bg-emerald-50 text-emerald-700"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                              >
                                {isSelected ? "Added" : "Add to Leads"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-3 md:hidden">
                {filtered.map((p) => {
                  const id = String(p.id);
                  const name = companyName(p);
                  const isSelected = selected.includes(id);

                  return (
                    <article
                      key={id}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200"
                    >
                      <div className="flex items-start gap-3">
                        <CompanyAvatar name={name} />

                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-slate-900">
                            {name}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {p.industry || "Industry not specified"}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={12} />
                              {p.location || "Location unknown"}
                            </span>

                            <span className="inline-flex items-center gap-1">
                              <Users size={12} />
                              {employeeLabel(p)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl bg-slate-50 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Research signal
                        </p>

                        <p className="text-sm leading-5 text-slate-600">
                          {signalLabel(p)}
                        </p>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Link
                          to={`/prospects/${encodeURIComponent(id)}`}
                          className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                        >
                          Research
                        </Link>

                        <button
                          onClick={() => saveToLeads(id)}
                          disabled={isSelected}
                          className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                            isSelected
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {isSelected ? "Added to Leads" : "Add to Leads"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-400">
          Company details shown here come from the current app dataset. Live
          company discovery and verified research require a connected data
          provider.
        </p>
      </div>
    </main>
  );
}
