import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Card, PageHeader, Badge, ScoreRing } from "../components/UI";

function NextBestAction() {
  return (
    <div>
      <PageHeader
        eyebrow="Copilot intelligence"
        title="What should you do next?"
        description="One prioritized action instead of another dashboard full of numbers."
      />

      <Card className="overflow-hidden border-slate-900">
        <div className="grid lg:grid-cols-[1fr_340px]">
          {/* Main */}
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Sparkles size={18} />
              </div>

              <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
                Recommended action
              </span>
            </div>

            <h2 className="mt-5 max-w-2xl text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Follow up with Rohan at Acme Technologies.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
              The account has strong ICP fit, a recent revenue-operations
              hiring signal, and recent engagement with your first message.
              Together, these signals make today a strong follow-up window.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="hot">94 • Hot</Badge>
              <Badge variant="success">Email opened</Badge>
              <Badge variant="success">Buying signal</Badge>
            </div>

            <div className="mt-8">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Suggested message
              </p>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm leading-6 text-slate-600">
                  “Wanted to follow up because Acme's revenue operations
                  expansion looks closely aligned with the workflow problems
                  we're solving.”
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/outreach"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                Review outreach
                <ArrowRight size={14} />
              </Link>

              <button className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                Snooze until tomorrow
              </button>
            </div>
          </div>

          {/* Reasoning */}
          <div className="border-t border-slate-200 bg-slate-50 p-6 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Copilot reasoning
            </p>

            <div className="mt-5 space-y-5">
              <Reason
                icon={CheckCircle2}
                title="Strong ICP fit"
                text="Company size, industry and geography all match."
              />

              <Reason
                icon={Clock3}
                title="Why now"
                text="Revenue operations hiring detected recently."
              />

              <Reason
                icon={Mail}
                title="Engagement"
                text="First message was opened twice."
              />

              <Reason
                icon={UserRound}
                title="Right person"
                text="VP of Revenue is the strongest decision-maker match."
              />
            </div>

            <div className="mt-7 flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <ScoreRing score={94} />

              <div>
                <p className="text-xs font-bold">Priority score</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  High confidence recommendation
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SmallCard
          number="01"
          title="Find"
          text="Identify the right accounts and people."
        />

        <SmallCard
          number="02"
          title="Understand"
          text="Explain why the prospect matters now."
        />

        <SmallCard
          number="03"
          title="Act"
          text="Recommend the next best sales action."
        />
      </div>
    </div>
  );
}

function Reason({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
        <Icon size={14} className="text-slate-500" />
      </div>

      <div>
        <p className="text-xs font-bold">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function SmallCard({ number, title, text }) {
  return (
    <Card className="p-5">
      <span className="text-[10px] font-bold text-amber-600">{number}</span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </Card>
  );
}

export default NextBestAction;