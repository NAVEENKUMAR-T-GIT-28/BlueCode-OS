"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, type Icp, type Me, type Settings } from "@/lib/api";

const TILES = ["Prospects found", "Hot leads", "Messages ready", "Follow-ups", "Meetings booked"];

export default function Dashboard() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const icps = useQuery({ queryKey: ["icps"], queryFn: () => api<Icp[]>("/icps") });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") });

  const icp = icps.data?.[0];
  const s = settings.data;
  const steps = [
    { done: !!icp?.confirmed, label: "Confirm your ideal customer profile", href: "/icp", why: "Everything else is searched from it." },
    { done: !!s?.sender_name && !!s?.sender_address, label: "Add your sender name and postal address", href: "/settings", why: "Required in every email footer." },
    { done: !!s?.smtp.configured && !!s?.imap.configured, label: "Connect your mailbox", href: "/settings", why: "Emails send from your own address, and replies are read from it." },
    { done: !!s?.booking_link, label: "Add your booking link", href: "/settings", why: "Added automatically when someone replies with interest." },
  ];
  const next = steps.find((x) => !x.done);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome{me.data ? `, ${me.data.startup_name}` : ""}</h1>

      <dl className="mt-6 grid grid-cols-5 divide-x divide-line rounded-lg border border-line bg-surface">
        {TILES.map((t) => (
          <div key={t} className="px-4 py-4">
            <dd className="text-2xl font-semibold text-ink-faint">–</dd>
            <dt className="mt-1 text-xs text-ink-soft">{t}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-faint">These fill in once discovery starts (Sprint 3 onward).</p>

      <h2 className="mt-10 text-lg font-semibold">Get ready to find your first leads</h2>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
        {steps.map((st) => (
          <li key={st.label} className="flex items-center gap-4 px-4 py-3">
            <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${st.done ? "bg-accent text-white" : "border border-line text-transparent"}`}>✓</span>
            <div className="flex-1">
              <p className={st.done ? "text-ink-soft line-through" : "font-medium"}>{st.label}</p>
              {!st.done && <p className="text-xs text-ink-soft">{st.why}</p>}
            </div>
            {!st.done && <Link href={st.href} className={st === next ? "btn-primary" : "btn-quiet"}>Open</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
