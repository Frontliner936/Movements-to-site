import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { Link } from "wouter";
import { Brand } from "@/components/Brand";
import {
  getCurrentSupabaseUser,
  signInWithPassword,
  signOutFromSupabase,
  signUpWithPassword,
} from "@/lib/supabaseAuth";

export default function Account() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentSupabaseUser()
      .then(user => {
        if (active) setUserEmail(user?.email ?? null);
      })
      .catch(() => {
        if (active) setUserEmail(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (isSignUp) {
        const result = await signUpWithPassword(email, password);
        if (result.authenticated && result.user?.email) {
          setUserEmail(result.user.email);
          setPassword("");
        } else {
          setNotice("Check your email for a confirmation link, then sign in.");
        }
      } else {
        const user = await signInWithPassword(email, password);
        setUserEmail(user.email ?? email);
        setPassword("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await signOutFromSupabase();
      setUserEmail(null);
      setNotice("You’re signed out.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign out.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-shell">
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <Link href="/" className="back-link">
            <ArrowLeft size={15} /> Public site
          </Link>
        </div>
      </header>
      <main className="login-main">
        <div className="login-art">
          <div className="login-art-corner">GM / ACCOUNT</div>
          <div className="login-sun" />
          <div className="login-route">
            <span />
            <span />
            <span />
          </div>
          <p>Your next move<br />starts with one step.</p>
          <small>MEMBER ACCESS</small>
        </div>
        <section className="login-card">
          <div className="login-icon"><LockKeyhole size={21} /></div>
          <span className="eyebrow muted-eyebrow">GET MCHONGO · ACCOUNT</span>
          <h1>{userEmail ? "You’re signed in." : isSignUp ? "Create an account." : "Sign in."}</h1>
          {userEmail ? (
            <>
              <p className="login-intro">Signed in as {userEmail}.</p>
              {error && <p role="alert" className="form-error">{error}</p>}
              {notice && <p role="status" className="login-intro">{notice}</p>}
              <button className="primary-button login-submit" type="button" onClick={() => void signOut()} disabled={busy}>
                {busy ? "Signing out…" : "Sign out"} <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <p className="login-intro">
                {isSignUp ? "Create an account to use Get Mchongo." : "Sign in to your Get Mchongo account."}
              </p>
              <form onSubmit={submit} className="admin-form login-form">
                <label>
                  Email address
                  <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
                </label>
                <label>
                  Password
                  <input type="password" autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} minLength={8} required />
                </label>
                {error && <p role="alert" className="form-error">{error}</p>}
                {notice && <p role="status" className="login-intro">{notice}</p>}
                <button className="primary-button login-submit" type="submit" disabled={busy}>
                  {busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"} <ArrowRight size={16} />
                </button>
              </form>
              <p className="login-public-link">
                {isSignUp ? "Already have an account? " : "New to Get Mchongo? "}
                <button type="button" className="text-link" onClick={() => { setIsSignUp(value => !value); setError(""); setNotice(""); }}>
                  {isSignUp ? "Sign in" : "Create an account"}
                </button>
              </p>
            </>
          )}
          <p className="login-secure-note"><LockKeyhole size={13} /> Authentication secured by Supabase</p>
        </section>
      </main>
      <footer className="site-footer login-footer">
        <Brand light />
        <p>Made for the next move.</p>
        <span className="footer-year">MEMBER ACCESS</span>
      </footer>
    </div>
  );
}
