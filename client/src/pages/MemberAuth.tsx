import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, LockKeyhole, UserRound } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api, jsonBody } from "@/lib/api";

export default function MemberAuth() {
  const [location, setLocation] = useLocation();
  const signup = location === "/signup";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => { try { return sessionStorage.getItem("gm-member-signup-notice") ?? ""; } catch { return ""; } });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signup && notice) { try { sessionStorage.removeItem("gm-member-signup-notice"); } catch { /* storage is optional */ } }
  }, [signup, notice]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await api<{ message?: string }>(`/api/gm/member/${signup ? "signup" : "login"}`, {
        method: "POST",
        body: jsonBody(signup ? { displayName, email, password } : { email, password }),
      });
      setPassword("");
      if (signup) {
        const confirmation = result.message ?? "If an account can be created for that email, it is ready. Sign in to continue.";
        try { sessionStorage.setItem("gm-member-signup-notice", confirmation); } catch { /* confirmation also appears in current page state */ }
        setNotice(confirmation); setLocation("/login");
      } else setLocation("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your request could not be completed.");
    } finally { setBusy(false); }
  }

  return <div className="admin-login-shell member-auth-shell">
    <header className="site-header"><div className="header-inner"><Brand /><Link href="/" className="back-link"><ArrowLeft size={15} /> Public site</Link></div></header>
    <main className="login-main member-auth-main">
      <div className="login-art member-auth-art"><div className="login-art-corner">GET MCHONGO / MEMBERS</div><div className="login-sun" /><div className="login-route"><span /><span /><span /></div><p>Your next move,<br />kept close.</p><small>JOB SEEKER DASHBOARD</small></div>
      <section className="login-card">
        <div className="login-icon"><UserRound size={21} /></div>
        <span className="eyebrow muted-eyebrow">GET MCHONGO · JOB SEEKERS</span>
        <h1>{signup ? "Create your account." : "Welcome back."}</h1>
        <p className="login-intro">{signup ? "Save opportunities, set job alerts and check how your CV matches a role." : "Sign in to see your saved opportunities and job matches."}</p>
        {notice && !signup && <p role="status" className="admin-alert success-alert">{notice}</p>}
        <form onSubmit={submit} className="admin-form login-form">
          {signup && <label>Display name<input type="text" autoComplete="name" minLength={2} maxLength={100} value={displayName} onChange={event => setDisplayName(event.target.value)} required /></label>}
          <label>Email address<input type="email" autoComplete="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 12 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required />{signup && <small className="field-help">Use at least 12 characters. Your password is stored as a salted hash and is never visible in admin.</small>}</label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
        </form>
        <p className="login-secure-note"><LockKeyhole size={13} />Your CV text is checked for this request only and is not saved.</p>
        <Link className="login-public-link" href={signup ? "/login" : "/signup"}>{signup ? "Already have an account? Sign in" : "New to Get Mchongo? Create an account"}</Link>
      </section>
    </main>
    <footer className="site-footer login-footer"><Brand light /><p>Made for the next move.</p><span className="footer-year">JOB SEEKER ACCOUNT</span></footer>
  </div>;
}
