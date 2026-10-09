"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import ChipInput from "@/components/ChipInput";
import { api, ApiError, type Criteria, type Icp } from "@/lib/api";

const MIN_CHARS = 10;
const num = (s: string) => (s.trim() === "" ? null : Math.max(1, parseInt(s, 10) || 1));
const errText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Try again.");

export default function IcpPage() {
  const qc = useQueryClient();
  const icps = useQuery({ queryKey: ["icps"], queryFn: () => api<Icp[]>("/icps") });
  const [notes, setNotes] = useState<string[]>([]);
  const icp = icps.data?.[0];

  const create = useMutation({
    mutationFn: (product_description: string) => api<Icp>("/icps", { method: "POST", json: { product_description } }),
    onSuccess: (data) => { setNotes(data.notes); qc.setQueryData(["icps"], [data]); qc.invalidateQueries({ queryKey: ["usage"] }); },
  });

  if (icps.isLoading) return <p className="text-ink-soft">Loading…</p>;
  if (icps.isError) return <p role="alert" className="text-danger">{errText(icps.error)}</p>;

  if (!icp) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold">Who do you sell to?</h1>
        <p className="mt-2 text-ink-soft">Describe your product and your ideal buyer in a few sentences. We turn it into search criteria you can edit before anything runs.</p>
        <DescriptionForm busy={create.isPending} error={create.isError ? errText(create.error) : null}
          cta="Build my ICP" onSubmit={(d) => create.mutate(d)} />
        {create.isPending && <p className="mt-3 text-sm text-ink-soft" role="status">Reading your description. This can take up to a minute with a local model.</p>}
      </div>
    );
  }
  return <Workspace icp={icp} notes={notes} setNotes={setNotes} />;
}

function DescriptionForm({ initial = "", cta, busy, error, onSubmit }: { initial?: string; cta: string; busy: boolean; error: string | null; onSubmit: (d: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <form className="mt-5" onSubmit={(e) => { e.preventDefault(); onSubmit(text.trim()); }}>
      <label htmlFor="desc" className="label">Product and ideal buyer</label>
      <textarea id="desc" className="field min-h-[9rem]" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)}
        placeholder="We sell payroll and compliance software to Indian companies with 50 to 500 employees. Our buyer is usually the HR head or the founder." />
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" disabled={busy || text.trim().length < MIN_CHARS}>{busy ? "Working…" : cta}</button>
        <span className="text-xs text-ink-faint">{text.trim().length}/4000</span>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}

