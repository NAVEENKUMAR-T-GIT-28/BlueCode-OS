import founderLogo from "../assets/founder-logo.png";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Link2,
  ShieldCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrototype } from "../context/PrototypeContext";
import { Button } from "../components/UI";

export default function BookingSetup() {
  const navigate = useNavigate();
  const { bookingUrl, updateBookingUrl, startup } = usePrototype();

  const [link, setLink] = useState(bookingUrl || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const validate = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !!url.hostname;
    } catch {
      return false;
    }
  };

  const submit = (e) => {
    e.preventDefault();

    const trimmedLink = link.trim();

    if (!validate(trimmedLink)) {
      setError("Enter a complete secure URL beginning with https://");
      return;
    }

    updateBookingUrl(trimmedLink);
    setSaved(true);
    setError("");

    navigate("/apollo-setup");
  };

  return (
    <div className="booking-setup-page">
      <div className="setup-top">
        <a className="brand" href="/login">
          <div className="brand-mark">
  <img src={founderLogo} alt="Blue Code - OS logo" />
</div>
          <div>
            <strong>Blue Code - OS</strong>
            <span>Meeting setup</span>
          </div>
        </a>
        <span className="step-count">REQUIRED SETUP</span>
      </div>

      <div className="setup-progress">
        <span style={{ width: "100%" }} />
      </div>

      <div className="setup-container">
        <div className="setup-step-kicker">
          <span>04</span> MEETING BOOKING
        </div>

        <h1>Let interested prospects book a conversation.</h1>

        <p className="setup-intro">
          Add your Calendly, Cal.com or another secure booking link.
          Blue Code - OS can use it in future meeting suggestions.
          You can change it later in Settings.
        </p>

        <div className="booking-setup-card">
          <div className="booking-illustration">
            <CalendarDays size={27} />
          </div>

          <h2>Set up your booking link</h2>

          <p>
            Save your booking URL before connecting your prospect data.
          </p>

          <form onSubmit={submit}>
            <label className="field-label" htmlFor="booking-url">
              Booking URL
            </label>

            <div className="input-with-icon">
              <Link2 size={17} />
              <input
                id="booking-url"
                className="input"
                type="url"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError("");
                }}
                placeholder="https://calendly.com/your-name/intro"
                required
              />
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <div className="form-note">
              <ShieldCheck size={16} />
              This prototype stores the URL in this browser only. It does not
              connect to a calendar.
            </div>

            <div className="form-note apollo-next-note">
              <ShieldCheck size={16} />
              <span>
                <strong>Next: connect Apollo.</strong> The next screen is a
                prototype preview. Live Apollo authorization requires a secure
                backend integration.
              </span>
            </div>

            <Button
              type="submit"
              icon={ArrowRight}
              className="button-full"
            >
              Save and continue
            </Button>
          </form>

          {saved && (
            <p className="booking-saved">
              <CheckCircle2 size={16} />
              Link saved.
            </p>
          )}
        </div>

        <p className="privacy-note">
          {startup.companyName
            ? `Workspace: ${startup.companyName}`
            : "Founder workspace"}{" "}
          · Demo data is stored locally in this browser.
        </p>
      </div>
    </div>
  );
}
