import { ArrowUpRight, BarChart3, Target, Users } from "lucide-react";

import { analytics } from "../data/mockData";
import { Card, PageHeader, StatCard } from "../components/UI";

function Analytics() {
  return (
    <div>
      <PageHeader
        eyebrow="Pilot analytics"
        title="Sales workflow performance."
        description="Track how the Copilot turns research into qualified opportunities and actions."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Qualification rate"
          value="50%"
          change="+6.4%"
          description="vs. previous batch"
          icon={Target}
        />

        <StatCard
          label="Priority rate"
          value="30%"
          change="+3.1%"
          description="of researched accounts"
          icon={Users}
        />

        <StatCard
          label="Meetings generated"
          value="3"
          change="+2"
          description="this pilot"
          icon={BarChart3}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card className="p-6">
          <h2 className="text-sm font-bold">Pilot funnel</h2>
          <p className="mt-1 text-xs text-slate-500">
            From research to meetings.
          </p>

          <div className="mt-7 space-y-5">
            {analytics.funnel.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    {item.label}
                  </p>

                  <p className="text-xs font-bold">{item.value}</p>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all"
                    style={{ width: `${Math.max(item.percentage, 6)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Activity */}
        <Card className="p-6">
          <h2 className="text-sm font-bold">Weekly activity</h2>
          <p className="mt-1 text-xs text-slate-500">
            Accounts researched vs. contacts prepared.
          </p>

          <div className="mt-7 space-y-4">
            {analytics.weeklyActivity.map((item) => (
              <div key={item.day} className="flex items-center gap-4">
                <span className="w-8 text-xs font-bold text-slate-400">
                  {item.day}
                </span>

                <div className="flex-1">
                  <div className="flex gap-1">
                    <div
                      className="h-7 rounded-lg bg-slate-900"
                      style={{
                        width: `${item.researched * 5}%`,
                        minWidth: 12,
                      }}
                    />

                    <div
                      className="h-7 rounded-lg bg-amber-300"
                      style={{
                        width: `${item.contacted * 5}%`,
                        minWidth: 12,
                      }}
                    />
                  </div>
                </div>

                <div className="flex w-20 justify-end gap-3 text-[10px]">
                  <span className="font-bold">{item.researched}</span>
                  <span className="text-amber-700">{item.contacted}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex gap-5 border-t border-slate-100 pt-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              Researched
            </span>

            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              Contacted
            </span>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <ArrowUpRight size={18} className="text-emerald-600" />
          </div>

          <div>
            <h2 className="text-sm font-bold">
              The strongest signal is qualification quality.
            </h2>

            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              The prototype tracks the funnel around the product's core
              promise: fewer irrelevant accounts, more qualified prospects,
              and clearer next actions for founders.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Analytics;