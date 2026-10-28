import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Clipboard, LockKeyhole, Search, ShieldCheck, UserRound } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api, jsonBody } from "@/lib/api";

const plans = [
  { id: "small", range: "0–199 members", amount: 15000, detail: "For a smaller member directory" },
  { id: "medium", range: "200–999 members", amount: 30000, detail: "For a growing member directory" },
  { id: "large", range: "1,000+ members", amount: 50000, detail: "For the full larger directory" },
] as const;
type PlanId = typeof plans[number]["id"];
type Recruiter = { id: number; email: string; contactName: string; phone: string; companyName: string; location: string; businessDetails: string; memberCount: number; tier: PlanId; priceTsh: number; paymentStatus: "unsubmitted" | "submitted" | "verified" | "rejected"; accessStatus: "pending" | "approved" | "rejected"; payerPhone: string | null; paymentReference: string | null };
type DirectoryMember = { fullName: string; profession: string; location: string; phoneNumber: string; email: string };
const planFor = (id: PlanId) => plans.find(plan => plan.id === id) ?? plans[0];
const paymentStatusText = (value: Recruiter["paymentStatus"]) => value === "verified" ? "Payment verified" : value === "submitted" ? "Payment details submitted · awaiting review" : value === "rejected" ? "Payment not verified" : "Payment not submitted";
const accountStatusText = (value: Recruiter["accessStatus"]) => value === "approved" ? "Access approved" : value === "rejected" ? "Application declined" : "Awaiting admin approval";
const representativeCount: Record<PlanId, number> = { small: 100, medium: 500, large: 1000 };

