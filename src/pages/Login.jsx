
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import aiFounderLogo from "../assets/bluecode-logo.jpeg";

import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Target,
  ChartNoAxesCombined,
  Sparkles,
  UserRound,
  Building2,
  ShieldCheck,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Ideal Customer Profile",
    description:
      "Define the companies your business wants to reach.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Lead Scoring & Buying Signals",
    description:
      "Prioritize prospects using fit scores and available signals.",
  },
  {
    icon: Sparkles,
    title: "Outreach & Next Best Actions",
    description:
      "Prepare personalized outreach and identify your next sales task.",
  },
];

function Login() {
  const navigate = useNavigate();

  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (isSignup && !form.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (isSignup && !form.company.trim()) {
      setError("Please enter your company name.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your work email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    // DEMO-ONLY NAVIGATION
    // New demo account -> ICP Builder
    // Existing demo login -> Dashboard
    // Real authentication will be connected to the backend later.

    if (isSignup) {
      // Clear the previous demo's completion flag so the ICP
      // setup flow starts again for this new demo signup.
      localStorage.removeItem("demoIcpSaved");

      navigate("/icp-builder");
    } else {
      navigate("/dashboard");
    }
  };

  const switchMode = (signup) => {
    setIsSignup(signup);
    setShowPassword(false);
    setError("");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050B1B] text-white">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-blue-600/20 blur-[120px]" />

        <div className="absolute -right-32 top-20 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="absolute bottom-[-180px] left-1/3 h-[400px] w-[400px] rounded-full bg-indigo-600/20 blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/10" />

        <div className="absolute left-1/2 top-1/2 h-[470px] w-[470px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/10" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-3 rounded-xl text-left transition hover:opacity-80"
          aria-label="Back to AI Founder OS home"
        >
          <img
            src={aiFounderLogo}
            alt="AI Founder OS logo"
            className="h-11 w-11 rounded-xl object-contain"
          />

          <div>
            <p className="text-lg font-bold tracking-tight">
              AI Founder{" "}
              <span className="text-blue-400">OS</span>
            </p>

            <p className="text-xs text-slate-400">
              AI Sales Copilot
            </p>
          </div>
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 sm:flex">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Intelligent sales workspace
        </div>
      </header>

      {/* Main content */}
      <section className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:pb-20 lg:pt-10">
        {/* Left panel */}
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3.5 py-2 text-xs font-medium text-blue-200">
            <Sparkles className="h-4 w-4 text-blue-300" />
            AI-powered sales intelligence
          </div>

          <h1 className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
            Find your ideal customers.
            <span className="mt-2 block bg-gradient-to-r from-blue-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Know your next move.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Define your ideal customer profile, discover relevant
            prospects, prioritize leads, and prepare personalized
            outreach—all in one workspace.
          </p>

          {/* Feature cards */}
          <div className="mt-9 space-y-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="group flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition duration-300 hover:border-blue-400/25 hover:bg-blue-500/[0.05] sm:p-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 shadow-lg shadow-blue-950/30">
                    <Icon className="h-5 w-5 text-blue-300" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-100">
                      {feature.title}
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Workflow preview */}
          <div className="relative mt-8 overflow-hidden rounded-2xl border border-blue-400/15 bg-gradient-to-br from-[#101D38]/95 to-[#0A1226]/95 p-5 shadow-2xl shadow-blue-950/30 sm:p-6">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-300">
                  AI Founder OS workflow
                </p>

                <h3 className="mt-2 text-lg font-semibold">
                  From discovery to action
                </h3>
              </div>

              <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
                <Zap className="h-5 w-5 text-blue-300" />
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { number: "01", label: "Define ICP" },
                { number: "02", label: "Prioritize" },
                { number: "03", label: "Take action" },
              ].map((step, index) => (
                <div key={step.number} className="relative">
                  <div className="flex h-full min-h-[88px] flex-col justify-between rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 sm:p-4">
                    <span className="text-xs font-semibold text-blue-300">
                      {step.number}
                    </span>

                    <span className="mt-3 text-xs font-medium text-slate-200 sm:text-sm">
                      {step.label}
                    </span>
                  </div>

                  {index < 2 && (
                    <ArrowRight className="absolute -right-[11px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-blue-300 sm:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel: Authentication form */}
        <div className="mx-auto w-full max-w-md">
          <div className="relative">
            <div className="absolute -inset-1 rounded-[30px] bg-gradient-to-br from-blue-500/25 via-cyan-500/10 to-indigo-500/25 opacity-70 blur-xl" />

            <div className="relative rounded-[26px] border border-white/10 bg-[#0B1326]/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
              {/* Form heading */}
              <div className="mb-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
                  {isSignup ? (
                    <UserRound className="h-6 w-6 text-blue-300" />
                  ) : (
                    <LockKeyhole className="h-6 w-6 text-blue-300" />
                  )}
                </div>

                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {isSignup
                    ? "Create your account"
                    : "Sign in to AI Founder OS"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {isSignup
                    ? "Set up your workspace and get started with smarter sales."
                    : "Welcome back. Continue building your sales pipeline."}
                </p>
              </div>

              {/* Sign-in / Sign-up switch */}
              <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/[0.08] bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => switchMode(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    !isSignup
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={() => switchMode(true)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isSignup
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Create account
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <>
                    <div>
                      <label
                        htmlFor="name"
                        className="mb-2 block text-sm font-medium text-slate-200"
                      >
                        Full name
                      </label>

                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                        <input
                          id="name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Enter your full name"
                          className="w-full rounded-xl border border-white/10 bg-[#080F20] py-3.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="company"
                        className="mb-2 block text-sm font-medium text-slate-200"
                      >
                        Company name
                      </label>

                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                        <input
                          id="company"
                          name="company"
                          type="text"
                          autoComplete="organization"
                          value={form.company}
                          onChange={handleChange}
                          placeholder="Enter your company name"
                          className="w-full rounded-xl border border-white/10 bg-[#080F20] py-3.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Work email
                  </label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@company.com"
                      className="w-full rounded-xl border border-white/10 bg-[#080F20] py-3.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-200"
                    >
                      Password
                    </label>

                    {!isSignup && (
                      <button
                        type="button"
                        onClick={() =>
                          setError(
                            "Password reset will be available when authentication is connected."
                          )
                        }
                        className="text-xs text-blue-300 transition hover:text-blue-200"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isSignup ? "new-password" : "current-password"
                      }
                      value={form.password}
                      onChange={handleChange}
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-white/10 bg-[#080F20] py-3.5 pl-10 pr-12 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/60 focus:ring-4 focus:ring-blue-500/10"
                      minLength={8}
                      required
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-white"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-300"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-cyan-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:translate-y-0"
                >
                  {isSignup
                    ? "Create demo account"
                    : "Continue to workspace"}

                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.08]" />

                <span className="text-xs text-slate-500">
                  AI FOUNDER OS
                </span>

                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              <p className="text-center text-xs leading-5 text-slate-500">
                Demo navigation only. Accounts and passwords are not saved
                or authenticated.
              </p>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-5 flex w-full items-center justify-center gap-2 text-sm text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </button>
            </div>

            {/* Bottom accent */}
            <div className="relative mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-[#0B1326]/90 px-4 py-2 text-xs text-slate-400 shadow-lg">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Built for smarter sales workflows
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Designed for a focused, organized sales workflow
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] px-5 py-5 text-center text-xs text-slate-600 sm:px-8">
        © {new Date().getFullYear()} AI Founder OS. All rights reserved.
      </footer>
    </main>
  );
}

export default Login;
