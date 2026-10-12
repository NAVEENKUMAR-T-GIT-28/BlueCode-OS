import { formatDate } from "../../api";
import { useRemote } from "../../app/hooks";
import {
  Badge,
  ErrorState,
  Icon,
  LoadingState,
  Notice,
  PageHeader,
} from "../../components/shared";
import { DefinitionList } from "../shared/DefinitionList";
import type { PageContext } from "../page-types";

type RecordValue = Record<string, any>;

export function SettingsPage({
  startup,
  user,
  startupId,
}: PageContext) {
  const current = useRemote<RecordValue>(
    "/api/v1/startups/current",
    startupId,
  );

  const actual = current.data?.startup || startup;
  const me = actual.me || {};
  const capabilities = actual.capabilities || {};

  return (
    <div className="page-stack">
      <PageHeader
        title="Workspace settings"
        description="Review access, capability flags, and workspace configuration returned by the API."
      />

      {current.loading && <LoadingState />}
      {current.error && (
        <ErrorState error={current.error} retry={current.reload} />
      )}

      {current.data && (
        <>
          <div className="settings-grid">
            <section className="card panel">
              <div className="section-heading">
                <h2>Workspace</h2>
                <p>Read-only details from the current-workspace endpoint.</p>
              </div>

              <DefinitionList
                rows={[
                  ["Workspace name", actual.name],
                  ["Workspace ID", actual.id],
                  ["Plan", actual.plan],
                  ["Status", actual.status],
                  ["Trial ends", formatDate(actual.trialEndsAt)],
                  ["Created", formatDate(actual.createdAt)],
                ]}
              />

              <Notice>
                Workspace settings and member-management write endpoints
                are not part of the frozen contract, so they are not
                editable here.
              </Notice>
            </section>

            <section className="card panel">
              <div className="section-heading">
                <h2>Current user access</h2>
                <p>
                  Controls are advisory; server permissions are authoritative.
                </p>
              </div>

              <DefinitionList
                rows={[
                  ["Signed-in user", user?.name || "—"],
                  ["Email", user?.email || "—"],
                  ["Workspace role", me.role],
                  [
                    "Permissions",
                    Array.isArray(me.permissions)
                      ? me.permissions.join(", ")
                      : "—",
                  ],
                ]}
              />
            </section>
          </div>

          <section className="card panel">
            <div className="section-heading">
              <h2>Provider capabilities</h2>
              <p>
                Shown exactly as reported by this workspace; no unavailable
                provider flow is simulated.
              </p>
            </div>

            <div className="capability-grid">
              {[
                [
                  "Company discovery",
                  capabilities.searchOrgs,
                  "Apollo organization search",
                ],
                [
                  "People search",
                  capabilities.searchPeople,
                  "Apollo people search",
                ],
                [
                  "Contact enrichment",
                  capabilities.enrich,
                  "Apollo contact enrichment",
                ],
              ].map(([label, enabled, description]) => (
                <div className="capability-row" key={String(label)}>
                  <span
                    className={`capability-led ${
                      enabled ? "on" : "off"
                    }`}
                  />
                  <div>
                    <b>{String(label)}</b>
                    <small>{String(description)}</small>
                  </div>
                  <Badge tone={enabled ? "green" : "amber"}>
                    {enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="card panel">
            <div className="section-heading">
              <h2>Safety and product behavior</h2>
            </div>

            <div className="safety-list">
              <p>
                <Icon name="check" size={16} />
                Message approval is human-controlled.
              </p>
              <p>
                <Icon name="check" size={16} />
                Handoff uses your email application; no server-side send.
              </p>
              <p>
                <Icon name="check" size={16} />
                No inbox sync, recipient delivery/open tracking, or scheduled
                follow-ups.
              </p>
              <p>
                <Icon name="check" size={16} />
                Usage caps and entitlements are read from configuration and
                not guessed in the browser.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