function Workspace({ icp, notes, setNotes }: { icp: Icp; notes: string[]; setNotes: (n: string[]) => void }) {
  const qc = useQueryClient();
  const reparse = useMutation({
    mutationFn: (d: string) => api<Icp>(`/icps/${icp.id}/reparse`, { method: "POST", json: { product_description: d } }),
    onSuccess: (data) => { setNotes(data.notes); qc.setQueryData(["icps"], [data]); qc.invalidateQueries({ queryKey: ["usage"] }); },
  });
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Ideal customer profile</h1>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${icp.confirmed ? "bg-accent-wash text-accent-dark" : "bg-paper text-ink-soft ring-1 ring-line"}`}>
          {icp.confirmed ? "Confirmed" : "Draft"}
        </span>
      </div>

      {notes.map((n) => <p key={n} role="status" className="mt-4 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn">{n}</p>)}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="desc-h">
          <h2 id="desc-h" className="text-sm font-semibold text-ink-soft">What you told us</h2>
          {editing ? (
            <>
              <DescriptionForm initial={icp.product_description} cta="Re-read with AI" busy={reparse.isPending}
                error={reparse.isError ? errText(reparse.error) : null}
                onSubmit={(d) => reparse.mutate(d, { onSuccess: () => setEditing(false) })} />
              <button className="mt-2 text-sm text-ink-soft underline" onClick={() => setEditing(false)}>Cancel</button>
              <p className="hint">Re-reading replaces the criteria and sets the profile back to draft.</p>
            </>
          ) : (
            <>
              <p className="mt-2 whitespace-pre-wrap border-l-2 border-line pl-3 text-ink">{icp.product_description}</p>
              <button className="btn-quiet mt-4" onClick={() => setEditing(true)}>Edit description and re-read</button>
            </>
          )}
        </section>

        <Sheet key={`${icp.id}:${icp.confirmed}:${JSON.stringify(icp.criteria)}`} icp={icp} />
      </div>
    </div>
  );
}

function Sheet({ icp }: { icp: Icp }) {
  const qc = useQueryClient();
  const c0 = icp.criteria;
  const [industries, setIndustries] = useState(c0.industries);
  const [geographies, setGeographies] = useState(c0.geographies);
  const [languages, setLanguages] = useState(c0.languages);
  const [titles, setTitles] = useState(c0.job_titles);
  const [exclusions, setExclusions] = useState(c0.exclusions);
  const [min, setMin] = useState(c0.headcount_min?.toString() ?? "");
  const [max, setMax] = useState(c0.headcount_max?.toString() ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (confirm: boolean) => {
      const criteria: Criteria = { industries, geographies, languages, job_titles: titles, exclusions, headcount_min: num(min), headcount_max: num(max) };
      return api<Icp>(`/icps/${icp.id}`, { method: "PUT", json: { criteria, confirm } });
    },
    onSuccess: (data, confirm) => { setMsg(confirm ? "Confirmed. Discovery will use this profile." : "Draft saved."); qc.setQueryData(["icps"], [data]); },
    onError: () => setMsg(null),
  });

  const lo = num(min), hi = num(max);
  const pos = (n: number) => `${Math.min(100, Math.max(0, (Math.log10(n) / 4) * 100))}%`; // 1 to 10,000 employees, log scale
  const mapped = c0.apollo_industries ?? [];

  return (
    <section aria-labelledby="sheet-h" className="space-y-5 rounded-lg border border-line bg-surface p-6">
      <div>
        <h2 id="sheet-h" className="text-lg font-semibold">Targeting sheet</h2>
        <p className="hint">Edit anything. Press Enter after each item.</p>
      </div>

      <ChipInput label="Industries" values={industries} onChange={setIndustries} placeholder="e.g. SaaS, Fintech" max={10}
        hint={mapped.length ? `We will search: ${mapped.join(", ")}` : "We match these against Apollo's industry list when you save."} />
      {!!c0.unmapped_industries?.length && (
        <p className="-mt-3 text-xs text-warn">Not recognised: {c0.unmapped_industries.join(", ")}. Try a broader name.</p>
      )}

      <div>
        <p className="label">Company size (employees)</p>
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Minimum employees" className="field" inputMode="numeric" placeholder="From" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} />
          <input aria-label="Maximum employees" className="field" inputMode="numeric" placeholder="To" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="relative mt-3 h-1.5 rounded-full bg-line" aria-hidden>
          <div className="absolute h-full rounded-full bg-accent" style={{ left: lo ? pos(lo) : "0%", right: hi ? `calc(100% - ${pos(hi)})` : "0%" }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink-faint" aria-hidden><span>1</span><span>10</span><span>100</span><span>1,000</span><span>10,000+</span></div>
        {lo !== null && hi !== null && lo > hi && <p role="alert" className="mt-1 text-xs text-danger">The minimum is larger than the maximum.</p>}
      </div>

      <ChipInput label="Countries or regions" values={geographies} onChange={setGeographies} placeholder="e.g. India" max={15} />
      <ChipInput label="Languages" values={languages} onChange={setLanguages} placeholder="e.g. English" max={8} />
      <ChipInput label="Who to contact (job titles)" values={titles} onChange={setTitles} placeholder="e.g. HR Head, Founder" max={15} />
      <ChipInput label="Leave out" values={exclusions} onChange={setExclusions} placeholder="e.g. Staffing agencies, competitors" max={15}
        hint="Company types you never want to contact." />

      {save.isError && <p role="alert" className="text-sm text-danger">{errText(save.error)}</p>}
      {msg && <p role="status" className="text-sm text-accent-dark">{msg}</p>}
      <div className="flex gap-3 border-t border-line pt-4">
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate(true)}>{icp.confirmed ? "Save and keep confirmed" : "Save and confirm"}</button>
        <button className="btn-quiet" disabled={save.isPending} onClick={() => save.mutate(false)}>Save as draft</button>
      </div>
    </section>
  );
}
