import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, api, getId } from "./api";
import { WorkspacePicker } from "./features/workspaces/WorkspacePicker";
import { AppShell } from "./layouts/AppShell";
import { Icon, Logo, LoadingState } from "./components/shared";
import { AuthPage } from "./features/auth/AuthPage";
import { AppUser } from "./features/auth/auth.types";
import { renderRoute } from "./features/pages";

type RecordValue = Record<string, any>;
type BrowserLocation = { pathname: string; search: string };



function useBrowserLocation() {
  const [location, setLocation] = useState<BrowserLocation>(() => ({ pathname: window.location.pathname, search: window.location.search }));
  useEffect(() => {
    const update = () => setLocation({ pathname: window.location.pathname, search: window.location.search });
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((path: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setLocation({ pathname: window.location.pathname, search: window.location.search });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);
  return { location, navigate };
}





export default function App() {
  const { location, navigate } = useBrowserLocation();
  const [user, setUser] = useState<AppUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState(() => sessionStorage.getItem("bc_active_startup") || "");
  const setActiveWorkspace = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    if (id) sessionStorage.setItem("bc_active_startup", id); else sessionStorage.removeItem("bc_active_startup");
  }, []);

  useEffect(() => {
    let active = true;
    api.get<{ user: AppUser; memberships?: RecordValue[] }>("/api/v1/auth/me").then((response) => { if (active) setUser(response.data.user); }).catch((error: unknown) => {
      if (active) {
        setUser(null);
        if (error instanceof ApiRequestError && error.code === "NOT_A_MEMBER") setActiveWorkspace("");
      }
    }).finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, [setActiveWorkspace]);

  useEffect(() => {
    if (sessionLoading) return;
    const path = location.pathname;
    const publicPage = path === "/login" || path === "/register";
    if (!user && !publicPage) navigate("/login", true);
    else if (user && (publicPage || path === "/")) navigate(activeWorkspaceIdState ? "/dashboard" : "/workspaces", true);
    else if (user && path !== "/workspaces" && !activeWorkspaceIdState) navigate("/workspaces", true);
  }, [sessionLoading, user, location.pathname, activeWorkspaceIdState, navigate]);

  async function onAuthenticated(nextUser: AppUser) {
    setUser(nextUser);
    try {
      const response = await api.get<{ startups: RecordValue[] }>("/api/v1/startups");
      const workspaces = response.data.startups || [];
      if (workspaces.length === 1) { const id = getId(workspaces[0]); setActiveWorkspace(id); navigate("/dashboard", true); }
      else { setActiveWorkspace(""); navigate("/workspaces", true); }
    } catch { setActiveWorkspace(""); navigate("/workspaces", true); }
  }

  async function logout() {
    try { await api.logout(); } catch { /* Clear local authenticated view even if the network is down. */ }
    setUser(null); setActiveWorkspace(""); navigate("/login", true);
  }

  if (sessionLoading) return <main className="center-shell"><div className="loading-brand"><Logo/><LoadingState label="Checking your session…"/></div></main>;
  if (!user && (location.pathname === "/login" || location.pathname === "/register")) return <AuthPage onAuthenticated={onAuthenticated} navigate={navigate}/>;
  if (!user) return <main className="center-shell"><div className="loading-brand"><Logo/><LoadingState label="Opening sign in…"/></div></main>;
  if (location.pathname === "/workspaces") return <WorkspacePicker navigate={navigate} setActiveWorkspace={setActiveWorkspace} activeWorkspaceId={activeWorkspaceIdState}/>;
  if (!activeWorkspaceIdState) return <WorkspacePicker navigate={navigate} setActiveWorkspace={setActiveWorkspace} activeWorkspaceId={activeWorkspaceIdState}/>;
  return <AppShell key={activeWorkspaceIdState} user={user} startupId={activeWorkspaceIdState} navigate={navigate} location={location} onLogout={() => void logout()} setActiveWorkspace={setActiveWorkspace} renderContent={(context) => renderRoute(context)}/>;
}

