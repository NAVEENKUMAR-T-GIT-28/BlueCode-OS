import React, { useEffect, useState } from "react";
import { ApiRequestError, formatMoneyPaise } from "../api";
import { useRemote } from "../app/hooks";
import { navItems } from "../app/navigation";
import { AppMark, Button, EmptyState, ErrorState, Icon, LoadingState, Logo, StatusBadge } from "../components/shared";
import type { AppUser } from "../features/auth/auth.types";

type RecordValue = Record<string, any>;
type BrowserLocation = { pathname: string; search: string };
export function AppShell({ user, startupId, navigate, location, onLogout, setActiveWorkspace, renderContent }: {
  user: AppUser; startupId: string; navigate: (path: string, replace?: boolean) => void; location: BrowserLocation; onLogout: () => void; setActiveWorkspace: (id: string) => void; renderContent: (context: { path: string; search: string; startupId: string; startup: RecordValue; capabilities: RecordValue; navigate: (path: string) => void; reloadWorkspace: () => void; user: AppUser }) => React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const current = useRemote<{ startup: RecordValue }>("/api/v1/startups/current", startupId);
  const startup = current.data?.startup;
  const cap = startup?.capabilities || {};
  const spend = startup?.spend || {};
  const spendConfigured = typeof spend.capPaise === "number" && spend.capPaise > 0;
  const trialExpired = startup?.status === "trial_expired";
  const budgetExhausted = startup?.status === "budget_blocked" || (spendConfigured && typeof spend.remainingPaise === "number" && spend.remainingPaise <= 0);
  const activePath = location.pathname;
  useEffect(() => {
    if (current.error instanceof ApiRequestError && ["NOT_A_MEMBER", "UNAUTHENTICATED"].includes(current.error.code)) {
      setActiveWorkspace(""); navigate(current.error.code === "UNAUTHENTICATED" ? "/login" : "/workspaces", true);
    }
  }, [current.error, navigate, setActiveWorkspace]);
  const navTo = (path: string) => { navigate(path); setMenuOpen(false); };
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}><div className="sidebar-brand"><Logo light/><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close"/></button></div>
      <div className="sidebar-workspace"><span className="mini-avatar">{(startup?.name || "W").slice(0, 1).toUpperCase()}</span><span><b>{startup?.name || "Active workspace"}</b><small>{startup?.me?.role || "Workspace member"}</small></span><button aria-label="Switch workspace" onClick={() => navTo("/workspaces")}>⌄</button></div>
      <nav>{navItems.map((item) => { const active = activePath === item.path || (item.path === "/outreach" && activePath.startsWith("/outreach/")) || (item.path === "/prospects" && activePath.startsWith("/prospects/")) || (item.path === "/icps" && activePath.startsWith("/icps/")); return <button key={item.path} className={active ? "active" : ""} onClick={() => navTo(item.path)}><Icon name={item.icon} size={17}/><span>{item.label}</span></button>; })}</nav>
      <div className="sidebar-footer"><div className="avatar">{user.name?.trim().slice(0, 1).toUpperCase() || "U"}</div><div className="user-details"><b>{user.name || "Workspace user"}</b><small>{user.email}</small></div><button className="icon-button logout-button" aria-label="Sign out" title="Sign out" onClick={onLogout}><Icon name="logout" size={16}/></button></div>
    </aside>
    {menuOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <div className="app-main"><header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="topbar-context"><span className="topbar-breadcrumb">Workspace</span><span className="topbar-separator">/</span><b>{startup?.name || "Loading…"}</b></div><div className="top-actions"><span className="topbar-spend" title={spendConfigured ? "Remaining configured workspace budget, as reported by the API" : "A spend cap has not been configured"}>{spendConfigured ? `${formatMoneyPaise(spend.remainingPaise, "estimated")} remaining` : "Spend not configured"}</span><span className="topbar-plan">{startup?.plan ? String(startup.plan).toUpperCase() : "MVP PREVIEW"}</span><span className="avatar top-avatar" aria-label="Signed in as current user" title={user.email}>{user.name?.trim().slice(0, 1).toUpperCase() || "U"}</span></div></header>
      {startup && (trialExpired || budgetExhausted) && <div className="global-banner"><Icon name="info" size={17}/><span>{trialExpired ? "Your trial has ended. Existing data remains available, but some write actions may be blocked by the backend." : "This workspace has reached its configured usage limit. Paid actions may be blocked by the backend."}</span></div>}
      {current.loading && <div className="shell-loading"><LoadingState label="Verifying workspace access…"/></div>}
      {current.error && <div className="content"><ErrorState error={current.error} retry={current.reload}/><Button variant="secondary" onClick={() => navigate("/workspaces")}>Choose workspace</Button></div>}
      {startup && !current.error && <main className="content">{renderContent({ path: location.pathname, search: location.search, startupId, startup, capabilities: cap, navigate, reloadWorkspace: current.reload, user })}</main>}
    </div>
  </div>;
}

