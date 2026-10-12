import { FormEvent, useEffect, useState } from "react";
import { ApiRequestError, api, formatDate, formatDateTime, formatMoneyPaise, getId, isRecord, queryString, readError } from "../../api";
import { useMutation, useRemote } from "../../app/hooks";
import { Icon, Logo, Button, Badge, PageHeader, Field, TextArea, LoadingState, ErrorState, EmptyState, Notice, InlineFeedback, AppMark, StatusBadge, ScoreBadge, DataTable } from "../../components/shared";
import type { AppUser } from "../auth/auth.types";
import type { PageContext, RecordValue } from "../page-types";


export function NextActionsPage({ startupId, navigate }: PageContext) {
  const [status, setStatus] = useState("pending"); const actions = useRemote<RecordValue[]>(`/api/v1/next-actions${queryString({ status, sort: "priority" })}`, startupId); const mutation = useMutation();
  async function doAction(id: string, action: string) { const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/next-actions/${encodeURIComponent(id)}/${action}`, {}, startupId), action === "accept" ? "Recommendation accepted." : action === "complete" ? "Recommendation marked complete." : "Recommendation dismissed."); if (result) { actions.reload(); const nextRoute = action === "accept" ? result.next?.route : null; if (typeof nextRoute === "string" && nextRoute.startsWith("/")) navigate(nextRoute); } }
  const rows = actions.data || [];
  return <div className="page-stack"><PageHeader title="Next actions" description="Accept, dismiss, or complete recommendations. No outreach is executed automatically." action={<label className="compact-select"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="completed">Completed</option><option value="dismissed">Dismissed</option><option value="expired">Expired</option></select></label>}/>
    <Notice title="Recommendations are not automation">Accepting an action routes you to a relevant screen; it does not send a follow-up, book a meeting, or contact anyone.</Notice>{actions.loading && <LoadingState/>}{actions.error && <ErrorState error={actions.error} retry={actions.reload}/>}
    {actions.data && rows.length === 0 && <EmptyState title={`No ${status} recommendations`} description="The backend returns recommendations only when supported by recorded activity."/>}
    {actions.data && rows.length > 0 && <div className="action-cards">{rows.map((row) => <section className={`card next-card priority-${row.priority || "medium"}`} key={row.id}><span className="next-icon"><Icon name={row.actionType === "follow_up" ? "clock" : row.actionType === "review_prospect" ? "building" : "check-square"} size={19}/></span><div className="next-main"><div className="next-title"><h2>{row.title || actionLabel(row.actionType)}</h2><Badge tone={row.priority === "high" ? "red" : row.priority === "medium" ? "amber" : "neutral"}>{row.priority || "priority not reported"}</Badge></div><p>{row.reason || "No reason returned by the API."}</p><small>Prospect: {row.prospectId || "not linked"} Â· Due {formatDate(row.dueAt)}</small></div><div className="next-buttons">{row.status === "pending" && <><Button variant="ghost" onClick={() => void doAction(row.id, "dismiss")} loading={mutation.pending}>Dismiss</Button><Button variant="secondary" onClick={() => void doAction(row.id, "accept")} loading={mutation.pending}>Accept</Button><Button onClick={() => void doAction(row.id, "complete")} loading={mutation.pending}>Mark done</Button></>}{row.status !== "pending" && <StatusBadge value={row.status}/>}</div></section>)}</div>}
    <InlineFeedback error={mutation.error} success={mutation.success}/>
  </div>;
}

function actionLabel(value?: string) { return (value || "Recommendation").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
