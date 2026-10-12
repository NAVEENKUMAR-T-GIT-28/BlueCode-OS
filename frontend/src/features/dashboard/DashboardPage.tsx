import { FormEvent, useEffect, useState } from "react";
import { ApiRequestError, api, formatDate, formatDateTime, formatMoneyPaise, getId, isRecord, queryString, readError } from "../../api";
import { useMutation, useRemote } from "../../app/hooks";
import { Icon, Logo, Button, Badge, PageHeader, Field, TextArea, LoadingState, ErrorState, EmptyState, Notice, InlineFeedback, AppMark, StatusBadge, ScoreBadge, DataTable } from "../../components/shared";
import type { AppUser } from "../auth/auth.types";
import type { PageContext, RecordValue } from "../page-types";
import { MetricCard } from "../shared/MetricCard";


export function DashboardPage({ startupId, navigate, user }: PageContext) {
  const remote = useRemote<RecordValue>("/api/v1/dashboard", startupId);
  const summary = useRemote<RecordValue>("/api/v1/usage/summary", startupId);
  const dashboard = remote.data || {};
  const today = dashboard.today || {};
  const funnel = dashboard.funnel || {};
  const stages = [
    ["Discovered", funnel.discovered], ["Qualified", funnel.qualified], ["With email", funnel.contactsWithEmail],       
    ["Approved", funnel.approvedDrafts], ["Handoff requested", funnel.handedOff], ["Marked sent by you", funnel.userReportedSent], ["Replies logged", funnel.repliesLogged],
  ] as [string, unknown][];
  const maxValue = Math.max(1, ...stages.map(([, v]) => typeof v === "number" ? v : 0));
  const usage = summary.data || {};
  return <div className="page-stack"><PageHeader title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`} description="A grounded snapshot of what your workspace has recorded." action={<Button icon="plus" onClick={() => navigate("/icps/new")}>Create ICP</Button>}/>
    {remote.loading && <LoadingState/>}{Boolean(remote.error) && (<ErrorState error={remote.error} retry={remote.reload}/>)}
    {remote.data && <>
      <div className="metrics">
        <MetricCard label="Prospects found" value={today.prospectsFound} icon="building" detail="Recorded in this workspace"/>
        <MetricCard label="Hot & high fit" value={today.hotAndHigh} icon="target" detail="Rules-based estimates"/>      
        <MetricCard label="Drafts awaiting approval" value={today.draftsPendingApproval} icon="mail" detail="Human review required"/>
        <MetricCard label="Ready for email handoff" value={today.readyForHandoff} icon="send" detail="Not sent automatically"/>
      </div>
      <div className="dash-grid">
        <section className="card panel"><div className="panel-heading"><div><h2>Recorded outreach funnel</h2><p>These are workspace events, not delivery analytics.</p></div><Badge>API reported</Badge></div>
          <div className="funnel honest-funnel">{stages.map(([label, raw]) => { const count = typeof raw === "number" ? raw : 0; return <div className="funnel-row" key={label}><span>{label}</span><div className="funnel-bar"><i style={{ width: `${Math.max(count > 0 ? 2 : 0, (count / maxValue) * 100)}%` }}/></div><b>{typeof raw === "number" ? raw : "â€”"}</b></div>; })}</div>
          <p className="footnote">â€œMarked sent by youâ€ is founder-reported. BlueCode cannot verify sending or delivery.</p>
        </section>
        <section className="card panel"><div className="panel-heading"><div><h2>Next actions</h2><p>Recommendations are never executed automatically.</p></div><button className="text-button" onClick={() => navigate("/next-actions")}>View all <Icon name="arrow" size={14}/></button></div>
          <div className="action-list">{Array.isArray(dashboard.topActions) && dashboard.topActions.length ? dashboard.topActions.slice(0, 5).map((action: RecordValue) => <div className="action-item" key={action.id}><span className={`action-dot ${action.priority === "high" ? "amber" : "blue"}`}/><div><b>{action.title || "Recommendation"}</b><small>{action.reason || action.actionType || "Review the suggested next step"}</small></div><button className="text-button" onClick={() => navigate("/next-actions")}>Review</button></div>) : <EmptyState title="No pending recommendations" description="New suggestions appear when supported by recorded workspace activity."/>}</div>
        </section>
      </div>
      <div className="dash-grid lower">
        <section className="card panel"><div className="panel-heading"><div><h2>Start with the essentials</h2><p>A simple workflow for a new workspace.</p></div></div><div className="checklist"><ChecklistItem step="01" title="Create an ideal customer profile" description="Define the criteria used to qualify stored prospects." onClick={() => navigate("/icps/new")}/><ChecklistItem step="02" title="Review prospect records" description="Search and qualify companies already in your workspace." onClick={() => navigate("/prospects")}/><ChecklistItem step="03" title="Prepare approved outreach" description="Create drafts, review them, then use your email app." onClick={() => navigate("/outreach")}/></div></section>     
        <section className="card panel"><div className="panel-heading"><div><h2>Usage overview</h2><p>Values reported by the API.</p></div><button className="text-button" onClick={() => navigate("/usage")}>Details <Icon name="arrow" size={14}/></button></div>{summary.loading && <LoadingState label="Loading usageâ€¦"/>}{summary.error && <ErrorState error={summary.error} retry={summary.reload} compact/>}{usage.spend && <><div className="usage-highlight"><span>Remaining configured budget</span><strong>{typeof usage.spend.capPaise === "number" && usage.spend.capPaise > 0 ? formatMoneyPaise(usage.spend.remainingPaise, usage.spend.costType) : "Not configured"}</strong><small>{typeof usage.spend.capPaise === "number" && usage.spend.capPaise > 0 ? `Cost type: ${usage.spend.costType || "not specified"}` : "The workspace spend cap has not been frozen."}</small></div><div className="usage-row"><span>Trial days left</span><b>{typeof usage.trialDaysLeft === "number" ? usage.trialDaysLeft : "Not reported"}</b></div><div className="usage-row"><span>ICP entitlement</span><b>{usage.entitlements?.icps?.limit == null ? `${usage.entitlements?.icps?.used ?? "â€”"} used Â· limit unconfigured` : `${usage.entitlements.icps.used} / ${usage.entitlements.icps.limit}`}</b></div></>}</section>
      </div>
    </>}
  </div>;
}



function ChecklistItem({ step, title, description, onClick }: { step: string; title: string; description: string; onClick: () => void }) {
  return <button className="checklist-item" onClick={onClick}><span>{step}</span><div><b>{title}</b><small>{description}</small></div><Icon name="arrow" size={16}/></button>;
}
