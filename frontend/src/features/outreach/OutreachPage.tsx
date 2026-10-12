import { FormEvent, useEffect, useState } from "react";
import { ApiRequestError, api, formatDate, formatDateTime, formatMoneyPaise, getId, isRecord, queryString, readError } from "../../api";
import { useMutation, useRemote } from "../../app/hooks";
import { Icon, Logo, Button, Badge, PageHeader, Field, TextArea, LoadingState, ErrorState, EmptyState, Notice, InlineFeedback, AppMark, StatusBadge, ScoreBadge, DataTable } from "../../components/shared";
import type { AppUser } from "../auth/auth.types";
import type { PageContext, RecordValue } from "../page-types";
import { activityLabel } from "../shared/activityLabel";
import { DefinitionList } from "../shared/DefinitionList";



function CampaignForm({ startupId, navigate, onCreated }: { startupId: string; navigate: (path: string) => void; onCreated: () => void }) {
  const icps = useRemote<RecordValue[]>("/api/v1/icps?isActive=true&limit=100", startupId);
  const [name, setName] = useState(""); const [icpId, setIcpId] = useState(""); const [open, setOpen] = useState(false);
  const mutation = useMutation();
  useEffect(() => { if (!icpId && icps.data?.[0]?.id) setIcpId(icps.data[0].id); }, [icps.data, icpId]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const result = await mutation.execute(() => api.post<RecordValue>("/api/v1/campaigns", { name: name.trim(), icpId, channel: "email" }, startupId), "Campaign created.");
    if (result) { setName(""); setOpen(false); onCreated(); navigate(`/outreach/${encodeURIComponent(result.data.id)}`); }
  }
  return <section className="card panel"><div className="panel-heading"><div><h2>Campaigns</h2><p>Create email drafts grouped under an active ICP.</p></div><Button icon="plus" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "New campaign"}</Button></div>{open && <form className="inline-create-form" onSubmit={create}><Field label="Campaign name" value={name} onChange={setName} required minLength={1} maxLength={80} placeholder="e.g. Founder outreach"/><label className="field"><span>Active ICP</span><select value={icpId} onChange={(event) => setIcpId(event.target.value)} required><option value="">Select ICP</option>{(icps.data || []).map((icp) => <option key={icp.id} value={icp.id}>{icp.name}</option>)}</select></label><div className="inline-create-actions"><Button type="submit" loading={mutation.pending} disabled={!icpId}>Create campaign</Button><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button></div><InlineFeedback error={mutation.error}/>{icps.error && <InlineFeedback error={icps.error}/>}</form>}</section>;
}

export function OutreachPage({ path, startupId, navigate }: PageContext) {
  if (path === "/outreach/messages") return <MessagesListPage startupId={startupId} navigate={navigate}/>;
  if (path.startsWith("/outreach/messages/")) return <MessageEditorPage messageId={path.split("/")[3]} startupId={startupId} navigate={navigate}/>;
  if (path !== "/outreach") return <CampaignDetailPage campaignId={path.split("/")[2]} startupId={startupId} navigate={navigate}/>;
  return <OutreachListPage startupId={startupId} navigate={navigate}/>;
}

function OutreachListPage({ startupId, navigate }: { startupId: string; navigate: (path: string) => void }) {
  const list = useRemote<RecordValue[]>("/api/v1/campaigns?limit=100&sort=-createdAt", startupId);
  return <div className="page-stack"><PageHeader title="Outreach" description="Manage campaigns, drafts, approvals, and founder-controlled email handoff." action={<Button icon="mail" onClick={() => navigate("/outreach/messages")}>Message workspace</Button>}/>
    <Notice title="Human-controlled outreach">BlueCode OS does not send email, schedule sequences, read inboxes, or verify delivery. Approved drafts open through your own email app.</Notice>
    <CampaignForm startupId={startupId} navigate={navigate} onCreated={() => list.reload()}/>
    <CampaignTable rows={list.data || []} loading={list.loading} error={list.error} retry={list.reload} navigate={navigate}/>
  </div>;
}

