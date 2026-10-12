import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Sparkles } from "lucide-react";

function Setup() {
  const navigate = useNavigate();

  const [startupName, setStartupName] = useState("ABC Technologies");
  const [description, setDescription] = useState(
    "We build an AI-powered workflow automation platform for growing B2B SaaS companies."
  );

  const handleContinue = (e) => {
    e.preventDefault();
    navigate("/icp-builder");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400">
              <Sparkles size={20} />
            </div>

            <div>
              <p className="text-sm font-bold">AI Founder OS</p>
              <p className="text-xs text-slate-500">AI Sales Copilot</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-slate-700">Step 1 of 2</p>
            <p className="text-[11px] text-slate-400">Startup setup</p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-2xl">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-600">
              Let's get started
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Tell the Copilot about your startup.
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              We'll use this information to create your first Ideal Customer
              Profile.
            </p>
          </div>

          <form onSubmit={handleContinue}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  Startup name
                </label>

                <div className="relative">
                  <Building2
                    size={17}
                    className="absolute left-3 top-3.5 text-slate-400"
                  />

                  <input
                    value={startupName}
                    onChange={(e) => setStartupName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-2 block text-xs font-bold text-slate-700">
                  What does your product do?
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />

                <p className="mt-2 text-[11px] text-slate-400">
                  Be as specific as possible. The AI will convert this into
                  structured sales criteria.
                </p>
              </div>

              <div className="mt-6 rounded-xl bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-amber-600" />

                  <div>
                    <p className="text-xs font-bold text-amber-900">
                      What happens next?
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      The Copilot will turn your description into industries,
                      company sizes, locations, decision-maker titles and
                      exclusions.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Build my ICP
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Setup;