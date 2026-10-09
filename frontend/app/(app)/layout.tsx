"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import BudgetMeter from "@/components/BudgetMeter";
import { api, ApiError, type Me } from "@/lib/api";

// Mirrors the PRD navigation blueprint. `sprint` marks pages that are not built yet.
const NAV: { href: string; label: string; sprint?: number }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/icp", label: "ICP Builder" },
  { href: "/prospects", label: "Prospects", sprint: 3 },
  { href: "/leads", label: "Leads", sprint: 4 },
  { href: "/decision-makers", label: "Decision Makers", sprint: 3 },
  { href: "/outreach", label: "Outreach", sprint: 5 },
  { href: "/followups", label: "Follow-ups", sprint: 6 },
  { href: "/analytics", label: "Pipeline & Analytics", sprint: 4 },
  { href: "/settings", label: "Settings" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname() ?? "";
  const qc = useQueryClient();
  const { data: me, error } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace("/login");
  }, [error, router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    qc.clear();
    router.replace("/login");
  }

  return (
    <div className="grid min-h-screen grid-cols-[15rem_1fr]">
      <aside className="flex flex-col border-r border-line bg-surface">
        <div className="px-5 py-5">
          <p className="text-xs font-semibold text-ink-faint">AI SALES COPILOT</p>
          <p className="mt-1 truncate text-base font-semibold" title={me?.startup_name}>{me?.startup_name ?? "\u00A0"}</p>
        </div>
        <nav className="flex-1 px-2" aria-label="Main">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={`flex items-center justify-between border-l-[3px] px-3 py-2 text-sm ${active ? "border-accent bg-accent-wash font-semibold text-accent-dark" : "border-transparent text-ink-soft hover:bg-paper"}`}>
                <span>{n.label}</span>
                {n.sprint && <span className="text-[11px] text-ink-faint">soon</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-5 py-4 text-sm">
          <p className="truncate text-ink-soft" title={me?.email}>{me?.email}</p>
          <button onClick={logout} className="mt-1 font-medium text-accent hover:underline">Log out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end border-b border-line bg-surface px-8 py-3"><BudgetMeter /></header>
        <main className="mx-auto w-full max-w-[1080px] flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