function CampaignTable({ rows, loading, error, retry, navigate }: { rows: RecordValue[]; loading: boolean; error: unknown; retry: () => void; navigate: (path: string) => void }) {
  if (loading) return <LoadingState label="Loading campaignsâ€¦"/>;
  if (error) return <ErrorState error={error} retry={retry}/>;
  if (!rows.length) return <EmptyState title="No campaigns yet" description="Create a campaign from an active ICP to start organizing messages."/>;
  return <DataTable><thead><tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Created</th><th>Updated</th><th/></tr></thead><tbody>{rows.map((campaign) => <tr key={campaign.id}><td><div className="table-primary"><AppMark name={campaign.name}/><span><b>{campaign.name}</b><small>ICP {campaign.icpId}</small></span></div></td><td>{campaign.channel || "email"}</td><td><StatusBadge value={campaign.status}/></td><td>{formatDate(campaign.createdAt)}</td><td>{formatDate(campaign.updatedAt)}</td><td><Button variant="ghost" onClick={() => navigate(`/outreach/${encodeURIComponent(campaign.id)}`)}>Open</Button></td></tr>)}</tbody></DataTable>;
}

function CampaignDetailPage({ campaignId, startupId, navigate }: { campaignId: string; startupId: string; navigate: (path: string) => void }) {
  const campaign = useRemote<RecordValue>(`/api/v1/campaigns/${encodeURIComponent(campaignId)}`, startupId);
  const messages = useRemote<RecordValue[]>(`/api/v1/messages${queryString({ campaignId })}`, startupId);
  const mutation = useMutation();
  async function transition(action: string) { if (action === "cancel" && !window.confirm("Cancel this campaign? The backend will validate whether this state transition is allowed.")) return; const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/campaigns/${encodeURIComponent(campaignId)}/${action}`, {}, startupId), "Campaign status updated."); if (result) { campaign.reload(); messages.reload(); } }
  const item = campaign.data || {};
  const allowedActions: Record<string, string[]> = {
    draft: ["submit", "cancel"], pending_approval: ["approve", "cancel"], approved: ["pause", "complete", "cancel"], active: ["pause", "complete", "cancel"], paused: ["resume", "complete", "cancel"],
  };
  const labels: Record<string, string> = { submit: "Submit for approval", approve: "Approve campaign", pause: "Pause", resume: "Resume", complete: "Complete", cancel: "Cancel" };
  return <div className="page-stack"><button className="back-link" onClick={() => navigate("/outreach")}>â† Back to campaigns</button>{campaign.loading && <LoadingState/>}{campaign.error && <ErrorState error={campaign.error} retry={campaign.reload}/>}
    {campaign.data && <><PageHeader title={item.name || "Campaign"} description={`Email campaign Â· created ${formatDate(item.createdAt)}`} action={<StatusBadge value={item.status}/>}/><Notice title="Campaign state is not a sending state">Campaign approval and lifecycle status do not schedule or send messages. Handoff is recorded per message when you request an email-app handoff; delivery is never verified here.</Notice><section className="card panel"><div className="panel-heading"><div><h2>Campaign actions</h2><p>Only state transitions allowed by the backend are available.</p></div></div><div className="button-row">{(allowedActions[item.status] || []).map((action) => <Button key={action} variant={action === "cancel" ? "danger" : action === "approve" ? "primary" : "secondary"} onClick={() => void transition(action)} loading={mutation.pending}>{labels[action]}</Button>)}</div><InlineFeedback error={mutation.error} success={mutation.success}/></section>
      <section className="card panel"><div className="panel-heading"><div><h2>Messages</h2><p>Review each draft and its approval state.</p></div><Button onClick={() => navigate("/outreach/messages")}>Open message workspace</Button></div>{messages.loading && <LoadingState/>}{messages.error && <ErrorState error={messages.error} retry={messages.reload}/>}{messages.data && messages.data.length > 0 ? <DataTable><thead><tr><th>Message</th><th>Step</th><th>Approval</th><th>Status</th><th>Updated</th><th/></tr></thead><tbody>{messages.data.map((message) => <tr key={message.id}><td><b>{message.subject || "Untitled draft"}</b><small className="cell-subtitle">Recipient ID: {message.decisionMakerId}</small></td><td>{message.step}</td><td><StatusBadge value={message.approvalStatus}/></td><td><StatusBadge value={message.status}/></td><td>{formatDate(message.updatedAt)}</td><td><Button variant="ghost" onClick={() => navigate(`/outreach/messages/${encodeURIComponent(message.id)}`)}>Edit / review</Button></td></tr>)}</tbody></DataTable> : !messages.loading && !messages.error ? <EmptyState title="No messages in this campaign" description="Open the message workspace and create a draft with a saved contact." action={<Button onClick={() => navigate("/outreach/messages")}>Create draft</Button>}/> : null}</section></>}   
  </div>;
}

function MessagesListPage({ startupId, navigate }: { startupId: string; navigate: (path: string) => void }) {
  const messages = useRemote<RecordValue[]>("/api/v1/messages?limit=100&sort=-createdAt", startupId);
  const campaigns = useRemote<RecordValue[]>("/api/v1/campaigns?limit=100", startupId);
  const prospects = useRemote<RecordValue[]>("/api/v1/prospects?limit=100", startupId);
  const [campaignId, setCampaignId] = useState(""); const [prospectId, setProspectId] = useState(""); const [contactId, setContactId] = useState(""); const [step, setStep] = useState("1"); const [contactOptions, setContactOptions] = useState<RecordValue[]>([]); const [contactLoading, setContactLoading] = useState(false); const [contactError, setContactError] = useState<Error | null>(null);
  const mutation = useMutation();
  useEffect(() => { if (!campaignId && campaigns.data?.[0]?.id) setCampaignId(campaigns.data[0].id); }, [campaigns.data, campaignId]);
  useEffect(() => { if (!prospectId && prospects.data?.length) { const eligible = prospects.data.find((item) => item.status !== "do_not_contact"); if (eligible?.id) setProspectId(eligible.id); } }, [prospects.data, prospectId]);
  useEffect(() => {
    if (!prospectId) { setContactOptions([]); setContactId(""); return; }
    let live = true; setContactLoading(true); setContactError(null); setContactOptions([]); setContactId("");
    api.get<RecordValue[]>(`/api/v1/prospects/${encodeURIComponent(prospectId)}/decision-makers`, startupId).then((response) => { if (live) { setContactOptions(response.data || []); const eligible = (response.data || []).find((candidate: RecordValue) => Boolean(candidate.businessEmail) && candidate.outreachStatus !== "do_not_contact"); setContactId(eligible?.id || ""); } }).catch((error: unknown) => { if (live) setContactError(error instanceof Error ? error : new Error(String(error))); }).finally(() => { if (live) setContactLoading(false); });
    return () => { live = false; };
  }, [prospectId, startupId]);
  async function draft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const result = await mutation.execute(() => api.post<RecordValue>("/api/v1/messages/draft", { campaignId, decisionMakerId: contactId, step: Number(step), regenerate: false }, startupId), "Draft ready for review.");
    if (result) navigate(`/outreach/messages/${encodeURIComponent(result.data.id)}`);
  }
  return <div className="page-stack"><PageHeader title="Message workspace" description="Create, edit, approve, and hand off messages with human review." action={<Button variant="secondary" onClick={() => navigate("/outreach")}>Back to outreach</Button>}/>
    <Notice title="Drafts are not sent automatically">Mock message drafts are fixtures, not verified AI personalization. Review every fact, then get approval before opening your email app.</Notice>
    <section className="card panel"><div className="section-heading"><h2>Create a message draft</h2><p>Choose an existing campaign, prospect, and manually saved contact.</p></div><form className="form-grid" onSubmit={draft}><label className="field"><span>Campaign</span><select required value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">Choose campaign</option>{(campaigns.data || []).map((item) => <option key={item.id} value={item.id}>{item.name} Â· {item.status}</option>)}</select></label><label className="field"><span>Prospect</span><select required value={prospectId} onChange={(event) => setProspectId(event.target.value)}><option value="">Choose prospect</option>{(prospects.data || []).map((item) => <option key={item.id} value={item.id} disabled={item.status === "do_not_contact"}>{item.name} Â· {item.status}{item.status === "do_not_contact" ? " Â· DNC" : ""}</option>)}</select></label><label className="field"><span>Saved contact</span><select required value={contactId} onChange={(event) => setContactId(event.target.value)}><option value="">Choose contact</option>{contactOptions.map((item) => <option key={item.id} value={item.id} disabled={item.outreachStatus === "do_not_contact" || !item.businessEmail}>{item.fullName} Â· {item.businessEmail || "No email"}{item.outreachStatus === "do_not_contact" ? " Â· DNC" : !item.businessEmail ? " Â· Email required" : ""}</option>)}</select>{contactLoading && <small className="field-help">Loading saved contactsâ€¦</small>}{contactError ? <small className="field-error">{readError(contactError)}</small> : null}{!contactLoading && !contactError && prospectId && contactOptions.length === 0 && <small className="field-help">No saved contacts. Open the prospect and add one manually.</small>}</label><label className="field"><span>Message step</span><select value={step} onChange={(event) => setStep(event.target.value)}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>Step {value}</option>)}</select></label><div className="form-actions form-actions-wide"><Button type="submit" loading={mutation.pending} disabled={!campaignId || !contactId || Boolean(contactOptions.find((c) => c.id === contactId && (c.outreachStatus === "do_not_contact" || !c.businessEmail)))}>Create draft</Button></div><InlineFeedback error={mutation.error} success={mutation.success}/></form></section>
    <section className="card panel"><div className="panel-heading"><div><h2>Saved messages</h2><p>Filter by status from the list in the API response.</p></div><Button variant="secondary" icon="refresh" onClick={messages.reload}>Refresh</Button></div>{messages.loading && <LoadingState/>}{messages.error && <ErrorState error={messages.error} retry={messages.reload}/>}{messages.data && messages.data.length > 0 ? <DataTable><thead><tr><th>Subject</th><th>Step / revision</th><th>Approval</th><th>Status</th><th>Updated</th><th/></tr></thead><tbody>{messages.data.map((item) => <tr key={item.id}><td><b>{item.subject || "Untitled message"}</b><small className="cell-subtitle">Campaign ID: {item.campaignId}</small></td><td>{item.step} / {item.revision}</td><td><StatusBadge value={item.approvalStatus}/></td><td><StatusBadge value={item.status}/></td><td>{formatDate(item.updatedAt)}</td><td><Button variant="ghost" onClick={() => navigate(`/outreach/messages/${encodeURIComponent(item.id)}`)}>Open</Button></td></tr>)}</tbody></DataTable> : !messages.loading && !messages.error ? <EmptyState title="No messages yet" description="Use the form above to create the first draft from a saved contact."/> : null}</section>
  </div>;
}

function MessageEditorPage({ messageId, startupId, navigate }: { messageId: string; startupId: string; navigate: (path: string) => void }) {
  const message = useRemote<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}`, startupId);
  const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [confirmHandoff, setConfirmHandoff] = useState(false); const [handoff, setHandoff] = useState<RecordValue | null>(null); const [mailtoMissingBody, setMailtoMissingBody] = useState(false); const [handoffAttempted, setHandoffAttempted] = useState(false);
  const mutation = useMutation();
  useEffect(() => { if (message.data) { setSubject(message.data.subject || ""); setBody(message.data.body || ""); } }, [message.data]);
  const item = message.data || {};
  const prospectContext = useRemote<RecordValue>(item.prospectId ? `/api/v1/prospects/${encodeURIComponent(item.prospectId)}` : null, startupId);
  const sourceProspect = prospectContext.data?.prospect || {};
  const sourceContact = (prospectContext.data?.contacts || []).find((contact: RecordValue) => contact.id === item.decisionMakerId) || {};
  const dirty = Boolean(message.data && (subject !== (item.subject || "") || body !== (item.body || "")));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const payload: RecordValue = {}; if (subject !== (item.subject || "")) payload.subject = subject; if (body !== (item.body || "")) payload.body = body;
    if (!Object.keys(payload).length) { mutation.setSuccess("No changes to save."); return; }
    const result = await mutation.execute(() => api.patch<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}`, payload, startupId), "Draft saved. Any previous approval may have been reset by the server."); if (result) message.reload();
  }
  async function messageAction(action: string, bodyValue: unknown = {}) {
    const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}/${action}`, bodyValue, startupId), action === "approve" ? "Message approved." : action === "request-revision" ? "Revision requested." : action === "reject" ? "Message rejected." : "Message updated."); if (result) message.reload();
  }
  async function requestHandoff() {
    const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}/handoff`, {}, startupId));
    if (result && result.data?.handoff) { setHandoff(result.data.handoff); setMailtoMissingBody(false); setHandoffAttempted(false); setConfirmHandoff(true); }
  }
  function openMailApp() {
    if (!handoff) return;
    setHandoffAttempted(true);
    const encode = (value: string) => encodeURIComponent(value);
    // Keep the validated address intact in the mailto path; encode only query values.
    const recipient = String(handoff.to || "").trim().replace(/[\r\n?]/g, "");
    const fullUrl = `mailto:${recipient}?subject=${encode(handoff.subject || "")}&body=${encode(String(handoff.body || "").replace(/\r?\n/g, "\r\n"))}`;
    const subjectOnly = `mailto:${recipient}?subject=${encode(handoff.subject || "")}`;
    if (fullUrl.length > 1800) {
      void navigator.clipboard?.writeText(`To: ${handoff.to || ""}\nSubject: ${handoff.subject || ""}\n\n${handoff.body || ""}`).catch(() => undefined);
      setMailtoMissingBody(true); window.location.href = subjectOnly;
    } else window.location.href = fullUrl;
  }
  function closeHandoff() { setConfirmHandoff(false); message.reload(); }
  async function reportSent() { const result = await mutation.execute(() => api.post<RecordValue>(`/api/v1/messages/${encodeURIComponent(messageId)}/mark-sent`, {}, startupId), "Marked sent by you. BlueCode cannot verify sending or delivery."); if (result) { setConfirmHandoff(false); message.reload(); } }
  async function copyHandoff() { if (!handoff) return; const text = `To: ${handoff.to || ""}\nSubject: ${handoff.subject || ""}\n\n${handoff.body || ""}`; try { await navigator.clipboard.writeText(text); mutation.setSuccess("Email text copied to clipboard."); } catch { mutation.setSuccess("Clipboard access was blocked. Select and copy the To, subject, and body from your email preview."); } }
  if (message.loading) return <div className="page-stack"><Button variant="ghost" onClick={() => navigate("/outreach/messages")}>â† Back to messages</Button><LoadingState/></div>;
  if (message.error) return <div className="page-stack"><Button variant="ghost" onClick={() => navigate("/outreach/messages")}>â† Back to messages</Button><ErrorState error={message.error} retry={message.reload}/></div>;
  const canEdit = item.status === "draft" && item.approvalStatus !== "approved";
  const dnc = sourceProspect.status === "do_not_contact" || sourceContact.outreachStatus === "do_not_contact";
  return <div className="page-stack"><button className="back-link" onClick={() => navigate("/outreach/messages")}>â† Back to message workspace</button><PageHeader title="Edit message" description={`Step ${item.step ?? "â€”"} Â· Revision ${item.revision ?? "â€”"}`} action={<StatusBadge value={item.status}/>}/>
    <Notice title="Check the facts before approval">A draft is a starting point, not verified AI research. Editing is controlled by the API and may reset approval.</Notice>
    {prospectContext.loading && <Notice title="Checking outreach eligibility">Verifying the current prospect and contact do-not-contact status before allowing email handoff.</Notice>}{prospectContext.error && <Notice tone="danger" title="Cannot verify outreach eligibility">The prospect status could not be checked. Email handoff stays disabled until the current do-not-contact status can be confirmed.</Notice>}{dnc && <Notice tone="danger" title="Outreach is blocked">This message's prospect or contact is marked do-not-contact. Do not hand off this message.</Notice>}
    <div className="editor-grid"><section className="card panel editor-meta"><div className="section-heading"><h2>Message details</h2><p>Backend-owned identifiers and state.</p></div><DefinitionList rows={[["Campaign ID", item.campaignId], ["Prospect ID", item.prospectId], ["Contact ID", item.decisionMakerId], ["Step", item.step], ["Revision", item.revision], ["Approval", item.approvalStatus]]}/><div className="approval-steps"><div className="approval-step"><span className="done"><Icon name="check" size={15}/></span><div><b>Draft</b><small>{formatDateTime(item.createdAt)}</small></div></div><div className="approval-step"><span className={item.approvalStatus === "approved" ? "done" : ""}>{item.approvalStatus === "approved" ? <Icon name="check" size={15}/> : "2"}</span><div><b>Human approval</b><small>{item.approvalStatus === "approved" ? "Approved by a workspace user" : "Required before handoff"}</small></div></div><div className="approval-step"><span className={item.status === "handed_off" || item.status === "user_reported_sent" ? "done" : ""}>3</span><div><b>Email handoff</b><small>Opens your email app only</small></div></div></div></section>
      <form className="card panel editor" onSubmit={save}><div className="editor-top"><div><Badge tone={item.approvalStatus === "approved" ? "green" : "amber"}>{item.approvalStatus === "approved" ? "Approved" : item.approvalStatus || "Pending review"}</Badge><span>{dirty ? "Unsaved changes" : `Updated ${formatDate(item.updatedAt)}`}</span></div></div><Field label="Subject" value={subject} onChange={setSubject} required maxLength={200} placeholder="Email subject"/><TextArea label="Email body" value={body} onChange={setBody} required maxLength={5000} rows={12} placeholder="Review the message textâ€¦"/><div className="editor-actions"><Button type="submit" loading={mutation.pending} disabled={!canEdit || !dirty}>Save changes</Button>{item.approvalStatus !== "approved" && <Button variant="secondary" onClick={() => void messageAction("approve")} loading={mutation.pending} disabled={dirty || !subject.trim() || !body.trim() || item.status === "cancelled"}>Approve</Button>}</div><InlineFeedback error={mutation.error} success={mutation.success}/>{item.approvalStatus === "approved" && !["cancelled", "handed_off", "user_reported_sent"].includes(item.status) && <div className="handoff-actions"><Button icon="mail" onClick={() => void requestHandoff()} loading={mutation.pending} disabled={dirty || dnc || prospectContext.loading || Boolean(prospectContext.error) || !prospectContext.data || !item.subject || !item.body}>Open in my email app</Button><span>BlueCode prepares a mailto handoff; it never sends the email.</span></div>}{item.approvalStatus !== "approved" && item.status === "draft" && <div className="editor-secondary-actions"><Button variant="ghost" onClick={() => { const note = window.prompt("What needs to change? (1â€“500 characters)"); if (note?.trim()) void messageAction("request-revision", { note: note.trim() }); }} disabled={mutation.pending}>Request revision</Button><Button variant="ghost" onClick={() => { const reason = window.prompt("Optional rejection reason"); if (reason !== null) void messageAction("reject", { reason }); }} disabled={mutation.pending}>Reject draft</Button></div>}</form></div>
    {confirmHandoff && handoff && <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><button className="modal-close icon-button" aria-label="Close" onClick={closeHandoff}><Icon name="close"/></button><div className="modal-icon"><Icon name="mail" size={23}/></div><h2 id="handoff-title">Email handoff prepared</h2><p>BlueCode has recorded a handoff request. Use the button below to ask your device to open the email app, or copy the text. The browser cannot verify that an app opened, that you sent the message, or that it was delivered.</p><div className="handoff-preview"><div><small>To</small><b>{handoff.to || "â€”"}</b></div><div><small>Subject</small><b>{handoff.subject || "â€”"}</b></div><div><small>Body preview</small><p>{String(handoff.body || "").slice(0, 360)}{String(handoff.body || "").length > 360 ? "â€¦" : ""}</p></div></div>{mailtoMissingBody && <Notice tone="warning">The email was long. Its body was copied where clipboard permission allowed; paste it into your email app.</Notice>}<div className="modal-actions"><Button variant="secondary" onClick={() => void copyHandoff()}>Copy email text</Button><Button onClick={openMailApp}>Open email app</Button></div>{handoffAttempted && <div className="modal-actions"><Button variant="ghost" onClick={closeHandoff}>Close</Button><Button variant="secondary" onClick={() => void reportSent()} loading={mutation.pending}>I sent it</Button></div>}<small className="field-help">â€œI sent itâ€ records your report only, not email delivery confirmation.</small><InlineFeedback error={mutation.error} success={mutation.success}/></div></div>}
  </div>;
}
