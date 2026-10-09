"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api(signup ? "/auth/signup" : "/auth/login", {
        method: "POST",
        json: signup
          ? { startup_name: f.get("startup_name"), email: f.get("email"), password: f.get("password") }
          : { email: f.get("email"), password: f.get("password") },
      });
      router.replace(signup ? "/icp" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden bg-ink p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <p className="text-sm font-semibold tracking-wide">AI Founder OS</p>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight">Tell it who buys from you. Get back a list worth emailing.</h1>
          <p className="mt-5 max-w-sm text-white/70">Describe your product once. The Sales Copilot turns it into a target profile, finds the decision-makers, and drafts the outreach for you to approve.</p>
        </div>
        <p className="text-xs text-white/50">15-day free trial. Nothing is sent without your approval.</p>
      </section>

      <section className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4" noValidate>
          <h2 className="text-2xl font-semibold">{signup ? "Start your free trial" : "Welcome back"}</h2>
          {signup && (
            <div>
              <label className="label" htmlFor="startup_name">Startup name</label>
              <input id="startup_name" name="startup_name" className="field" required maxLength={120} autoComplete="organization" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" className="field" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="field" required minLength={signup ? 8 : 1}
              autoComplete={signup ? "new-password" : "current-password"} />
            {signup && <p className="hint">At least 8 characters.</p>}
          </div>
          {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "One moment…" : signup ? "Create account" : "Log in"}</button>
          <p className="text-sm text-ink-soft">
            {signup ? "Already have an account? " : "New here? "}
            <Link className="font-medium text-accent underline" href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Start free trial"}</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
