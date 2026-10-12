
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  Flame,
  Sparkles,
} from "lucide-react";

/* PAGE HEADER */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  actionIcon: ActionIcon,
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-600">
            {eyebrow}
          </p>
        )}

        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
        >
          {ActionIcon && <ActionIcon size={16} />}
          {action.label}
        </button>
      )}
    </div>
  );
}

/* CARD */
export function Card({
  children,
  className = "",
  variant = "default",
}) {
  const styles = {
    default:
      "rounded-2xl border border-slate-200 bg-white shadow-sm",
    dark:
      "rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-lg shadow-slate-950/20",
  };

  return (
    <div className={`${styles[variant] || styles.default} ${className}`}>
      {children}
    </div>
  );
}

/* SECTION TITLE */
export function SectionTitle({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

/* BADGE */
export function Badge({ children, variant = "default" }) {
  const variants = {
    default: "border-slate-200 bg-slate-50 text-slate-700",
    hot: "border-red-300 bg-red-100 text-red-700",
    high: "border-orange-300 bg-orange-100 text-orange-800",
    medium: "border-blue-300 bg-blue-100 text-blue-800",
    low: "border-slate-300 bg-slate-100 text-slate-700",
    success: "border-emerald-300 bg-emerald-100 text-emerald-800",
    warning: "border-amber-300 bg-amber-100 text-amber-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${
        variants[variant] || variants.default
      }`}
    >
      {children}
    </span>
  );
}

/* SCORE RING */
export function ScoreRing({ score = 0, size = "md" }) {
  const isLarge = size === "lg";
  const radius = isLarge ? 30 : 22;
  const dimension = isLarge ? 80 : 56;
  const center = dimension / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
  const progress = circumference - (safeScore / 100) * circumference;

  const color =
    safeScore >= 90
      ? "text-red-400"
      : safeScore >= 70
        ? "text-cyan-400"
        : "text-amber-400";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${
        isLarge ? "h-20 w-20" : "h-14 w-14"
      }`}
    >
      <svg
        className="-rotate-90"
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth="5"
          fill="transparent"
          className="text-slate-700"
        />

        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth="5"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          className={`${color} transition-all duration-500`}
        />
      </svg>

      <span className="absolute text-sm font-bold text-slate-950">
        {score ?? 0}
      </span>
    </div>
  );
}

/* STAT CARD */
export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  description,
}) {
  return (
    <Card className="group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-600">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Icon size={18} />
          </div>
        )}
      </div>

      {(change || description) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {change && (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
              <ArrowUpRight size={12} />
              {change}
            </span>
          )}

          {description && (
            <span className="text-slate-500">{description}</span>
          )}
        </div>
      )}
    </Card>
  );
}

/* EMPTY STATE */
export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
        <Icon size={22} />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-600">
        {description}
      </p>
    </div>
  );
}

/* STATUS ICON */
export function StatusIcon({ type }) {
  if (type === "success") {
    return <Check size={15} className="text-emerald-600" />;
  }

  if (type === "warning") {
    return <CircleAlert size={15} className="text-amber-600" />;
  }

  return <Clock3 size={15} className="text-slate-500" />;
}

/* PRIORITY ICON */
export function PriorityIcon({ priority }) {
  if (priority === "High") {
    return <Flame size={14} className="text-red-500" />;
  }

  return <Clock3 size={14} className="text-blue-600" />;
}
