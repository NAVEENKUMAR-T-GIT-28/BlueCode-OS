
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import bluecodeLogo from "../assets/bluecode-logo.jpeg";
import {
  LayoutDashboard,
  Building2,
  Trophy,
  Users,
  Send,
  Clock3,
  BarChart3,
  Settings,
  Bell,
  ChevronRight,
  Menu,
  X,
  CircleCheck,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Prospects", path: "/prospects", icon: Building2 },
  { name: "Leads", path: "/leads", icon: Trophy },
  { name: "Decision Makers", path: "/decision-makers", icon: Users },
  { name: "Outreach", path: "/outreach", icon: Send },
  { name: "Follow-ups", path: "/follow-ups", icon: Clock3 },
  { name: "Pipeline & Analytics", path: "/pipeline", icon: BarChart3 },
];

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const currentPage =
    navigation.find((item) => location.pathname.startsWith(item.path))
      ?.name || (location.pathname.startsWith("/settings") ? "Settings" : "Workspace");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* DESKTOP SIDEBAR */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-5">
          <img
            src={bluecodeLogo}
            alt="AI Founder OS"
            className="h-10 w-10 rounded-xl object-contain"
          />

          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-950">
              AI Founder OS
            </h1>
            <p className="text-[11px] font-medium text-slate-400">
              AI Sales Copilot
            </p>
          </div>
        </div>

        {/* DESKTOP NAVIGATION */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.20)]"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={17}
                        className={
                          isActive
                            ? "text-cyan-200"
                            : "text-slate-400 group-hover:text-blue-600"
                        }
                      />
                      <span className="truncate">{item.name}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* SIDEBAR BOTTOM */}
        <div className="border-t border-slate-100 p-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <Settings size={17} />
            Settings
          </NavLink>

          <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CircleCheck size={14} className="text-emerald-500" />
                <p className="text-xs font-bold text-slate-800">
                  Founder Pilot
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-extrabold text-blue-700">
                15 DAYS
              </span>
            </div>

            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              Phase 1 trial workspace
            </p>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <img
            src={bluecodeLogo}
            alt="AI Founder OS"
            className="h-9 w-9 rounded-lg object-contain"
          />

          <div>
            <p className="text-sm font-bold text-slate-950">AI Founder OS</p>
            <p className="text-[9px] font-semibold text-slate-400">
              AI Sales Copilot
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>
      </header>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
          />

          <aside className="absolute left-0 top-0 flex h-full w-[285px] max-w-[88vw] flex-col bg-white shadow-2xl">
            <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
              <div className="flex items-center gap-3">
                <img
                  src={bluecodeLogo}
                  alt="AI Founder OS"
                  className="h-10 w-10 rounded-xl object-contain"
                />

                <div>
                  <p className="text-sm font-bold text-slate-950">
                    AI Founder OS
                  </p>
                  <p className="text-[10px] text-slate-400">
                    AI Sales Copilot
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-5">
              <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Workspace
              </p>

              <div className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={18}
                            className={
                              isActive ? "text-cyan-200" : "text-slate-400"
                            }
                          />
                          <span>{item.name}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-slate-100 p-3">
              <NavLink
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                <Settings size={18} />
                Settings
              </NavLink>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="min-h-screen lg:ml-64">
        {/* DESKTOP TOP BAR */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-8 backdrop-blur lg:flex">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              AI Sales Copilot
            </p>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-800">
                Founder workspace
              </span>

              <ChevronRight size={13} className="text-slate-300" />

              <span className="text-sm font-medium text-slate-500">
                {currentPage}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 xl:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-700">
                System healthy
              </span>
            </div>

            <button
              type="button"
              className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            </button>

            <div className="h-7 w-px bg-slate-200" />

            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">
                ABC Technologies
              </p>
              <p className="text-[10px] font-medium text-slate-400">
                Founder account
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 text-xs font-bold text-white shadow-sm">
              AT
            </div>
          </div>
        </header>

        {/* MOBILE PAGE HEADER */}
        <div className="border-b border-slate-100 bg-white px-4 py-3 lg:hidden">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
            {currentPage}
          </p>

          <p className="mt-0.5 text-xs font-semibold text-slate-700">
            ABC Technologies
          </p>
        </div>

        {/* PAGE CONTENT */}
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
