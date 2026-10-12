
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock3,
  Gauge,
  Info,
  LockKeyhole,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";

const COMPANY = {
  name: "AI Founder OS",
  website: "https://bluecode-os.com",
  industry: "Software / SaaS",
};

const MONTHLY_LIMIT = 1000;

const INITIAL_USAGE = {
  apiSpend: 286.5,
  prospectsDiscovered: 126,
  aiOperations: 84,
  emailsPrepared: 42,
};

const INITIAL_HISTORY = [
  {
    id: 1,
    operation: "AI prospect research",
    date: "12 Oct 2026",
    cost: 42.5,
    status: "Completed",
  },
  {
    id: 2,
    operation: "Prospect scoring",
    date: "11 Oct 2026",
    cost: 18,
    status: "Completed",
  },
  {
    id: 3,
    operation: "Email preparation",
    date: "10 Oct 2026",
    cost: 26,
    status: "Completed",
  },
  {
    id: 4,
    operation: "Company research",
    date: "9 Oct 2026",
    cost: 35,
    status: "Completed",
  },
];

const NAVIGATION = [
  {
    id: "usage",
    label: "API usage & spend",
    description: "Usage and spending limit",
    icon: Wallet,
  },
  {
    id: "company",
    label: "Company profile",
    description: "Company information",
    icon: Building2,
  },
  {
    id: "security",
    label: "Security",
    description: "Access and protection",
    icon: ShieldCheck,
  },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

function Panel({ children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeading({ title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function LabelValue({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="break-words text-sm font-medium text-slate-800">
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ children, variant = "neutral" }) {
  const styles = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function Metric({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
        <Icon size={18} />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}

function Notice({ children, variant = "info" }) {
  const styles =
    variant === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-cyan-200 bg-cyan-50 text-slate-700";

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${styles}`}
    >
      <Info size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("usage");

  const usage = INITIAL_USAGE;
  const usageHistory = INITIAL_HISTORY;

  const remaining = Math.max(0, MONTHLY_LIMIT - usage.apiSpend);

  const usagePercent = Math.min(
    100,
    (usage.apiSpend / MONTHLY_LIMIT) * 100
  );

  const limitReached = usage.apiSpend >= MONTHLY_LIMIT;
  const nearLimit = usagePercent >= 80 && !limitReached;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* PAGE HEADING */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700">
              <Gauge size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Settings
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage API usage, company information, and security.
              </p>
            </div>
          </div>
        </header>

        {/* DEMO DATA NOTICE */}
        <div className="mb-6">
          <Notice>
            <span className="font-semibold text-slate-900">Demo data:</span>{" "}
            Usage figures and history are sample values, not live API provider
            charges.
          </Notice>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          {/* SETTINGS SIDEBAR */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Settings
            </p>

            <nav className="space-y-1">
              {NAVIGATION.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                        : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={19} className="shrink-0" />

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>
                      <span
                        className={`mt-1 block text-xs ${
                          isActive ? "text-cyan-700" : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* MAIN CONTENT */}
          <main className="min-w-0 space-y-6">
            {/* API USAGE & SPEND */}
            {activeTab === "usage" && (
              <>
                <Panel>
                  <SectionHeading
                    title="API usage & spend"
                    description="Monitor AI API costs against your monthly budget."
                    action={
                      <StatusBadge>
                        <Activity size={13} />
                        Current month
                      </StatusBadge>
                    }
                  />

                  <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Total API spend
                      </p>

                      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                        {formatCurrency(usage.apiSpend)}
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        of {formatCurrency(MONTHLY_LIMIT)} monthly limit
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:min-w-48">
                      <p className="text-sm text-slate-500">
                        Budget remaining
                      </p>

                      <p
                        className={`mt-1 text-xl font-semibold ${
                          limitReached ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {formatCurrency(remaining)}
                      </p>
                    </div>
                  </div>

                  {/* BUDGET PROGRESS */}
                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Budget used</span>

                      <span
                        className={`font-medium ${
                          limitReached || nearLimit
                            ? "text-amber-700"
                            : "text-slate-700"
                        }`}
                      >
                        {usagePercent.toFixed(1)}%
                      </span>
                    </div>

                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label="Monthly API budget used"
                      aria-valuenow={usagePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${
                          limitReached || nearLimit
                            ? "bg-amber-500"
                            : "bg-cyan-500"
                        }`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>

                  {limitReached && (
                    <div className="mt-4">
                      <Notice variant="warning">
                        The recorded spend has reached the ₹1,000 monthly
                        limit. Backend enforcement is required to block
                        further billable AI requests.
                      </Notice>
                    </div>
                  )}

                  {nearLimit && (
                    <div className="mt-4">
                      <Notice variant="warning">
                        You have used at least 80% of your monthly API budget.
                        Monitor usage carefully to avoid reaching the limit.
                      </Notice>
                    </div>
                  )}

                  {/* FIXED MONTHLY LIMIT */}
                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Monthly spending limit
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Fixed budget for the current MVP.
                        </p>
                      </div>

                      <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                        <p className="text-xs font-medium text-cyan-800">
                          Monthly limit
                        </p>
                        <p className="mt-1 text-lg font-semibold text-cyan-900">
                          {formatCurrency(MONTHLY_LIMIT)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Panel>

                {/* USAGE BREAKDOWN */}
                <section>
                  <SectionHeading
                    title="Usage breakdown"
                    description="A snapshot of activity in this demo."
                  />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Metric
                      icon={Building2}
                      label="Prospects discovered"
                      value={usage.prospectsDiscovered}
                      description="Sample count"
                    />

                    <Metric
                      icon={Zap}
                      label="AI operations"
                      value={usage.aiOperations}
                      description="Sample count"
                    />

                    <Metric
                      icon={Activity}
                      label="Emails prepared"
                      value={usage.emailsPrepared}
                      description="Sample count"
                    />
                  </div>
                </section>

                {/* USAGE HISTORY */}
                <Panel>
                  <SectionHeading
                    title="Recent usage history"
                    description="Sample operations and estimated costs."
                    action={<Clock3 size={19} className="text-slate-400" />}
                  />

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                          <th className="pb-3 pr-4 font-semibold">
                            Operation
                          </th>
                          <th className="pb-3 pr-4 font-semibold">Date</th>
                          <th className="pb-3 pr-4 font-semibold">Status</th>
                          <th className="pb-3 text-right font-semibold">
                            Cost
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {usageHistory.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                          >
                            <td className="py-4 pr-4 font-medium text-slate-800">
                              {item.operation}
                            </td>

                            <td className="whitespace-nowrap py-4 pr-4 text-slate-500">
                              {item.date}
                            </td>

                            <td className="py-4 pr-4">
                              <StatusBadge variant="success">
                                <CheckCircle2 size={12} />
                                {item.status}
                              </StatusBadge>
                            </td>

                            <td className="whitespace-nowrap py-4 text-right font-semibold text-slate-800">
                              {formatCurrency(item.cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Replace these sample records with actual usage records
                    from your backend and AI provider.
                  </p>
                </Panel>

                <Notice>
                  AI Founder OS pays for the AI API. The backend must record
                  actual usage, check the fixed ₹1,000 monthly limit before
                  billable requests, and reject further requests when the
                  budget is exhausted.
                </Notice>
              </>
            )}

            {/* COMPANY PROFILE */}
            {activeTab === "company" && (
              <>
                <Panel>
                  <SectionHeading
                    title="Company profile"
                    description="Your registered company information."
                    action={
                      <StatusBadge>
                        <LockKeyhole size={13} />
                        Read-only
                      </StatusBadge>
                    }
                  />

                  <div className="grid gap-6 sm:grid-cols-2">
                    <LabelValue label="Company name">
                      {COMPANY.name}
                    </LabelValue>

                    <LabelValue label="Industry">
                      {COMPANY.industry}
                    </LabelValue>

                    <LabelValue label="Website">
                      <a
                        href={COMPANY.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-cyan-700 hover:text-cyan-900 hover:underline"
                      >
                        {COMPANY.website.replace(/^https?:\/\//, "")}
                        <ArrowUpRight size={14} />
                      </a>
                    </LabelValue>

                    <LabelValue label="Workspace access">
                      CEO only
                    </LabelValue>
                  </div>
                </Panel>

                <Notice>
                  Your ICP profile is created during first-time onboarding
                  and cannot be edited from Settings.
                </Notice>
              </>
            )}

            {/* SECURITY */}
            {activeTab === "security" && (
              <>
                <Panel>
                  <SectionHeading
                    title="Security"
                    description="Review the important protections for your workspace."
                  />

                  <div className="divide-y divide-slate-200">
                    <div className="flex items-start gap-3 py-5 first:pt-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                        <LockKeyhole size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Account authentication
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Require secure login and verify authenticated users
                          on the server for protected operations.
                        </p>
                      </div>

                      <StatusBadge variant="warning">Verify</StatusBadge>
                    </div>

                    <div className="flex items-start gap-3 py-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                        <ShieldCheck size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Data access protection
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Ensure API routes authorize access to company,
                          prospect, and email data on the server.
                        </p>
                      </div>

                      <StatusBadge variant="warning">Verify</StatusBadge>
                    </div>

                    <div className="flex items-start gap-3 py-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                        <Wallet size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          API credential protection
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Store provider API keys on the backend using
                          environment variables or a secure secrets manager.
                          Never expose secret keys in frontend code.
                        </p>
                      </div>

                      <StatusBadge variant="warning">Verify</StatusBadge>
                    </div>

                    <div className="flex items-start gap-3 py-5 last:pb-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                        <Gauge size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Spending limit enforcement
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Enforce the fixed ₹1,000 monthly API budget on the
                          backend before running billable AI operations.
                        </p>
                      </div>

                      <StatusBadge variant="warning">Verify</StatusBadge>
                    </div>
                  </div>
                </Panel>

                <Notice variant="warning">
                  “Verify” is a reminder to check the implementation. It does
                  not indicate that a security audit has been completed.
                </Notice>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
