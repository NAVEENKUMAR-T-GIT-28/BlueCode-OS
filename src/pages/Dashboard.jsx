
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Target,
} from "lucide-react";

import {
  Card,
  PageHeader,
  SectionTitle,
  StatCard,
} from "../components/UI";

function Dashboard() {
  // Demo values — connect to the backend when ready.
  const stats = [
    {
      label: "Prospects Found",
      value: "25",
      change: "+8 today",
      icon: Building2,
      path: "/prospects",
    },
    {
      label: "Hot Leads",
      value: "12",
      change: "High-priority companies",
      icon: Target,
      path: "/leads",
    },
    {
      label: "Messages Ready",
      value: "10",
      change: "Ready for review",
      icon: Mail,
      path: "/outreach",
    },
    {
      label: "Follow-ups",
      value: "8",
      change: "Due today",
      icon: Clock3,
      path: "/follow-ups",
    },
    {
      label: "Meetings Booked",
      value: "3",
      change: "This week",
      icon: CalendarDays,
      path: "/pipeline",
    },
  ];

  const priorities = [
    {
      icon: Mail,
      title: "Review outreach messages",
      description:
        "Check your personalized drafts before sending them.",
      count: "10 ready",
      path: "/outreach",
      action: "Review messages",
    },
    {
      icon: Clock3,
      title: "Complete follow-ups",
      description:
        "Review conversations that need a response today.",
      count: "8 due",
      path: "/follow-ups",
      action: "View follow-ups",
    },
    {
      icon: Target,
      title: "Prioritize high-scoring leads",
      description:
        "Review your strongest ICP matches and choose the next companies to contact.",
      count: "12 hot leads",
      path: "/leads",
      action: "View leads",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* PAGE HEADER */}
      <PageHeader
        eyebrow="AI SALES COPILOT"
        title="Welcome, ABC Technologies"
        description="Your sales workspace at a glance. See your progress and focus on the actions that matter today."
      />

      {/* SALES COMMAND CENTER */}
      <section className="relative overflow-hidden rounded-[28px] border border-blue-200/70 bg-gradient-to-br from-[#061a33] via-[#0a2d57] to-[#075985] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.14)] sm:p-7 lg:p-8">
        {/* Background glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            {/* Command center label — spark icon removed */}
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-blue-950/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100 backdrop-blur-md">
              Today's Sales Command Center
            </div>

            <h2
              className="mt-4 text-xl font-semibold sm:text-2xl"
              style={{
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
              }}
            >
              Your next customer starts here.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-[15px]">
              Focus on the right companies, prepare meaningful outreach,
              and keep your sales moving forward.
            </p>

            {/* Read-only ICP summary */}
            <div className="mt-6 flex flex-wrap gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 bg-white/10 px-3.5 py-2.5 backdrop-blur-md">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-300">
                  ICP
                </span>
                <span className="text-xs font-semibold text-white">
                  Indian B2B Companies
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 bg-white/10 px-3.5 py-2.5 backdrop-blur-md">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-300">
                  Size
                </span>
                <span className="text-xs font-semibold text-white">
                  50–500 Employees
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/20 bg-white/10 px-3.5 py-2.5 backdrop-blur-md">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-cyan-300">
                  Target
                </span>
                <span className="text-xs font-semibold text-white">
                  HR Heads / Founders
                </span>
              </div>
            </div>
          </div>

          {/* Decorative AI orb removed */}
        </div>
      </section>

      {/* SALES OVERVIEW */}
      <section>
        <SectionTitle
          title="Sales Overview"
          description="Your key sales numbers in one place."
        />

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.path}
              className="block rounded-2xl transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <StatCard
                label={stat.label}
                value={stat.value}
                change={stat.change}
                icon={stat.icon}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* TODAY'S PRIORITIES */}
      <Card className="overflow-hidden">
        <div className="p-5 sm:p-6">
          <SectionTitle
            title="Needs Your Attention"
            description="A short list of actions to help you move forward today."
          />
        </div>

        <div className="divide-y divide-slate-100">
          {priorities.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="flex flex-col gap-4 p-5 transition hover:bg-blue-50/30 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Icon size={18} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">
                      {item.title}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>

                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {item.count}
                    </span>
                  </div>
                </div>

                <Link
                  to={item.path}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 sm:w-auto"
                >
                  {item.action}
                  <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      </Card>

      {/* DEMO DATA NOTICE */}
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <CheckCircle2
          size={16}
          className="mt-0.5 shrink-0 text-slate-500"
        />

        <p className="text-[11px] leading-5 text-slate-500">
          The figures shown are sample data for the current UI demo.
          Live values will come from your connected backend and integrations.
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
