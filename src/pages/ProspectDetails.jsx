
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Globe,
  MapPin,
  Users,
  BriefcaseBusiness,
  Sparkles,
  Search,
} from "lucide-react";

import { prospects } from "../data/mockData";

const companyName = (p) =>
  p.company || p.companyName || p.name || "Unnamed company";

const employeeLabel = (p) =>
  p.employees || p.employeeCount || p.companySize || "Not specified";

const signalLabel = (p) =>
  p.signal ||
  p.buyingSignal ||
  p.researchSignal ||
  "No research signal available.";

const decisionMakerLabel = (p) => {
  if (typeof p.decisionMaker === "string") return p.decisionMaker;

  return (
    p.decisionMaker?.name ||
    p.decisionMakerName ||
    p.decisionMaker?.title ||
    "Not available"
  );
};

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon size={19} />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-900">
        {value || "Not specified"}
      </p>
    </div>
  );
}

export default function ProspectResearch() {
  const { id } = useParams();

  const company = prospects.find(
    (item) => String(item.id) === String(id)
  );

  if (!company) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <Search size={30} className="mx-auto mb-4 text-slate-400" />

          <h1 className="text-xl font-bold text-slate-900">
            Company not found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            This company may not exist in the current dataset.
          </p>

          <Link
            to="/prospects"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ArrowLeft size={16} />
            Back to Prospects
          </Link>
        </div>
      </main>
    );
  }

  const name = companyName(company);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const website = company.website
    ? /^https?:\/\//i.test(company.website)
      ? company.website
      : `https://${company.website}`
    : null;

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          to="/prospects"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-700"
        >
          <ArrowLeft size={17} />
          Back to Prospects
        </Link>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400" />

          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-100 text-xl font-bold text-blue-700">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <Sparkles size={13} />
                  Company research
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  {name}
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  {company.industry || "Industry not specified"}
                </p>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} />
                    {company.location || "Location not specified"}
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Users size={15} />
                    {employeeLabel(company)}
                  </span>
                </div>
              </div>

              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                  Visit website
                  <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Company overview
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard
              icon={Building2}
              label="Industry"
              value={company.industry}
            />

            <InfoCard
              icon={MapPin}
              label="Location"
              value={company.location}
            />

            <InfoCard
              icon={Users}
              label="Company size"
              value={employeeLabel(company)}
            />

            <InfoCard
              icon={BriefcaseBusiness}
              label="Decision-maker"
              value={decisionMakerLabel(company)}
            />

            <InfoCard
              icon={Globe}
              label="Website"
              value={company.website || "Not available"}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles size={19} className="text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Research signals
            </h2>
          </div>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {signalLabel(company)}
          </p>

          {company.description && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Company description
              </h3>

              <p className="mt-2 text-sm leading-7 text-slate-600">
                {company.description}
              </p>
            </div>
          )}

          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            This information comes from the current app dataset. It is not
            live-verified company research or an AI-generated analysis.
          </p>
        </section>

        <div className="flex justify-start">
          <Link
            to="/leads"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Go to Leads
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </main>
  );
}
