
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  allInitialOutreach,
  allInitialProspects,
  initialActivities
} from "../data/mockData";

const PrototypeContext = createContext(null);
const STORAGE_KEY = "aiSalesCopilotPrototypeV1";

const DEFAULT_FOUNDER_NAME = "Aslesha";

const defaultState = {
  apolloConnectionStatus: "not_connected",
  account: {
    name: DEFAULT_FOUNDER_NAME,
    email: "founder@example.com"
  },
  startup: {
    companyName: "",
    product: "",
    geography: "India",
    customers: "",
    objective: "Book qualified discovery conversations",

    // Demo access for reports
    trialCompleted: true,
    completedBillingMonths: 1
  },
  icp: null,
  prospects: allInitialProspects,
  outreach: allInitialOutreach,
  activities: initialActivities,
  bookingUrl: "",
  selectedPlan: "Starter",
  accountCreated: false,
  selectedProspectId: "p1",
  setupComplete: false,
  icpApproved: false
};

const addActivity = (activities, title, detail, kind = "mail") => [
  {
    id: Date.now(),
    title,
    detail,
    time: "Just now",
    kind
  },
  ...activities
];

// Convert the old username-style display name to the founder's name.
const normalizeFounderName = name => {
  const trimmedName = typeof name === "string" ? name.trim() : "";

  if (
    !trimmedName ||
    trimmedName.toLowerCase() === "aslesha1008"
  ) {
    return DEFAULT_FOUNDER_NAME;
  }

  return trimmedName;
};

const personalizeFounderName = (body, founderName) => {
  if (typeof body !== "string") return body;

  const safeName = normalizeFounderName(founderName);

  return body
    .replace(/\[Founder name\]/gi, safeName)
    .replace(/aslesha1008/gi, safeName);
};

