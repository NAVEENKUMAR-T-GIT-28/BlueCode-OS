"use client";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError, inr, type Mailbox, type Settings, type Usage } from "@/lib/api";

const errText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Try again.");

export default function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") });
  const usage = useQuery({ queryKey: ["usage"], queryFn: () => api<Usage>("/usage") });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Settings>("/settings", { method: "PUT", json: body }),
    onSuccess: (data) => { qc.setQueryData(["settings"], data); qc.invalidateQueries({ queryKey: ["me"] }); },
  });

  if (settings.isLoading) return <p className="text-ink-soft">Loading…</p>;
  if (!settings.data) return <p role="alert" className="text-danger">{errText(settings.error)}</p>;
  const s = settings.data;

  return (
    <div className="max-w-2xl space-y-12">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Section title="Company and sender" note="This identity appears in the footer of every email you send.">
        <form key={s.company_name + s.sender_name + s.sender_address + s.booking_link} className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({ company_name: f.get("company_name"), sender_name: f.get("sender_name") || null,
              sender_address: f.get("sender_address") || null, booking_link: f.get("booking_link") || null });
          }}>
          <Field name="company_name" label="Company name" defaultValue={s.company_name} required />
          <Field name="sender_name" label="Sender name" defaultValue={s.sender_name ?? ""} hint="Shown as the sender, e.g. Asha from Acme." />
          <Field name="sender_address" label="Postal address" defaultValue={s.sender_address ?? ""} hint="Required in commercial email footers in many countries." />
          <Field name="booking_link" label="Booking link" defaultValue={s.booking_link ?? ""} placeholder="https://calendly.com/you/intro" hint="Added to replies when a prospect is interested. Must start with https://" />
          <SaveBar pending={save.isPending} error={save.isError ? errText(save.error) : null} />
        </form>
      </Section>

      <Section title="Sending mailbox (SMTP)" note="Emails go out from your own mailbox. Passwords are encrypted and never shown again.">
        <MailboxForm kind="smtp" current={s.smtp} defaults={{ port: "465" }} save={save} />
      </Section>
      <Section title="Reply mailbox (IMAP)" note="Used to detect replies. Often the same account as above.">
        <MailboxForm kind="imap" current={s.imap} defaults={{ port: "993" }} save={save} />
      </Section>

      <Section title="Plan and usage" note={`Pilot plan. Status: ${s.status}.`}>
        {usage.data && (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-soft">API budget</dt><dd>{inr(usage.data.spent_minor + usage.data.reserved_minor)} of {inr(usage.data.cap_minor)} used</dd>
            <dt className="text-ink-soft">Trial</dt><dd>{usage.data.trial_days_left} days left</dd>
            <dt className="text-ink-soft">Prospects found</dt><dd>{usage.data.prospects_used}</dd>
            <dt className="text-ink-soft">Decision-maker lookups</dt><dd>{usage.data.dm_lookups_used}</dd>
            <dt className="text-ink-soft">Messages written</dt><dd>{usage.data.messages_generated}</dd>
            <dt className="text-ink-soft">Emails sent</dt><dd>{usage.data.emails_sent}</dd>
          </dl>
        )}
        <p className="hint mt-3">Billing and paid tiers arrive after the pilot.</p>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="mb-4 mt-1 text-sm text-ink-soft">{note}</p>}
      {children}
    </section>
  );
}

function Field({ name, label, hint, ...rest }: { name: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} className="field" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function SaveBar({ pending, error, ok }: { pending: boolean; error: string | null; ok?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
      {ok && <span role="status" className="text-sm text-accent-dark">{ok}</span>}
    </div>
  );
}

function MailboxForm({ kind, current, defaults, save }: { kind: "smtp" | "imap"; current: Mailbox; defaults: { port: string }; save: UseMutationResult<Settings, Error, Record<string, unknown>> }) {
  const [ok, setOk] = useState<string | null>(null);
  const [editing, setEditing] = useState(!current.configured);

  if (current.configured && !editing) {
    return (
      <div className="flex items-center justify-between rounded-md border border-line bg-surface px-4 py-3 text-sm">
        <span>{current.readable ? <>Connected as <b>{current.username}</b> on {current.host}:{current.port}</> : "Saved, but unreadable with the current server key. Enter it again."}</span>
        <span className="flex gap-3">
          <button className="font-medium text-accent hover:underline" onClick={() => setEditing(true)}>Change</button>
          <button className="font-medium text-danger hover:underline" onClick={() => save.mutate({ [kind]: null }, { onSuccess: () => setEditing(true) })}>Remove</button>
        </span>
      </div>
    );
  }
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      setOk(null);
      save.mutate({ [kind]: { host: f.get("host"), port: Number(f.get("port")), username: f.get("username"), password: f.get("password"), security: f.get("security") } },
        { onSuccess: () => { setOk("Saved."); setEditing(false); } });
    }}>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field name="host" label="Host" placeholder={`${kind}.example.com`} required defaultValue={current.host} />
        <Field name="port" label="Port" inputMode="numeric" required defaultValue={current.port?.toString() ?? defaults.port} />
      </div>
      <Field name="username" label="Username" required autoComplete="off" defaultValue={current.username} />
      <Field name="password" label="Password or app password" type="password" required autoComplete="new-password" hint="Gmail and Google Workspace need an app password, not your normal one." />
      <div>
        <label htmlFor="security" className="label">Security</label>
        <select id="security" name="security" className="field" defaultValue={current.security ?? "ssl"}>
          <option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option><option value="none">None (not recommended)</option>
        </select>
      </div>
      <SaveBar pending={save.isPending} error={save.isError ? errText(save.error) : null} ok={ok} />
    </form>
  );
}
