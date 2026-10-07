import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/api";
import { signInWithPassword, signOutFromSupabase } from "@/lib/supabaseAuth";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("frontlinertech@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await signInWithPassword(email, password);
      const session = await api<{ authenticated: boolean }>("/api/gm/admin/session");
      if (!session.authenticated) {
        await signOutFromSupabase();
        throw new Error("This verified account is not authorized to access the admin dashboard.");
      }
      setPassword("");
      setLocation("/admin");
    }
    catch (reason) {
      await signOutFromSupabase().catch(() => undefined);
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    }
    finally { setBusy(false); }
  }
  return <div className="admin-login-shell"><header className="site-header"><div className="header-inner"><Brand /><Link href="/" className="back-link"><ArrowLeft size={15} /> Public site</Link></div></header><main className="login-main"><div className="login-art"><div className="login-art-corner">GM / ADMIN</div><div className="login-sun"/><div className="login-route"><span/><span/><span/></div><p>One clear place<br />to keep the board moving.</p><small>ADMINISTRATOR ACCESS</small></div><section className="login-card"><div className="login-icon"><LockKeyhole size={21} /></div><span className="eyebrow muted-eyebrow">GET MCHONGO · ADMIN</span><h1>Sign in.</h1><p className="login-intro">Manage listings, companies, sources and review new opportunities.</p><form onSubmit={submit} className="admin-form login-form"><label>Email address<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to dashboard"}<ArrowRight size={16} /></button></form><p className="login-secure-note"><LockKeyhole size={13} /> Protected administrator access</p><Link className="login-public-link" href="/">Return to Get Mchongo</Link></section></main><footer className="site-footer login-footer"><Brand light /><p>Made for the next move.</p><span className="footer-year">ADMIN ACCESS</span></footer></div>;
}
