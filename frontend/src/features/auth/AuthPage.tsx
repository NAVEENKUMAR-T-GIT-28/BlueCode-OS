import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api";
import { AppUser, RecordValue } from "./auth.types";
import { Badge, Button, Field, Icon, InlineFeedback, Logo } from "../../components/shared";
export function AuthPage({ onAuthenticated, navigate }: { onAuthenticated: (user: AppUser) => Promise<void>; navigate: (path: string) => void }) {
  const isRegister = window.location.pathname === "/register";
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState<unknown>(null); const [message, setMessage] = useState(() => {
    const notice = window.location.pathname === "/login" ? sessionStorage.getItem("bc_registered_notice") || "" : "";
    if (notice) sessionStorage.removeItem("bc_registered_notice");
    return notice;
  });
  useEffect(() => {
    if (window.location.pathname !== "/login") return;
    const notice = sessionStorage.getItem("bc_registered_notice");
    if (notice) { setMessage(notice); sessionStorage.removeItem("bc_registered_notice"); }
  }, [isRegister]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setMessage("");
    try {
      if (isRegister) {
        await api.post<RecordValue>("/api/v1/auth/register", { name: name.trim(), email: email.trim(), password });
        const notice = "Account created. Sign in to continue, then choose or create a workspace.";
        sessionStorage.setItem("bc_registered_notice", notice);
        setMessage(notice);
        setPassword(""); navigate("/login");
      } else {
        const response = await api.post<{ user: AppUser } & RecordValue>("/api/v1/auth/login", { email: email.trim(), password });
        if (!response.data?.user) throw new Error("The login response did not include a user.");
        await onAuthenticated(response.data.user);
      }
    } catch (cause) { setError(cause); }
    finally { setPending(false); }
  }
  return <main className="auth-shell">
    <section className="auth-aside"><Logo light/><div className="auth-copy"><Badge tone="blue">Founder-controlled sales workspace</Badge><h1>Find the right companies. Reach the right people.</h1><p>Organize ideal customer profiles, evaluate stored prospects, and prepare thoughtful outreach with a human in control at every step.</p><div className="auth-benefits"><div><span><Icon name="target" size={17}/></span><div><b>Focus your customer profile</b><small>Keep qualification criteria explicit.</small></div></div><div><span><Icon name="check-square" size={17}/></span><div><b>Review before outreach</b><small>Draft, approve, then hand off to email.</small></div></div><div><span><Icon name="activity" size={17}/></span><div><b>Track what you know</b><small>No inbox sync or delivery claims.</small></div></div></div></div><p className="auth-footnote">BlueCode OS · MVP preview</p></section>
    <section className="auth-panel"><form className="auth-card" onSubmit={submit}><Logo/><div className="auth-heading"><h2>{isRegister ? "Create your account" : "Welcome back"}</h2><p>{isRegister ? "Create an account to get started." : "Sign in to continue to your workspace."}</p></div>                                                                                                                                                                                             
      {isRegister && <Field label="Full name" name="name" value={name} onChange={setName} placeholder="Your name" required minLength={1} maxLength={80} autoComplete="name"/>}
      <Field label="Email address" name="email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required autoComplete="email"/>
      <Field label="Password" name="password" type="password" value={password} onChange={setPassword} placeholder={isRegister ? "At least 10 characters" : "Your password"} required minLength={isRegister ? 10 : 1} autoComplete={isRegister ? "new-password" : "current-password"}/>
      {Boolean(error) && <InlineFeedback error={error}/>}{message && <InlineFeedback success={message}/>}
      <Button type="submit" className="button-full" loading={pending}>{isRegister ? "Create account" : "Sign in"}<Icon name="arrow" size={16}/></Button>
      <p className="auth-switch">{isRegister ? "Already have an account?" : "New to BlueCode OS?"} <button type="button" onClick={() => navigate(isRegister ? "/login" : "/register")}>{isRegister ? "Sign in" : "Create account"}</button></p>
      <p className="auth-security"><Icon name="check" size={14}/> Session is managed with a secure cookie. No token is stored in the browser app.</p>
    </form></section>
  </main>;
}

