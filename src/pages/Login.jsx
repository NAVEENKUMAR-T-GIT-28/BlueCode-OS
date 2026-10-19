
import {
  ArrowRight,
  Compass,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrototype } from "../context/PrototypeContext";
import founderLogo from "../assets/founder-logo.png";

export default function Login() {
  const navigate = useNavigate();

  const {
    updateAccount,
    markAccountCreated,
    setupComplete,
    icp,
    icpApproved,
    bookingUrl,
  } = usePrototype();

  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || password.length < 6) {
      setError(
        "Enter a valid email and a password with at least 6 characters."
      );
      return;
    }

    if (mode === "create" && !name.trim()) {
      setError("Enter your name to create your account.");
      return;
    }

    updateAccount({
      name: name.trim() || email.split("@")[0],
      email: email.trim(),
    });

    markAccountCreated();

    if (mode === "create" || !setupComplete) {
      navigate("/startup-setup");
    } else if (!icp) {
      navigate("/icp-builder");
    } else if (!icpApproved) {
      navigate("/icp-review");
    } else if (!bookingUrl) {
      navigate("/booking-setup");
    } else {
      navigate("/dashboard");
    }
  };

  const switchMode = () => {
    setMode((current) => (current === "create" ? "signin" : "create"));
    setError("");
  };

  return (
    <main className="auth-page">
      {/* Brand header */}
      <header className="auth-top">
        <a className="brand auth-brand" href="/login">
          <div className="brand-mark">
            <img src={founderLogo} alt="Blue Code OS logo" />
          </div>

          <div>
            <strong>Blue Code - OS</strong>
            <span>Sales intelligence for founders</span>
          </div>
        </a>
      </header>

      {/* Main content */}
      <div className="auth-layout">
        <section className="auth-hero">
          <div className="hero-chip">
            <span className="pulse-dot" />
            Founder-guided intelligence
          </div>

          <h1>
            Find the right customers.
            <br />
            <span>Know what to do next.</span>
          </h1>

          <p className="auth-hero-description">
            Turn your ideal customer profile into a focused prospect workflow
            with useful insights, relevant context, and founder-approved
            outreach.
          </p>

          <div className="hero-steps">
            <div>
              <div className="hero-step-icon">
                <Target size={18} />
              </div>
              <span>
                <strong>Prioritize with purpose</strong>
                <small>Understand prospect fit and potential.</small>
              </span>
            </div>

            <div>
              <div className="hero-step-icon">
                <Compass size={18} />
              </div>
              <span>
                <strong>Act with context</strong>
                <small>Get clear, actionable next steps.</small>
              </span>
            </div>

            <div>
              <div className="hero-step-icon">
                <ShieldCheck size={18} />
              </div>
              <span>
                <strong>Stay in control</strong>
                <small>Review messages before outreach.</small>
              </span>
            </div>
          </div>

          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-glow" />
        </section>

        {/* Login card */}
        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="eyebrow">
              {mode === "create" ? "GET STARTED" : "WELCOME BACK"}
            </div>

            <h2>
              {mode === "create"
                ? "Create your account"
                : "Sign in to AI Sales Copilot"}
            </h2>

            <p className="auth-description">
              {mode === "create"
                ? "Set up your workspace and get started."
                : "Sign in to manage your sales workflow."}
            </p>

            <form onSubmit={submit}>
              {mode === "create" && (
                <>
                  <label className="field-label" htmlFor="account-name">
                    Full name
                  </label>

                  <input
                    id="account-name"
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Enter your name"
                    required
                  />
                </>
              )}

              <label className="field-label" htmlFor="account-email">
                Work email
              </label>

              <input
                id="account-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />

              <label className="field-label" htmlFor="account-password">
                Password
              </label>

              <input
                id="account-password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "create" ? "new-password" : "current-password"
                }
                placeholder="Enter your password"
                minLength={6}
                required
              />

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              <button
                className="button button-primary button-full"
                type="submit"
              >
                {mode === "create" ? "Create account" : "Sign in"}
                <ArrowRight size={16} />
              </button>
            </form>

            <p className="auth-switch">
              {mode === "create"
                ? "Already have an account?"
                : "New to Blue Code - OS?"}{" "}
              <button
                type="button"
                className="text-button"
                onClick={switchMode}
              >
                {mode === "create" ? "Sign in" : "Create account"}
              </button>
            </p>
          </div>

          <div className="auth-footnote">
            <Zap size={14} />
            Your 15-day founder pilot
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="auth-footer">
        <span>© 2026 Blue Code - OS</span>
        <span>Sales intelligence for founders</span>
      </footer>
    </main>
  );
}
