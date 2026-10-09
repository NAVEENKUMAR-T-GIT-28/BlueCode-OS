"use client";
import { useState } from "react";

type Props = { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number };

/** Type a value and press Enter or comma. Backspace on an empty box removes the last one. */
export default function ChipInput({ label, hint, values, onChange, placeholder, max = 15 }: Props) {
  const [draft, setDraft] = useState("");
  const id = `chips-${label.replace(/\s+/g, "-").toLowerCase()}`;

  function commit() {
    const v = draft.trim().replace(/\s+/g, " ");
    setDraft("");
    if (!v || values.length >= max || values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
  }

  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex flex-wrap gap-1.5 rounded-md border border-line bg-surface p-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-accent-wash px-2 py-0.5 text-sm text-accent-dark">
            {v}
            <button type="button" aria-label={`Remove ${v}`} className="rounded px-0.5 text-accent-dark/70 hover:text-danger"
              onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        <input id={id} value={draft} placeholder={values.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-ink-faint"
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
            else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
          }} />
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
