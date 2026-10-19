
import { useState } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Link2,
  Save,
  ShieldCheck,
  Users,
  X,
  LockKeyhole,
  Mail,
  Search,
  Sparkles,
} from "lucide-react";

import { usePrototype } from "../context/PrototypeContext";
import { PageHeader, Pill } from "../components/UI";

const plans = [
  {
    name: "Starter",
    users: 1,
    prospects: "100",
    searches: "50",
    emails: "100",
    price: 1999,
    trialDays: 15,
    description:
      "A simple starting point for founders exploring AI-powered sales.",
  },
  {
    name: "Growth",
    users: 3,
    prospects: "500",
    searches: "250",
    emails: "500",
    price: 3999,
    trialDays: 0,
    description:
      "For a small team building a repeatable sales pipeline.",
  },
  {
    name: "Pro",
    users: 10,
    prospects: "2,000",
    searches: "1,000",
    emails: "2,000",
    price: 7999,
    trialDays: 0,
    description:
      "For teams managing a broader prospecting workflow.",
  },
];

export default function SettingsPage() {
  const {
    startup,
    updateStartup,
    bookingUrl,
    updateBookingUrl,
    account,
    updateAccount,
    selectedPlan,
    selectPlan,
  } = usePrototype();

  const [company, setCompany] = useState({ ...startup });
  const [user, setUser] = useState({ ...account });
  const [link, setLink] = useState(bookingUrl);
  const [saved, setSaved] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [apolloPreview, setApolloPreview] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [checkoutNotice, setCheckoutNotice] = useState("");

  const validLink = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const save = () => {
    if (!validLink(link)) {
      setLinkError(
        "Enter a complete HTTPS booking URL before saving."
      );
      return;
    }

    setLinkError("");
    updateStartup(company);
    updateAccount(user);
    updateBookingUrl(link);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const choosePlan = (plan) => {
    selectPlan(plan.name);
    setCheckoutPlan(plan);
    setCheckoutNotice("");
    setPaymentMethod("card");
  };

  return (
    <div>
      <PageHeader
        eyebrow="WORKSPACE CONFIGURATION"
        title="Settings"
        description="Manage your startup, founder profile, meeting link, integrations and subscription allowances."
        action={
          <button
            className="button button-primary"
            onClick={save}
          >
            <Save size={16} />
            Save settings
          </button>
        }
      />

      {saved && (
        <div className="save-success">
          <CheckCircle2 size={17} />
          Settings saved in this browser for the demo.
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-main">
          {/* Company Profile */}
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <div className="section-icon">
                <Building2 size={19} />
              </div>

              <div>
                <h2>Company profile</h2>
                <p>
                  Startup context for prospect research and
                  personalization.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Company name</label>
                <input
                  className="input"
                  value={company.companyName || ""}
                  onChange={(e) =>
                    setCompany((s) => ({
                      ...s,
                      companyName: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-field">
                <label>Target geography</label>
                <select
                  className="input"
                  value={company.geography || "India"}
                  onChange={(e) =>
                    setCompany((s) => ({
                      ...s,
                      geography: e.target.value,
                    }))
                  }
                >
                  <option>India</option>
                  <option>India and Southeast Asia</option>
                  <option>North America</option>
                  <option>United Kingdom</option>
                  <option>Global</option>
                </select>
              </div>

              <div className="form-field full-field">
                <label>Product description</label>
                <textarea
                  className="input textarea"
                  rows={3}
                  value={company.product || ""}
                  onChange={(e) =>
                    setCompany((s) => ({
                      ...s,
                      product: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-field full-field">
                <label>Sales objective</label>
                <input
                  className="input"
                  value={company.objective || ""}
                  onChange={(e) =>
                    setCompany((s) => ({
                      ...s,
                      objective: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </section>

          {/* Meeting Booking Link */}
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <div className="section-icon">
                <CalendarDays size={19} />
              </div>

              <div>
                <h2>Meeting booking link</h2>
                <p>
                  Required workspace setting used for meeting
                  suggestions.
                </p>
              </div>

              <Pill tone={validLink(link) ? "green" : "orange"}>
                {validLink(link) ? "Link added" : "Required"}
              </Pill>
            </div>

            <div className="form-field">
              <label>Calendly or custom booking URL</label>

              <div className="input-with-icon">
                <Link2 size={17} />

                <input
                  className="input"
                  type="url"
                  placeholder="https://calendly.com/your-name/intro"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setLinkError("");
                  }}
                />
              </div>

              {linkError && (
                <p className="auth-error" role="alert">
                  {linkError}
                </p>
              )}

              <small className="field-help">
                Use a complete HTTPS URL. This demo saves the
                link locally; no calendar service is connected.
              </small>
            </div>

            {link && validLink(link) && (
              <div className="booking-preview">
                <CheckCircle2 size={16} />
                <span>Secure URL format looks valid.</span>

                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open booking link"
                >
                  <ArrowUpRight size={15} />
                </a>
              </div>
            )}
          </section>

          {/* Founder Profile */}
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <div className="section-icon">
                <Users size={19} />
              </div>

              <div>
                <h2>Founder profile</h2>
                <p>
                  Basic details shown in your workspace.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Display name</label>
                <input
                  className="input"
                  value={user.name || ""}
                  onChange={(e) =>
                    setUser((s) => ({
                      ...s,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-field">
                <label>Work email</label>
                <input
                  className="input"
                  type="email"
                  value={user.email || ""}
                  onChange={(e) =>
                    setUser((s) => ({
                      ...s,
                      email: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </section>

          {/* Integrations */}
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <div className="section-icon">
                <ShieldCheck size={19} />
              </div>

              <div>
                <h2>Integrations</h2>
                <p>
                  Each customer should authorize their own
                  Apollo account. Do not share or collect
                  account passwords.
                </p>
              </div>
            </div>

            <div className="integration-row">
              <div className="integration-logo apollo-logo">
                A
              </div>

              <div className="integration-copy">
                <strong>Apollo</strong>
                <span>
                  Connect the customer's own account for
                  company and people search, selected
                  enrichment and approved sequence handoff.
                </span>
              </div>

              <Pill tone="orange">Preview only</Pill>

              <button
                className="button button-secondary"
                onClick={() => setApolloPreview(true)}
              >
                Connect Apollo (demo)
              </button>
            </div>

            <div className="integration-row">
              <div className="integration-logo ai-logo">
                AI
              </div>

              <div className="integration-copy">
                <strong>AI intelligence</strong>
                <span>
                  ICP interpretation, scoring, research
                  summaries and next-best actions.
                </span>
              </div>

              <Pill>Mock data</Pill>
            </div>

            <div className="integration-row">
              <div
                className="integration-logo"
                style={{
                  background: "#EAF8F0",
                  color: "#16734A",
                }}
              >
                <Mail size={17} />
              </div>

              <div className="integration-copy">
                <strong>Email and calendar</strong>
                <span>
                  Founder-approved outreach and meeting
                  workflow.
                </span>
              </div>

              <Pill tone="orange">Not connected</Pill>
            </div>
          </section>
        </div>

        {/* Plans and Billing */}
        <aside className="settings-side">
          <section className="panel plan-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <CreditCard size={17} />
                  Plans &amp; billing
                </h2>
                <p>
                  Monthly subscription pricing and usage
                  allowances.
                </p>
              </div>
            </div>

            <div className="trial-banner">
              <div className="trial-banner-icon">
                <Sparkles size={18} />
              </div>

              <div>
                <strong>15-Day Free Trial</strong>
                <p>
                  Available with Starter only. Starter
                  subscription billing begins after the
                  trial. Growth and Pro have no free trial.
                </p>
              </div>

              <Pill tone="blue">Starter</Pill>
            </div>

            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.name;

              return (
                <div
                  className={`plan-option ${
                    isSelected ? "plan-current" : ""
                  }`}
                  key={plan.name}
                >
                  <div className="plan-option-top">
                    <strong>{plan.name}</strong>

                    {isSelected && (
                      <Pill tone="blue">Selected</Pill>
                    )}
                  </div>

                  <p className="plan-description">
                    {plan.description}
                  </p>

                  {/* Simplified pricing */}
                  <div className="plan-price">
                    <strong>
                      ₹{plan.price.toLocaleString("en-IN")}
                    </strong>
                    <span>/month + 18% GST</span>
                  </div>

                  {/* Keep the Starter trial note */}
                  {plan.name === "Starter" && (
                    <div className="starter-trial-note">
                      <CheckCircle2 size={15} />
                      15-day free trial included
                    </div>
                  )}

                  {/* Usage allowances */}
                  <div className="plan-limit-grid">
                    <div>
                      <Users size={14} />
                      <strong>{plan.users}</strong>
                      <span>Users</span>
                    </div>

                    <div>
                      <Sparkles size={14} />
                      <strong>{plan.prospects}</strong>
                      <span>AI prospects</span>
                    </div>

                    <div>
                      <Search size={14} />
                      <strong>{plan.searches}</strong>
                      <span>DM searches</span>
                    </div>

                    <div>
                      <Mail size={14} />
                      <strong>{plan.emails}</strong>
                      <span>Emails</span>
                    </div>
                  </div>

                  {/* Keep the existing plan selection action */}
                  <button
                    className={`button ${
                      isSelected
                        ? "button-secondary"
                        : "button-primary"
                    } button-full`}
                    onClick={() => choosePlan(plan)}
                  >
                    {isSelected
                      ? "Review selected plan"
                      : `Choose ${plan.name}`}
                  </button>
                </div>
              );
            })}

            <p className="field-help">
              Prices are shown in INR, excluding 18% GST.
              Checkout and payment verification are currently
              demo-only. Internal operating-cost limits are
              not displayed.
            </p>
          </section>
        </aside>
      </div>

      {/* Apollo Preview Modal */}
      {apolloPreview && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setApolloPreview(false);
            }
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apollo-title"
          >
            <button
              className="modal-close"
              onClick={() => setApolloPreview(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="modal-icon">
              <ShieldCheck size={22} />
            </div>

            <h2 id="apollo-title">
              Connect your Apollo account
            </h2>

            <p>
              In production, each startup authorizes its own
              Apollo account through OAuth. Access tokens
              remain on the backend and can be disconnected
              later.
            </p>

            <div className="modal-detail-list">
              <div>
                <CheckCircle2 size={16} />
                Company and people search
              </div>

              <div>
                <CheckCircle2 size={16} />
                Selective enrichment after founder selection
              </div>

              <div>
                <CheckCircle2 size={16} />
                Approved sequence handoff
              </div>
            </div>

            <div className="modal-notice">
              <ShieldCheck size={16} />
              Demo only: no Apollo account is connected yet.
              Production should use Apollo authorization/OAuth;
              do not ask customers to paste their password or
              private API key into this prototype.
            </div>

            <button
              className="button button-primary button-full"
              onClick={() => setApolloPreview(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Checkout Preview Modal */}
      {checkoutPlan && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCheckoutPlan(null);
            }
          }}
        >
          <div
            className="modal-card checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            <button
              className="modal-close"
              onClick={() => setCheckoutPlan(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="modal-icon">
              <CreditCard size={22} />
            </div>

            <div className="eyebrow">CHECKOUT PREVIEW</div>

            <h2 id="checkout-title">
              Continue with {checkoutPlan.name}
            </h2>

            <p>
              Review your selected plan and applicable GST.
              No payment will be taken in this prototype.
            </p>

            <div className="checkout-summary">
              <strong>{checkoutPlan.name}</strong>

              <span>
                {checkoutPlan.users} user
                {checkoutPlan.users > 1 ? "s" : ""} ·{" "}
                {checkoutPlan.prospects} AI prospects ·{" "}
                {checkoutPlan.searches} DM searches ·{" "}
                {checkoutPlan.emails} emails
              </span>

              {checkoutPlan.name === "Starter" && (
                <div className="checkout-trial-note">
                  <Sparkles size={15} />
                  15-day free trial. Subscription billing
                  begins after the trial, subject to the
                  configured billing terms.
                </div>
              )}

              {/* Simplified checkout pricing */}
              <div className="checkout-price-row">
                <span>Monthly subscription</span>
                <strong>
                  ₹
                  {checkoutPlan.price.toLocaleString("en-IN")}
                  /month + 18% GST
                </strong>
              </div>
            </div>

            <div className="payment-methods">
              <button
                type="button"
                className={
                  paymentMethod === "card"
                    ? "payment-method selected"
                    : "payment-method"
                }
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard size={18} />

                <span>
                  <strong>Credit card</strong>
                  <small>
                    Secure provider checkout in production
                  </small>
                </span>

                {paymentMethod === "card" && (
                  <CheckCircle2 size={16} />
                )}
              </button>

              <button
                type="button"
                className={
                  paymentMethod === "debit"
                    ? "payment-method selected"
                    : "payment-method"
                }
                onClick={() => setPaymentMethod("debit")}
              >
                <CreditCard size={18} />

                <span>
                  <strong>Debit card</strong>
                  <small>
                    Availability depends on payment provider
                  </small>
                </span>

                {paymentMethod === "debit" && (
                  <CheckCircle2 size={16} />
                )}
              </button>
            </div>

            <div className="modal-notice">
              <LockKeyhole size={16} />
              Payment gateway and backend verification are
              not connected. Do not enter real card details
              in this demo.
            </div>

            {checkoutNotice && (
              <p className="auth-error" role="status">
                {checkoutNotice}
              </p>
            )}

            <button
              className="button button-primary button-full"
              onClick={() =>
                setCheckoutNotice(
                  "Checkout is a preview only. Configure a payment gateway and backend before accepting real payments."
                )
              }
            >
              Continue to secure checkout
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