export function PrototypeProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        const loadedState = {
          ...defaultState,
          ...parsed,
          account: {
            ...defaultState.account,
            ...(parsed.account || {}),
            name: normalizeFounderName(parsed.account?.name)
          },
          startup: {
            ...defaultState.startup,
            ...(parsed.startup || {})
          },
          prospects:
            Array.isArray(parsed.prospects) &&
            parsed.prospects.length >= 50
              ? parsed.prospects
              : allInitialProspects,
          outreach:
            Array.isArray(parsed.outreach) &&
            parsed.outreach.length >= 15
              ? parsed.outreach
              : allInitialOutreach
        };

        const founderName = loadedState.account.name;

        return {
          ...loadedState,
          outreach: loadedState.outreach.map(item => ({
            ...item,
            body: personalizeFounderName(
              item.body,
              founderName
            )
          }))
        };
      }
    } catch {
      // Fall back to initial demo data if saved data is invalid.
    }

    return {
      ...defaultState,
      account: {
        ...defaultState.account
      },
      startup: {
        ...defaultState.startup
      },
      prospects: [...allInitialProspects],
      outreach: allInitialOutreach.map(item => ({
        ...item,
        body: personalizeFounderName(
          item.body,
          DEFAULT_FOUNDER_NAME
        )
      })),
      activities: [...initialActivities]
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Continue if browser storage is unavailable.
    }
  }, [state]);

  const actions = useMemo(
    () => ({
      connectApolloDemo: () =>
        setState(s => ({
          ...s,
          apolloConnectionStatus: "demo_connected"
        })),

      disconnectApollo: () =>
        setState(s => ({
          ...s,
          apolloConnectionStatus: "not_connected"
        })),

      updateAccount: account =>
        setState(s => {
          const updatedAccount = {
            ...s.account,
            ...account
          };

          const founderName = normalizeFounderName(
            updatedAccount.name
          );

          updatedAccount.name = founderName;

          return {
            ...s,
            account: updatedAccount,
            outreach: s.outreach.map(item => ({
              ...item,
              body: personalizeFounderName(
                item.body,
                founderName
              )
            }))
          };
        }),

      markAccountCreated: () =>
        setState(s => ({
          ...s,
          accountCreated: true
        })),

      selectPlan: selectedPlan =>
        setState(s => ({
          ...s,
          selectedPlan
        })),

      updateStartup: startup =>
        setState(s => ({
          ...s,
          startup: {
            ...s.startup,
            ...startup
          }
        })),

      saveStartup: startup =>
        setState(s => ({
          ...s,
          startup: {
            ...s.startup,
            ...startup
          },
          setupComplete: true
        })),

      saveIcp: icp =>
        setState(s => ({
          ...s,
          icp,
          icpApproved: false
        })),

      approveIcp: () =>
        setState(s => ({
          ...s,
          icpApproved: true,
          activities: addActivity(
            s.activities,
            "ICP approved",
            "Your approved ICP is now used for this demo workflow.",
            "check"
          )
        })),

      selectProspect: id =>
        setState(s => ({
          ...s,
          selectedProspectId: id
        })),

      updateProspectStatus: (id, status) =>
        setState(s => ({
          ...s,
          prospects: s.prospects.map(p =>
            p.id === id
              ? {
                  ...p,
                  status,
                  stageAgeDays: 0
                }
              : p
          )
        })),

      updateReplyIntent: (outreachId, intent) =>
        setState(s => {
          const item = s.outreach.find(
            o => o.id === outreachId
          );

          if (!item) return s;

          const normalizedIntent = String(intent).toLowerCase();

          const status =
            normalizedIntent === "positive"
              ? "Interested"
              : normalizedIntent === "negative"
                ? "Not interested"
                : "Contacted";

          return {
            ...s,
            outreach: s.outreach.map(o =>
              o.id === outreachId
                ? {
                    ...o,
                    intent,
                    replyReceived: true,
                    status: `Reply received - ${normalizedIntent}`
                  }
                : o
            ),
            prospects: s.prospects.map(p =>
              p.id === item.prospectId
                ? {
                    ...p,
                    intent,
                    replyIntent: intent,
                    replyReceived: true,
                    status
                  }
                : p
            ),
            activities: addActivity(
              s.activities,
              `${intent} reply recorded (demo)`,
              `Reply intent recorded for ${item.company}. No inbox is connected.`,
              "mail"
            )
          };
        }),

      updateOutreach: (id, changes) =>
        setState(s => ({
          ...s,
          outreach: s.outreach.map(o =>
            o.id === id
              ? {
                  ...o,
                  ...changes
                }
              : o
          ),
          activities: changes.status
            ? addActivity(
                s.activities,
                changes.status,
                `Demo workflow updated for ${
                  s.outreach.find(o => o.id === id)?.company ||
                  "prospect"
                }.`,
                "mail"
              )
            : s.activities
        })),

      handoffOutreach: id =>
        setState(s => ({
          ...s,
          outreach: s.outreach.map(o =>
            o.id === id
              ? {
                  ...o,
                  status: "Queued for Apollo (demo)"
                }
              : o
          ),
          activities: addActivity(
            s.activities,
            "Apollo sequence handoff preview",
            `${
              s.outreach.find(o => o.id === id)?.company ||
              "Prospect"
            } queued locally. No live sequence was created.`,
            "mail"
          )
        })),

      createOutreachForProspects: ids =>
        setState(s => {
          const selected = s.prospects.filter(
            p =>
              ids.includes(p.id) &&
              !s.outreach.some(o => o.prospectId === p.id)
          );

          const founderName = normalizeFounderName(
            s.account?.name
          );

          const drafts = selected.map((p, i) => ({
            id: `o${Date.now()}${i}`,
            prospectId: p.id,
            company: p.company,
            person: p.person,
            subject: `A question about ${
              (p.industry || "your industry").toLowerCase()
            } workflows at ${p.company}`,
            body: `Hi ${(p.person || "there").split(" ")[0]},\n\nI’m reaching out because ${p.company} operates in ${
              (p.industry || "your industry").toLowerCase()
            }. We help teams review repeatable workflows and identify where manual work may be reduced.\n\nIf this is relevant to your priorities, would a short conversation be useful? If not, no worries.\n\nBest,\n${founderName}`,
            status: "Needs review",
            step: "Initial email",
            intent: "Not received",
            followUps: []
          }));

          return {
            ...s,
            outreach: [...drafts, ...s.outreach],
            activities: drafts.length
              ? addActivity(
                  s.activities,
                  "Outreach drafts created",
                  `${drafts.length} selected prospect(s) added to the review queue.`,
                  "mail"
                )
              : s.activities
          };
        }),

      updateBookingUrl: bookingUrl =>
        setState(s => ({
          ...s,
          bookingUrl
        })),

      markBookingLinkSentDemo: id =>
        setState(s => {
          const item = s.outreach.find(
            o => o.id === id
          );

          if (!item) return s;

          const sentAt = new Date().toISOString();

          return {
            ...s,
            outreach: s.outreach.map(o =>
              o.id === id
                ? {
                    ...o,
                    bookingLinkSent: true,
                    bookingLinkSentAt: sentAt,
                    status: "Booking link sent (demo)"
                  }
                : o
            ),
            prospects: s.prospects.map(p =>
              p.id === item.prospectId
                ? {
                    ...p,
                    bookingLinkSent: true,
                    bookingLinkSentAt: sentAt,
                    status: "Booking link sent"
                  }
                : p
            ),
            activities: addActivity(
              s.activities,
              "Booking link recorded (demo)",
              `Booking link action recorded for ${item.company}. No real email was sent.`,
              "mail"
            )
          };
        }),

      markFollowUpSentDemo: prospectId =>
        setState(s => {
          const prospect = s.prospects.find(
            p => p.id === prospectId
          );

          if (!prospect) return s;

          const existing = Array.isArray(prospect.followUps)
            ? prospect.followUps
            : [];

          const count = Math.max(
            existing.length,
            Number(prospect.followUpCount) || 0,
            prospect.followUp2Sent
              ? 2
              : prospect.followUp1Sent
                ? 1
                : 0
          );

          const status = String(
            prospect.status || ""
          ).toLowerCase();

          const intent = String(
            prospect.replyIntent || prospect.intent || ""
          ).toLowerCase();

          const stopped =
            prospect.meetingBooked === true ||
            prospect.bookingLinkSent === true ||
            [
              "not interested",
              "rejected",
              "do not contact"
            ].includes(status) ||
            intent === "negative";

          if (stopped || count >= 2) return s;

          const number = count + 1;

          const followUp = {
            number,
            sentAt: new Date().toISOString(),
            demo: true
          };

          return {
            ...s,
            prospects: s.prospects.map(p =>
              p.id === prospectId
                ? {
                    ...p,
                    followUps: [...existing, followUp],
                    followUpCount: number,
                    followUp1Sent: number >= 1,
                    followUp2Sent: number >= 2,
                    status: `Follow-up ${number} recorded (demo)`
                  }
                : p
            ),
            outreach: s.outreach.map(o =>
              o.prospectId === prospectId
                ? {
                    ...o,
                    followUps: [
                      ...(Array.isArray(o.followUps)
                        ? o.followUps
                        : []),
                      followUp
                    ],
                    status: `Follow-up ${number} recorded (demo)`
                  }
                : o
            ),
            activities: addActivity(
              s.activities,
              `Follow-up ${number} recorded (demo)`,
              `Follow-up ${number} recorded for ${prospect.company}. No real email was sent.`,
              "mail"
            )
          };
        }),

      resetDemo: () => {
        localStorage.removeItem(STORAGE_KEY);
        setState({
          ...defaultState,
          account: {
            ...defaultState.account
          },
          startup: {
            ...defaultState.startup
          },
          prospects: [...allInitialProspects],
          outreach: allInitialOutreach.map(item => ({
            ...item,
            body: personalizeFounderName(
              item.body,
              DEFAULT_FOUNDER_NAME
            )
          })),
          activities: [...initialActivities]
        });
      }
    }),
    []
  );

  return (
    <PrototypeContext.Provider value={{ ...state, ...actions }}>
      {children}
    </PrototypeContext.Provider>
  );
}

export function usePrototype() {
  const context = useContext(PrototypeContext);

  if (!context) {
    throw new Error(
      "usePrototype must be used inside PrototypeProvider"
    );
  }

  return context;
}
