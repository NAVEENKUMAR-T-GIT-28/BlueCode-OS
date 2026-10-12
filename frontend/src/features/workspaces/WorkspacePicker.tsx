import { FormEvent, useState } from "react";
import { api, getId } from "../../api";
import { useMutation, useRemote } from "../../app/hooks";
import { AppMark, Button, EmptyState, ErrorState, Field, Icon, InlineFeedback, LoadingState, Logo, StatusBadge } from "../../components/shared";
type RecordValue = Record<string, any>;
export function WorkspacePicker({ navigate, setActiveWorkspace, activeWorkspaceId }: { navigate: (path: string) => void; setActiveWorkspace: (id: string) => void; activeWorkspaceId: string }) {
  const { data, loading, error, reload } = useRemote<{ startups: RecordValue[] }>("/api/v1/startups");
  const [creating, setCreating] = useState(false); const [name, setName] = useState("");
  const create = useMutation();
  const rows = data?.startups || [];
  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await create.execute(() => api.post<RecordValue>("/api/v1/startups", { name: name.trim() }), "Workspace created.");
    if (response) { const id = getId(response.data); if (id) { setActiveWorkspace(id); navigate("/dashboard"); } else reload(); }
  }
  return <main className="center-shell"><div className="workspace-wrap"><Logo/><div className="workspace-heading"><div><h1>{creating ? "Create a workspace" : "Choose a workspace"}</h1><p>{creating ? "A workspace keeps your sales data separated from other teams." : "Select a workspace to continue."}</p></div>{!creating && <Button icon="plus" onClick={() => { setCreating(true); setName(""); }}>Create workspace</Button>}</div>
    {loading && <LoadingState label="Loading your workspaces…"/>}{error && <ErrorState error={error} retry={reload}/>}
    {!loading && !error && !creating && rows.length === 0 && <EmptyState title="No workspace yet" description="Create your first workspace to keep your customer profiles and outreach together." action={<Button icon="plus" onClick={() => setCreating(true)}>Create workspace</Button>}/>}
    {!loading && !error && !creating && rows.length > 0 && <div className="workspace-list">{rows.map((workspace) => { const id = getId(workspace); return <button className={`workspace-card ${activeWorkspaceId === id ? "workspace-card-selected" : ""}`} key={id || workspace.startupName} onClick={() => { if (id) { setActiveWorkspace(id); navigate("/dashboard"); } }}><span className="workspace-avatar"><AppMark name={workspace.startupName}/></span><span><b>{workspace.startupName || workspace.name || "Workspace"}</b><small>{workspace.role || "Member"} · {workspace.plan || "Plan not specified"}</small></span><StatusBadge value={workspace.startupStatus || workspace.status || "unknown"}/><Icon name="chevron" size={18}/></button>; })}</div>}
    {creating && <form className="card form-card workspace-create" onSubmit={createWorkspace}><Field label="Workspace name" value={name} onChange={setName} placeholder="e.g. Acme Ventures" required minLength={1} maxLength={80}/><p className="field-help">Creating a workspace does not configure or promise a specific spend cap.</p><InlineFeedback error={create.error} success={create.success}/><div className="form-actions"><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" loading={create.pending}>Create workspace</Button></div></form>}
    <p className="workspace-note"><Icon name="info" size={15}/> API permissions and workspace membership are validated by the server.</p>
  </div></main>;
}

