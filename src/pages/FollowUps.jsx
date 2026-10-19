
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Mail
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePrototype } from "../context/PrototypeContext";
import { PageHeader, Pill } from "../components/UI";

export default function FollowUps() {
  const { prospects, outreach, markFollowUpSentDemo } = usePrototype();
  const [activeFollowUp, setActiveFollowUp] = useState(1);

  const getFollowUpCount = prospect => {
    const arrayCount = Array.isArray(prospect.followUps)
      ? prospect.followUps.length
      : 0;

    return Math.min(
      2,
      Math.max(
        arrayCount,
        Number(prospect.followUpCount) || 0,
        prospect.followUp2Sent ? 2 : prospect.followUp1Sent ? 1 : 0
      )
    );
  };

  const isStopped = prospect => {
    const status = String(prospect.status || "").toLowerCase();
    const intent = String(
      prospect.replyIntent || prospect.intent || ""
    ).toLowerCase();

    return (
      prospect.meetingBooked === true ||
      Boolean(prospect.bookingLinkSent) ||
      ["not interested", "rejected", "do not contact"].includes(status) ||
      intent === "negative" ||
      status.includes("meeting booked")
    );
  };

  const queue = prospects.filter(prospect => {
    if (isStopped(prospect)) return false;

    const count = getFollowUpCount(prospect);

    return activeFollowUp === 1 ? count === 0 : count === 1;
  });

  return (
    <div>
      <PageHeader
        eyebrow="PENDING QUEUES"
        title="Follow-ups"
        description="Review the first and second follow-up separately. Nothing is automatically sent."
      />

      <div className="followup-banner">
        <div className="followup-banner-icon">
          <CalendarClock size={21} />
        </div>
        <div>
          <strong>Founder-controlled follow-through</strong>
          <p>
            There are only two follow-up stages. Stop when a prospect declines
            or moves to meeting booking.
          </p>
        </div>
        <Pill tone="blue">Demo queue</Pill>
      </div>

      <section className="panel" style={{ padding: "18px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            className={`button ${
              activeFollowUp === 1 ? "button-primary" : "button-secondary"
            }`}
            onClick={() => setActiveFollowUp(1)}
          >
            <Mail size={16} />
            Follow-up 1
          </button>

          <button
            className={`button ${
              activeFollowUp === 2 ? "button-primary" : "button-secondary"
            }`}
            onClick={() => setActiveFollowUp(2)}
          >
            <Mail size={16} />
            Follow-up 2
          </button>
        </div>

        <p style={{ marginTop: "12px", marginBottom: 0 }}>
          {activeFollowUp === 1
            ? "Prospects eligible for their first follow-up."
            : "Prospects who have had Follow-up 1 and are eligible for their second follow-up."}
        </p>
      </section>

      <div className="followup-list">
        {queue.length === 0 ? (
          <section className="panel" style={{ padding: "24px" }}>
            <CheckCircle2 size={22} />
            <h3 style={{ marginTop: "12px" }}>
              No prospects in Follow-up {activeFollowUp}
            </h3>
            <p>
              {activeFollowUp === 1
                ? "There are no eligible prospects waiting for their first follow-up."
                : "A prospect will appear here after Follow-up 1 is recorded."}
            </p>
          </section>
        ) : (
          queue.map(prospect => {
            const draft = outreach.find(
              item => item.prospectId === prospect.id
            );

            return (
              <div className="followup-row" key={prospect.id}>
                <div className="followup-status-icon">
                  <Clock3 size={19} />
                </div>

                <div className="followup-main">
                  <div className="followup-title">
                    <strong>{prospect.company}</strong>
                    <Pill tone="orange">
                      Follow-up {activeFollowUp}
                    </Pill>
                  </div>

                  <p>
                    {activeFollowUp === 1
                      ? "Review the initial email before recording the first follow-up."
                      : "Review the previous follow-up before recording the final follow-up."}
                  </p>

                  <div className="followup-sub">
                    <span>
                      <Mail size={14} />
                      {draft?.subject || "No email draft linked"}
                    </span>
                    <span>
                      {prospect.person} · {prospect.role}
                    </span>
                  </div>
                </div>

                <div className="followup-actions">
                  <button
                    className="button button-secondary"
                    onClick={() => markFollowUpSentDemo(prospect.id)}
                  >
                    <CheckCircle2 size={15} />
                    Record Follow-up {activeFollowUp}
                  </button>

                  <Link
                    className="table-action"
                    to={`/prospects/${prospect.id}`}
                    aria-label={`View ${prospect.company}`}
                  >
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="info-strip">
        <Clock3 size={18} />
        <p>
          <strong>Demo only:</strong> recording a follow-up updates local
          prototype data. It does not send an email or schedule a live
          follow-up.
        </p>
      </div>
    </div>
  );
}
