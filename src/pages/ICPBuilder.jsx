
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Sparkles,
  Target,
  Users,
  Globe2,
  BriefcaseBusiness,
  ShieldCheck,
  Pencil,
} from "lucide-react";

import bluecodeLogo from "../assets/bluecode-logo.jpeg";

const EXAMPLE_DESCRIPTION =
  "We provide an HR management SaaS platform for mid-sized businesses. We target Information Technology companies, particularly HR Tech and HR management software businesses, with 50–500 employees in India and the United States. Our preferred outreach language is English. We want to reach CEOs, CHROs, HR Heads, and HR Directors. Exclude recruitment agencies, companies with fewer than 50 employees, and direct competitors.";

const DEMO_CRITERIA = {
  industry: "Information Technology",
  vertical: "HR Tech and HR management software",
  companyHeadcount: "50–500 employees",
  geographies: "India, United States",
  languages: "English",
  decisionMakerTitles: "CEO, CHRO, HR Head, HR Director",
  exclusions:
    "Recruitment agencies, companies with fewer than 50 employees, direct competitors",
};

const EMPTY_CRITERIA = {
  industry: "",
  vertical: "",
  companyHeadcount: "",
  geographies: "",
  languages: "",
  decisionMakerTitles: "",
  exclusions: "",
};

const FIELDS = [
  {
    key: "industry",
    label: "Target industry",
    hint: "Which main industry should you target?",
    placeholder: "e.g. Information Technology",
    icon: BriefcaseBusiness,
  },
  {
    key: "vertical",
    label: "Industry vertical",
    hint: "The specific market or niche.",
    placeholder: "e.g. HR Tech, FinTech",
    icon: Target,
  },
  {
    key: "companyHeadcount",
    label: "Company size",
    hint: "The employee range of your ideal companies.",
    placeholder: "e.g. 50–500 employees",
    icon: Users,
  },
  {
    key: "geographies",
    label: "Target geographies",
    hint: "Countries or regions you want to reach.",
    placeholder: "e.g. India, United States",
    icon: Globe2,
  },
  {
    key: "languages",
    label: "Preferred languages",
    hint: "Languages for your target market and outreach.",
    placeholder: "e.g. English",
    icon: Globe2,
  },
  {
    key: "decisionMakerTitles",
    label: "Decision-maker job titles",
    hint: "The people involved in buying decisions.",
    placeholder: "e.g. CEO, CHRO, HR Director",
    icon: Users,
  },
  {
    key: "exclusions",
    label: "Exclusion criteria",
    hint: "Companies or prospects you do not want to target.",
    placeholder: "e.g. Recruitment agencies, direct competitors",
    icon: ShieldCheck,
  },
];

function normalizeCriteria(source = {}) {
  return Object.fromEntries(
    FIELDS.map(({ key }) => {
      const value = source[key];

      return [
        key,
        Array.isArray(value) ? value.join(", ") : String(value || ""),
      ];
    })
  );
}

