import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Bookmark, BriefcaseBusiness, LogOut, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api, jsonBody, type Job } from "@/lib/api";

type Member = { id: number; displayName: string; email: string; createdAt: string; lastSignedIn: string | null; alertsEnabled: boolean; alertCategories: string[]; alertLocations: string[] };
type Result = { score: number; matchedKeywords: string[]; missingKeywords: string[]; sectionsFound: number; sectionCount: number; jobTitle: string; note: string };
type DashboardData = { member: Member; favorites: Job[]; alerts: Job[] };

export default function MemberDashboard() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [chosenCategories, setChosenCategories] = useState<string[]>([]);
  const [chosenLocations, setChosenLocations] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [cvText, setCvText] = useState("");
  const [cvJobId, setCvJobId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [dashboard, listing] = await Promise.all([
        api<DashboardData>("/api/gm/member/dashboard"),
        api<{ jobs: Job[]; categories: string[]; locations: string[] }>("/api/gm/jobs"),
      ]);
      setData(dashboard); setJobs(listing.jobs); setCategories(listing.categories); setLocations(listing.locations);
      setChosenCategories(dashboard.member.alertCategories); setChosenLocations(dashboard.member.alertLocations); setAlertsEnabled(dashboard.member.alertsEnabled);
    } catch (error) {
      if (error instanceof Error && /sign in|401/i.test(error.message)) setLocation("/login");
      else { setMessage(error instanceof Error ? error.message : "Your dashboard could not be loaded."); setMessageError(true); }
    } finally { setLoading(false); }
  }, [setLocation]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function signOut() {
    await api("/api/gm/member/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setLocation("/");
  }

  async function toggleFavorite(jobId: number) {
    setMessage("");
    try { await api(`/api/gm/jobs/${jobId}/react/save`, { method: "POST", body: "{}" }); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update saved jobs."); setMessageError(true); }
  }

  function toggleChoice(value: string, list: string[], setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  }

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setMessageError(false); setBusy(true);
    try {
      await api("/api/gm/member/preferences", { method: "PUT", body: jsonBody({ categories: chosenCategories, locations: chosenLocations, enabled: alertsEnabled }) });
      setMessage("Your private alert preferences are saved."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preferences could not be saved."); setMessageError(true); }
    finally { setBusy(false); }
  }

  async function checkCv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setMessageError(false); setResult(null); setBusy(true);
    try {
      const response = await api<Result & { retained: false }>("/api/gm/member/cv-match", { method: "POST", body: jsonBody({ cvText, jobId: Number(cvJobId) }) });
      setResult(response); setCvText("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Your CV could not be checked."); setMessageError(true); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="admin-loading"><Brand /><span className="loading-dot" />Opening your dashboard…</div>;
  if (!data) return <div className="member-page"><header className="site-header"><div className="header-inner"><Brand /></div></header><main className="member-error"><h1>We couldn't open your dashboard.</h1><p>{message || "Please sign in and try again."}</p><Link className="primary-button" href="/login">Sign in <ArrowRight size={15} /></Link></main></div>;

  const favoriteIds = new Set(data.favorites.map(job => job.id));
  return <div className="member-page">
    <header className="member-topbar"><Brand /><div><span className="member-signed-in"><ShieldCheck size={14} />Private member area</span><strong>{data.member.displayName}</strong><button type="button" className="member-signout" onClick={() => void signOut()}><LogOut size={14} />Sign out</button></div></header>
    <main className="member-content">
      <section className="member-welcome"><span className="eyebrow"><span className="eyebrow-dot" />YOUR NEXT MOVE</span><h1>Good to see you, {data.member.displayName.split(" ")[0]}.</h1><p>Your saved opportunities, job matches and CV check—all in one private place.</p><Link href="/#opportunities" className="secondary-button">Explore opportunities <ArrowRight size={15} /></Link></section>
      {message && <p role="status" className={`admin-alert ${messageError ? "error-alert" : "success-alert"}`}>{message}</p>}
      <div className="member-dashboard-grid">
        <section className="member-panel member-favorites"><div className="member-section-heading"><span className="member-section-icon"><Bookmark size={18} /></span><div><span className="eyebrow muted-eyebrow">YOUR SHORTLIST</span><h2>Saved opportunities</h2></div><span className="member-count">{data.favorites.length}</span></div>
          {data.favorites.length ? <div className="member-job-list">{data.favorites.map(job => <article className="member-job-row" key={job.id}><div><Link href={`/jobs/${job.id}`}>{job.title}</Link><p>{job.companyName || "Employer"}{job.location ? ` · ${job.location}` : ""}</p></div><button type="button" onClick={() => void toggleFavorite(job.id)} aria-label={`Remove ${job.title} from saved jobs`}><Trash2 size={15} /></button></article>)}</div> : <div className="member-empty"><Bookmark size={20} /><p>Saved jobs from the public listings will appear here.</p><Link href="/#opportunities">Browse opportunities <ArrowRight size={13} /></Link></div>}
          {jobs.filter(job => !favoriteIds.has(job.id)).length > 0 && <details className="member-add-job"><summary><BriefcaseBusiness size={15} />Add a job to your shortlist</summary><div className="member-job-list">{jobs.filter(job => !favoriteIds.has(job.id)).slice(0, 10).map(job => <article className="member-job-row" key={job.id}><div><Link href={`/jobs/${job.id}`}>{job.title}</Link><p>{job.companyName || "Employer"}{job.location ? ` · ${job.location}` : ""}</p></div><button type="button" onClick={() => void toggleFavorite(job.id)} aria-label={`Save ${job.title}`}><Bookmark size={15} /></button></article>)}</div></details>}
        </section>

        <section className="member-panel member-alerts"><div className="member-section-heading"><span className="member-section-icon"><Sparkles size={18} /></span><div><span className="eyebrow muted-eyebrow">FRESH MATCHES</span><h2>Jobs for you</h2></div></div>
          {!alertsEnabled || (!chosenCategories.length && !chosenLocations.length) ? <div className="member-empty"><Sparkles size={20} /><p>Choose categories or locations below to see new matching jobs here.</p></div> : data.alerts.length ? <div className="member-job-list">{data.alerts.map(job => <article className="member-job-row" key={job.id}><div><Link href={`/jobs/${job.id}`}>{job.title}</Link><p>{job.companyName || "Employer"}{job.location ? ` · ${job.location}` : ""}</p></div><span className="member-new-label">NEW</span></article>)}</div> : <div className="member-empty"><Sparkles size={20} /><p>No recent published jobs match your selections yet.</p></div>}
          <form className="member-preferences" onSubmit={savePreferences}><h3>Choose what to track</h3><fieldset><legend>Categories</legend><div className="member-chip-list">{categories.slice(0, 24).map(item => <button type="button" key={item} className={chosenCategories.includes(item) ? "member-chip selected" : "member-chip"} aria-pressed={chosenCategories.includes(item)} onClick={() => toggleChoice(item, chosenCategories, setChosenCategories)}>{item}</button>)}</div>{!categories.length && <small>No categories available yet.</small>}</fieldset><fieldset><legend>Locations</legend><div className="member-chip-list">{locations.slice(0, 24).map(item => <button type="button" key={item} className={chosenLocations.includes(item) ? "member-chip selected" : "member-chip"} aria-pressed={chosenLocations.includes(item)} onClick={() => toggleChoice(item, chosenLocations, setChosenLocations)}>{item}</button>)}</div>{!locations.length && <small>No locations available yet.</small>}</fieldset><label className="member-toggle"><input type="checkbox" checked={alertsEnabled} onChange={event => setAlertsEnabled(event.target.checked)} />Show matching jobs in my dashboard</label><button type="submit" className="secondary-button" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button><small className="member-privacy-note">These alerts appear here when you return. Email alerts are not enabled.</small></form>
        </section>

        <section className="member-panel member-cv-panel"><div className="member-section-heading"><span className="member-section-icon"><RefreshCw size={18} /></span><div><span className="eyebrow muted-eyebrow">ROLE MATCH</span><h2>Check your CV</h2></div></div><p className="member-panel-intro">Compare CV text with a published opportunity. The check looks at shared role keywords and common CV sections.</p><form className="admin-form member-cv-form" onSubmit={checkCv}><label>Choose a job<select value={cvJobId} onChange={event => setCvJobId(event.target.value)} required><option value="">Select a published opportunity</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}{job.companyName ? ` — ${job.companyName}` : ""}</option>)}</select></label><label>Paste your CV text<textarea value={cvText} onChange={event => setCvText(event.target.value)} minLength={100} maxLength={30000} rows={8} placeholder="Paste the text from your CV (100–30,000 characters)." required /></label><small className="member-privacy-note">Your CV text is processed only for this request and is not stored. Do not include information you do not want processed.</small><button className="primary-button" type="submit" disabled={busy || cvText.trim().length < 100 || !cvJobId}>{busy ? "Checking…" : "Check my match"}<ArrowRight size={15} /></button></form>{result && <div className="cv-result" role="status"><div className="cv-score"><strong>{result.score}%</strong><span>estimated match</span></div><div><h3>{result.jobTitle}</h3><p>{result.note}</p><p>CV sections detected: {result.sectionsFound}/{result.sectionCount}</p>{result.matchedKeywords.length > 0 && <p><strong>Matched:</strong> {result.matchedKeywords.join(", ")}</p>}{result.missingKeywords.length > 0 && <p><strong>Consider reflecting accurately, if relevant:</strong> {result.missingKeywords.join(", ")}</p>}</div></div>}</section>
      </div>
      <p className="member-footer-note"><ShieldCheck size={15} />Your account dashboard is private. Keep your password to yourself.</p>
    </main>
  </div>;
}
