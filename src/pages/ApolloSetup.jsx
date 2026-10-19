import founderLogo from "../assets/founder-logo.png";
import { ArrowRight, ShieldCheck, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePrototype } from "../context/PrototypeContext";
import { Button } from "../components/UI";

export default function ApolloSetup() {
  const navigate = useNavigate();
  const { apolloConnectionStatus, connectApolloDemo } = usePrototype();

  const connected = apolloConnectionStatus === "demo_connected";

  const handleContinue = () => {
    if (!connected) {
      connectApolloDemo();
    }
    navigate("/dashboard");
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
            <span>Apollo integration setup</span>
          </div>
        </a>
        <span className="step-count">FINAL SETUP</span>
      </div>

      <div className="setup-progress">
        <span style={{ width: "100%" }} />
      </div>

      <div className="setup-container">
        <div className="setup-step-kicker">
          <span>05</span> CONNECT YOUR PROSPECT DATA
        </div>

        <h1>Connect your Apollo account.</h1>

        <p className="setup-intro">
          Apollo will be used to find relevant companies and decision-makers.
          You'll authorize access to your own account when the live integration
          is available.
        </p>

        <div className="booking-setup-card">
          <div className="booking-illustration">
            <Database size={27} />
          </div>

          <h2>Connect Apollo</h2>

          <p>
            {connected
              ? "Demo connection enabled. No live Apollo account is connected."
              : "Your account authorization will be handled securely through Apollo when the backend integration is ready."}
          </p>

          <div className="form-note">
            <ShieldCheck size={16} />
            Never enter your Apollo password or API key into this prototype.
          </div>

          <div className="form-note">
            <ShieldCheck size={16} />
            <span>
              <strong>Prototype mode:</strong> Continuing simulates the
              connection so you can preview the workspace. It does not
              authorize Apollo or retrieve live prospect data.
            </span>
          </div>

          <Button
            type="button"
            icon={ArrowRight}
            className="button-full"
            onClick={handleContinue}
          >
            {connected ? "Open dashboard" : "Continue with demo connection"}
          </Button>
        </div>

        <p className="privacy-note">
          Live Apollo authorization requires a configured backend and approved
          API access.
        </p>
      </div>
    </div>
  );
}