export default function RecruiterPortal() {
  const [authenticated, setAuthenticated] = useState(false);
  const [recruiter, setRecruiter] = useState<Recruiter | null>(null);
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [businessDetails, setBusinessDetails] = useState("");
  const [plan, setPlan] = useState<PlanId>("small");
  const [payerPhone, setPayerPhone] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadDashboard() {
    const result = await api<{ recruiter: Recruiter }>("/api/gm/recruiter/dashboard");
    setRecruiter(result.recruiter);
    setAuthenticated(true);
    if (result.recruiter.paymentStatus === "verified" && result.recruiter.accessStatus === "approved") {
      const people = await api<{ members: DirectoryMember[] }>("/api/gm/recruiter/directory");
      setDirectory(people.members);
    } else setDirectory([]);
  }

  useEffect(() => {
    let active = true;
    api<{ authenticated: boolean }>("/api/gm/recruiter/session").then(async session => {
      if (active && session.authenticated) await loadDashboard();
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleDirectory = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return directory;
    return directory.filter(person => [person.fullName, person.profession, person.location].some(value => value.toLowerCase().includes(needle)));
  }, [directory, query]);

  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    try {
      if (mode === "signup") {
        const result = await api<{ message?: string }>("/api/gm/recruiter/signup", { method: "POST", body: jsonBody({ email, password, contactName, phone: phoneNumber, companyName: businessName, location, businessDetails, memberCount: representativeCount[plan] }) });
        setNotice(result.message ?? "Account created. Sign in to continue with your payment details.");
        setMode("login"); setPassword("");
      } else {
        await api("/api/gm/recruiter/login", { method: "POST", body: jsonBody({ email, password }) });
        setPassword(""); await loadDashboard();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your request could not be completed."); }
    finally { setBusy(false); }
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    try {
      await api("/api/gm/recruiter/payment", { method: "POST", body: jsonBody({ payerPhone, paymentReference }) });
      setNotice("Payment details submitted. An administrator will verify the payment and review your access request.");
      await loadDashboard();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Payment details could not be submitted."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    try { await api("/api/gm/recruiter/logout", { method: "POST", body: "{}" }); }
    finally { setAuthenticated(false); setRecruiter(null); setDirectory([]); setMode("login"); }
  }

  async function copyNumber() {
    try { await navigator.clipboard.writeText("0638386459"); setNotice("HaloPesa number copied."); }
    catch { setNotice("Send the payment to HaloPesa number 0638386459."); }
  }

  const currentPlan = recruiter ? planFor(recruiter.tier) : planFor(plan);
  const canViewDirectory = recruiter?.paymentStatus === "verified" && recruiter.accessStatus === "approved";

  if (loading) return <div className="admin-loading"><Brand /><span className="loading-dot" />Checking recruiter access…</div>;

  return <div className="admin-login-shell recruiter-shell">
    <header className="site-header"><div className="header-inner"><Brand /><Link href="/" className="back-link"><ArrowLeft size={15} /> Public site</Link></div></header>
    <main className="recruiter-main">
      {!authenticated || !recruiter ? <section className="recruiter-layout">
        <div className="recruiter-intro"><span className="eyebrow muted-eyebrow">GET MCHONGO · RECRUITER ACCESS</span><h1>Meet people ready for their next move.</h1><p>Request access to professional profiles shared by members who opted into the talent directory. Every recruiter account and payment is reviewed before access is granted.</p><div className="recruiter-plan-list">{plans.map(item => <button type="button" key={item.id} className={`recruiter-plan-card${plan === item.id ? " selected" : ""}`} onClick={() => setPlan(item.id)} aria-pressed={plan === item.id}><span><strong>{item.range}</strong><small>{item.detail}</small></span><b>TSh {item.amount.toLocaleString("en-US")}</b>{plan === item.id && <Check size={16} />}</button>)}</div><div className="recruiter-privacy-note"><ShieldCheck size={17} /><span>Only opted-in member profiles are available to approved recruiters. Profile CVs remain private and are not included.</span></div></div>
        <section className="login-card recruiter-form-card"><div className="login-icon"><BriefcaseBusiness size={21} /></div><span className="eyebrow muted-eyebrow">RECRUITER ACCOUNT</span><h2>{mode === "signup" ? "Request access." : "Welcome back."}</h2><p className="login-intro">{mode === "signup" ? "Create your recruiter account and select an access tier. Payment is verified manually; access requires admin approval." : "Sign in to submit payment information or check your application status."}</p>{notice && <p role="status" className="admin-alert success-alert">{notice}</p>}<form className="admin-form login-form recruiter-form" onSubmit={submitAccount}>
          {mode === "signup" && <><label>Contact name<input autoComplete="name" minLength={2} maxLength={100} value={contactName} onChange={event => setContactName(event.target.value)} required /></label><label>Contact phone<input type="tel" autoComplete="tel" maxLength={40} value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} required /></label><label>Company or business name<input autoComplete="organization" maxLength={240} value={businessName} onChange={event => setBusinessName(event.target.value)} required /></label><label>Business location<input maxLength={160} value={location} onChange={event => setLocation(event.target.value)} required /></label><label>About your business<textarea rows={3} maxLength={1500} value={businessDetails} onChange={event => setBusinessDetails(event.target.value)} required /></label><label>Selected access tier<select value={plan} onChange={event => setPlan(event.target.value as PlanId)}>{plans.map(item => <option key={item.id} value={item.id}>{item.range} — TSh {item.amount.toLocaleString("en-US")}</option>)}</select></label></>}
          <label>Email address<input type="email" autoComplete="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 6 : undefined} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required />{mode === "signup" && <small className="field-help">At least 6 characters, with an uppercase letter, lowercase letter and symbol.</small>}</label>
          {error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create recruiter account" : "Sign in"}<ArrowRight size={16} /></button>
        </form><p className="login-secure-note"><LockKeyhole size={13} />Your recruiter access remains restricted until payment is verified and your application is approved.</p><button type="button" className="login-public-link recruiter-mode-toggle" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); setNotice(""); }}>{mode === "signup" ? "Already have a recruiter account? Sign in" : "Need recruiter access? Create an account"}</button></section>
      </section> : <section className="recruiter-dashboard"><div className="recruiter-dashboard-head"><div><span className="eyebrow muted-eyebrow">RECRUITER PORTAL</span><h1>{recruiter.companyName}</h1><p>{recruiter.contactName} · {recruiter.location} · {recruiter.email}</p></div><button className="secondary-button" type="button" onClick={() => void signOut()}>Sign out</button></div>
        {notice && <p role="status" className="admin-alert success-alert">{notice}</p>}{error && <p role="alert" className="admin-alert error-alert">{error}</p>}
        <div className="recruiter-status-grid"><article className="admin-panel"><span className="eyebrow muted-eyebrow">SELECTED DATABASE TIER</span><h2>{currentPlan.range}</h2><strong>TSh {recruiter.priceTsh.toLocaleString("en-US")}</strong></article><article className="admin-panel"><span className="eyebrow muted-eyebrow">PAYMENT</span><h2>{paymentStatusText(recruiter.paymentStatus)}</h2><p>{recruiter.payerPhone ? `Payer phone: ${recruiter.payerPhone}` : "Payment details have not been submitted."}</p></article><article className="admin-panel"><span className="eyebrow muted-eyebrow">ACCESS DECISION</span><h2>{accountStatusText(recruiter.accessStatus)}</h2><p>Payment confirmation and account approval are reviewed separately.</p></article></div>
        {!canViewDirectory && recruiter.paymentStatus !== "verified" && <section className="admin-panel recruiter-payment-panel"><div className="panel-heading"><div><span className="eyebrow muted-eyebrow">MANUAL HALOPESA PAYMENT</span><h2>Pay TSh {recruiter.priceTsh.toLocaleString("en-US")} to continue</h2></div><button type="button" className="secondary-button" onClick={() => void copyNumber()}><Clipboard size={15} />Copy number</button></div><div className="recruiter-payee"><span>HaloPesa recipient number</span><strong>0638386459</strong><small>Open your HaloPesa app and send the selected plan amount. This site does not initiate or automatically confirm the transfer.</small></div><form className="admin-form recruiter-payment-form" onSubmit={submitPayment}><label>Your payer phone number<input type="tel" maxLength={40} value={payerPhone} onChange={event => setPayerPhone(event.target.value)} required /></label><label>Transaction ID or payment reference<input maxLength={120} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} required /><small className="field-help">Enter the reference shown by HaloPesa so the administrator can verify it.</small></label><button className="primary-button" type="submit" disabled={busy || recruiter.paymentStatus === "submitted"}>{busy ? "Submitting…" : recruiter.paymentStatus === "submitted" ? "Payment details submitted" : "Submit payment details"}<ArrowRight size={15} /></button></form></section>}
        {canViewDirectory ? <section className="admin-panel recruiter-directory-panel"><div className="member-directory-heading"><div><span className="eyebrow muted-eyebrow">OPTED-IN TALENT DIRECTORY</span><h2>Member profiles</h2><p>{directory.length} profiles are currently shared with approved recruiters.</p></div><label className="member-directory-search"><Search size={16} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search profession or location" aria-label="Search member profiles" /></label></div>{visibleDirectory.length ? <div className="member-admin-table-wrap"><table className="member-admin-table"><thead><tr><th>Professional</th><th>Profession</th><th>Location</th><th>Phone</th><th>Email</th></tr></thead><tbody>{visibleDirectory.map((person, index) => <tr key={`${person.email}-${index}`}><td>{person.fullName}</td><td>{person.profession}</td><td>{person.location}</td><td><a href={`tel:${person.phoneNumber}`}>{person.phoneNumber}</a></td><td><a href={`mailto:${person.email}`}>{person.email}</a></td></tr>)}</tbody></table></div> : <div className="admin-empty"><span className="admin-empty-symbol"><UserRound size={19} /></span><h2>{directory.length ? "No profiles match this search" : "No shared profiles yet"}</h2><p>Only members who opted into the talent directory appear here. CV files are not provided to recruiters.</p></div>}</section> : <div className="recruiter-pending-note"><ShieldCheck size={18} /><span>Your directory access will appear here only after the administrator verifies payment and approves your recruiter account.</span></div>}
        <Link className="login-public-link recruiter-public-link" href="/">Return to the public opportunities site <ArrowRight size={14} /></Link>
      </section>}
    </main>
    <footer className="site-footer login-footer"><Brand light /><p>Made for the next move.</p><span className="footer-year">RECRUITER ACCESS</span></footer>
  </div>;
}
