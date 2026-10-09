"use client";
import { useQuery } from "@tanstack/react-query";
import { api, inr, type Usage } from "@/lib/api";

export default function BudgetMeter() {
  const { data } = useQuery({ queryKey: ["usage"], queryFn: () => api<Usage>("/usage"), refetchInterval: 30_000 });
  if (!data) return <div className="h-9 w-64" aria-hidden />;

  const used = data.spent_minor + data.reserved_minor;
  const pct = Math.min(100, Math.round((used / data.cap_minor) * 100));
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warn" : "bg-accent";
  const ended = data.trial_days_left <= 0;

  return (
    <div className="flex items-center gap-4 text-xs text-ink-soft" role="status">
      <div className="w-44">
        <div className="mb-1 flex justify-between">
          <span>API budget</span>
          <span className="font-medium text-ink">{inr(data.remaining_minor)} left</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={ended ? "font-semibold text-danger" : data.trial_days_left <= 3 ? "font-semibold text-warn" : ""}>
        {ended ? "Trial ended: read-only" : `${data.trial_days_left} trial days left`}
      </span>
    </div>
  );
}