function toList(value) {
  return String(value || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function missingFields(criteria) {
  return FIELDS.filter(({ key }) => !criteria[key]?.trim());
}

function StepIndicator({ stage }) {
  const steps = [
    { number: 1, label: "ICP Builder" },
    { number: 2, label: "Review ICP" },
  ];

  const current = stage === "review" ? 2 : 1;

  return (
    <div className="mb-8 flex items-start">
      {steps.map((step, index) => {
        const completed = current > step.number;
        const active = current === step.number;

        return (
          <div
            key={step.number}
            className={`flex min-w-0 items-start ${
              index === 0 ? "flex-1" : ""
            }`}
          >
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold ${
                  completed
                    ? "border-blue-700 bg-blue-700 text-white"
                    : active
                      ? "border-blue-700 bg-blue-50 text-blue-800"
                      : "border-slate-300 bg-white text-slate-500"
                }`}
              >
                {completed ? <Check size={17} /> : step.number}
              </div>

              <span
                className={`text-xs font-medium sm:text-sm ${
                  active || completed
                    ? "text-blue-800"
                    : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {index === 0 && (
              <div
                className={`mx-4 mt-[18px] h-px flex-1 ${
                  current === 2 ? "bg-blue-700" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormField({ field, value, onChange }) {
  const Icon = field.icon;

  return (
    <div className="min-w-0 space-y-2">
      <label
        htmlFor={field.key}
        className="flex items-center gap-2 text-sm font-semibold text-slate-800"
      >
        <Icon size={16} className="shrink-0 text-blue-700" />
        {field.label}
      </label>

      <input
        id={field.key}
        value={value}
        onChange={(event) => onChange(field.key, event.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />

      <p className="text-xs leading-5 text-slate-500">{field.hint}</p>
    </div>
  );
}

export default function ICPBuilder({
  onGenerate,
  onCreate,
  isGenerating: externalGenerating = false,
  isSubmitting: externalSubmitting = false,
  error: externalError = "",
}) {
  const navigate = useNavigate();

  const [stage, setStage] = useState("builder");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState(EMPTY_CRITERIA);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [busyGenerating, setBusyGenerating] = useState(false);
  const [busySaving, setBusySaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const [finished, setFinished] = useState(false);

  const generating = externalGenerating || busyGenerating;
  const submitting = externalSubmitting || busySaving;
  const message = localError || externalError;

  function updateCriteria(key, value) {
    setCriteria((previous) => ({
      ...previous,
      [key]: value,
    }));
    setLocalError("");
  }

  async function handleGenerate() {
    if (!description.trim()) {
      setLocalError("Please describe your ideal customer first.");
      return;
    }

    setLocalError("");
    setBusyGenerating(true);

    try {
      if (onGenerate) {
        const result = await onGenerate(description.trim());

        if (!result || typeof result !== "object") {
          throw new Error("The AI response could not be read.");
        }

        setCriteria(normalizeCriteria(result.criteria || result));
      } else {
        // Demo only: simulated AI generation.
        await new Promise((resolve) => setTimeout(resolve, 700));
        setCriteria({ ...DEMO_CRITERIA });
      }

      setHasGenerated(true);
    } catch (err) {
      setLocalError(
        err?.message || "Could not prepare your ICP. Please try again."
      );
    } finally {
      setBusyGenerating(false);
    }
  }

  function handleReview() {
    if (!hasGenerated) {
      setLocalError("Generate your ICP before reviewing it.");
      return;
    }

    const missing = missingFields(criteria);

    if (missing.length) {
      setLocalError(
        `Please complete: ${missing.map((field) => field.label).join(", ")}.`
      );
      return;
    }

    setLocalError("");
    setStage("review");
  }

  async function handleSave() {
    const missing = missingFields(criteria);

    if (missing.length) {
      setStage("builder");
      setLocalError(
        `Please complete: ${missing.map((field) => field.label).join(", ")}.`
      );
      return;
    }

    setBusySaving(true);
    setLocalError("");

    const payload = {
      name: "Primary ICP",
      criteria: {
        description: description.trim(),
        industry: criteria.industry.trim(),
        vertical: criteria.vertical.trim(),
        companyHeadcount: criteria.companyHeadcount.trim(),
        geographies: toList(criteria.geographies),
        languages: toList(criteria.languages),
        decisionMakerTitles: toList(criteria.decisionMakerTitles),
        exclusions: toList(criteria.exclusions),
      },
      criteriaVersion: 1,
      isActive: true,
    };

    try {
      if (onCreate) {
        await onCreate(payload);
      } else {
        // Demo only: browser storage, not a database save.
        localStorage.setItem(
          "aiFounderOS_demoICP",
          JSON.stringify(payload)
        );
      }

      setFinished(true);
    } catch (err) {
      setLocalError(
        err?.message || "Could not complete setup. Please try again."
      );
    } finally {
      setBusySaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={bluecodeLogo}
              alt="AI Founder OS logo"
              className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1.5"
            />

            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-lg">
                AI Founder OS
              </p>
              <p className="text-xs text-slate-500">Sales Copilot</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 sm:flex">
            <Sparkles size={15} />
            ICP Setup
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        {!finished ? (
          <>
            <div className="mb-7">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
                <Target size={14} />
                WORKSPACE SETUP
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
                ICP Builder
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Define your Ideal Customer Profile to identify the right
                companies, reach decision-makers, and guide your sales
                prospecting.
              </p>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8">
              <StepIndicator stage={stage} />

              {stage === "builder" && (
                <div className="space-y-7">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Describe your ideal customer
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Tell us about your product, target companies, and
                      the decision-makers you want to reach.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      {
                        icon: BriefcaseBusiness,
                        title: "Industry",
                        text: "Your target industries and market segments.",
                      },
                      {
                        icon: Users,
                        title: "Company size",
                        text: "The employee range of your ideal companies.",
                      },
                      {
                        icon: Globe2,
                        title: "Geography & language",
                        text: "The markets and languages you want to reach.",
                      },
                      {
                        icon: ShieldCheck,
                        title: "Decision-makers & exclusions",
                        text: "Who to contact and which prospects to avoid.",
                      },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.title}
                          className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                            <Icon size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {item.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="icp-description"
                        className="text-sm font-semibold text-slate-800"
                      >
                        Your business and target customers
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setDescription(EXAMPLE_DESCRIPTION);
                          setLocalError("");
                        }}
                        className="rounded-sm text-xs font-semibold text-blue-700 underline decoration-blue-400 decoration-2 underline-offset-4 transition-all duration-200 hover:text-blue-900 hover:decoration-blue-700 hover:drop-shadow-[0_0_6px_rgba(37,99,235,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        Use example
                      </button>
                    </div>

                    <textarea
                      id="icp-description"
                      value={description}
                      onChange={(event) => {
                        setDescription(event.target.value);
                        setLocalError("");
                      }}
                      rows={7}
                      placeholder="We provide [product/service] for companies in [industry]. Our ideal customers have [employee range], operate in [countries], and we want to reach [job titles]. We want to exclude [companies or prospects]..."
                      className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />

                    <p className="text-xs leading-5 text-slate-500">
                      Add as much detail as you know. You can edit the
                      criteria below before reviewing your profile.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={generating || !description.trim()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {generating ? (
                        <>
                          <LoaderCircle size={18} className="animate-spin" />
                          Preparing your ICP...
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          Generate with AI
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </div>

                  {hasGenerated && (
                    <div className="space-y-6 border-t border-slate-200 pt-7">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={20} className="text-blue-700" />
                          <h2 className="text-xl font-bold text-slate-950">
                            Review and edit your criteria
                          </h2>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          All your ICP fields are on this page. Make any
                          changes before moving to the final review.
                        </p>
                      </div>

                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-950">
                          Frontend demo mode
                        </p>
                        <p className="mt-1 text-sm leading-5 text-blue-900">
                          Sample criteria are displayed for now. Replace
                          them with your actual requirements. AI extraction
                          will be connected when the backend is ready.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {FIELDS.map((field) => (
                          <FormField
                            key={field.key}
                            field={field}
                            value={criteria[field.key]}
                            onChange={updateCriteria}
                          />
                        ))}
                      </div>

                      <div className="flex justify-end border-t border-slate-100 pt-5">
                        <button
                          type="button"
                          onClick={handleReview}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 sm:w-auto"
                        >
                          Review ICP
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    </div>
                  )}

                  {!hasGenerated && message && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      {message}
                    </p>
                  )}
                </div>
              )}

              {stage === "review" && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-950">
                        Review your ICP
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Confirm your target customer profile before
                        completing setup.
                      </p>
                    </div>

                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 size={15} />
                      Ready for review
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Profile name
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">
                      Primary ICP
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                      {description}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    {FIELDS.map((field) => {
                      const Icon = field.icon;

                      return (
                        <div
                          key={field.key}
                          className="flex flex-col gap-2 border-b border-slate-200 p-4 last:border-b-0 sm:flex-row sm:gap-4"
                        >
                          <div className="flex items-center gap-2 sm:w-56 sm:shrink-0">
                            <Icon size={17} className="shrink-0 text-blue-700" />
                            <span className="text-sm font-semibold text-slate-700">
                              {field.label}
                            </span>
                          </div>
                          <p className="min-w-0 break-words text-sm leading-6 text-slate-900">
                            {criteria[field.key]}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm leading-6 text-amber-950">
                      <strong>Important:</strong> Check that these details
                      accurately describe your target customers. You can
                      return to the builder and edit them before saving.
                    </p>
                  </div>

                  {message && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      {message}
                    </p>
                  )}

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setStage("builder");
                        setLocalError("");
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil size={16} />
                      Edit details
                    </button>

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle size={18} className="animate-spin" />
                          Completing setup...
                        </>
                      ) : (
                        <>
                          <Check size={18} />
                          Save ICP and continue
                          <ChevronRight size={17} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <ShieldCheck size={15} />
              Your ICP will connect to your workspace when the backend is ready.
            </p>
          </>
        ) : (
          <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={34} />
            </div>

            <h1 className="mt-6 text-2xl font-bold text-slate-950">
              ICP setup complete!
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your ICP frontend demo is complete. Continue to your dashboard
              to explore AI Founder OS.
            </p>

            {/* Only one final action */}
            <div className="mt-7 flex justify-center">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 sm:w-auto"
              >
                Go to dashboard
                <ArrowRight size={17} />
              </button>
            </div>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Demo mode only: the ICP is stored in this browser, not in your database.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
