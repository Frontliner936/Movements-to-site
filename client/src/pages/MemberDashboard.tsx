import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Award, Bookmark, BriefcaseBusiness, FileCheck2, FileText, LogOut, Mail, MapPin, Phone, RefreshCw, ShieldCheck, Sparkles, Trash2, UserRound } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api, jsonBody, type Job } from "@/lib/api";

type Member = { id: number; displayName: string; email: string; createdAt: string; lastSignedIn: string | null; alertsEnabled: boolean; alertCategories: string[]; alertLocations: string[] };
type MemberProfile = { fullName: string; phoneNumber: string; location: string; profession: string; directoryOptIn: boolean; cvFileName: string | null; updatedAt: string | null };
type ProfileFields = Omit<MemberProfile, "cvFileName" | "updatedAt">;
type Result = { score: number; matchedKeywords: string[]; missingKeywords: string[]; sectionsFound: number; sectionCount: number; jobTitle: string; note: string };
type DashboardData = { member: Member; favorites: Job[]; alerts: Job[] };
const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf";
const CV_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "rtf"]);

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 32_768, bytes.length)));
  return btoa(binary);
}

function validateCvFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!CV_EXTENSIONS.has(extension)) throw new Error("Choose a PDF, DOC, DOCX, TXT or RTF file.");
  if (!file.size) throw new Error("The selected CV file is empty.");
  if (file.size > CV_MAX_BYTES) throw new Error("CV files must be 5 MB or smaller.");
}

const emptyProfile: ProfileFields = { fullName: "", phoneNumber: "", location: "", profession: "", directoryOptIn: false };

export default function MemberDashboard() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [chosenCategories, setChosenCategories] = useState<string[]>([]);
  const [chosenLocations, setChosenLocations] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileFields, setProfileFields] = useState<ProfileFields>(emptyProfile);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const [profileCvFile, setProfileCvFile] = useState<File | null>(null);
  const [removeStoredCv, setRemoveStoredCv] = useState(false);
  const [matchCvFile, setMatchCvFile] = useState<File | null>(null);
  const [cvJobId, setCvJobId] = useState("");
  const matchCvInput = useRef<HTMLInputElement>(null);
  const profileCvInput = useRef<HTMLInputElement>(null);
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
      try {
        const profileResult = await api<{ profile: MemberProfile }>("/api/gm/member/profile");
        setProfile(profileResult.profile);
        setProfileFields({ fullName: profileResult.profile.fullName || dashboard.member.displayName, phoneNumber: profileResult.profile.phoneNumber, location: profileResult.profile.location, profession: profileResult.profile.profession, directoryOptIn: profileResult.profile.directoryOptIn });
        setProfileUnavailable(false);
      } catch {
        // An unapplied optional profile-table migration must not block saved jobs, alerts, or CV matching.
        setProfile(null);
        setProfileFields({ ...emptyProfile, fullName: dashboard.member.displayName });
        setProfileUnavailable(true);
      }
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

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setMessageError(false); setBusy(true);
    try {
      if (profileUnavailable) throw new Error("Profile saving is temporarily unavailable. Please ask the site administrator to apply the member-profile database update. Saved jobs, alerts and CV matching are still available.");
      if (profileCvFile) validateCvFile(profileCvFile);
      const payload: Record<string, unknown> = { ...profileFields, removeCv: removeStoredCv && !profileCvFile };
      if (profileCvFile) {
        payload.cvFileName = profileCvFile.name;
        payload.cvBase64 = await fileToBase64(profileCvFile);
      }
      const saved = await api<{ profile: MemberProfile }>("/api/gm/member/profile", { method: "PUT", body: jsonBody(payload) });
      setProfile(saved.profile);
      setProfileFields({ fullName: saved.profile.fullName, phoneNumber: saved.profile.phoneNumber, location: saved.profile.location, profession: saved.profile.profession, directoryOptIn: saved.profile.directoryOptIn });
      setProfileCvFile(null); setRemoveStoredCv(false);
      if (profileCvInput.current) profileCvInput.current.value = "";
      setMessage(saved.profile.directoryOptIn ? "Your profile is saved and shared privately with the Get Mchongo administrator." : "Your profile is saved privately. It is not visible to the administrator unless you opt in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Your profile could not be saved."); setMessageError(true); }
    finally { setBusy(false); }
  }

  async function checkCv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setMessageError(false); setResult(null); setBusy(true);
    try {
      if (!matchCvFile) throw new Error("Choose your CV file first.");
      validateCvFile(matchCvFile);
      const response = await api<Result & { retained: false }>("/api/gm/member/cv-match", { method: "POST", body: jsonBody({ cvFileName: matchCvFile.name, cvBase64: await fileToBase64(matchCvFile), jobId: Number(cvJobId) }) });
      setResult(response); setMatchCvFile(null);
      if (matchCvInput.current) matchCvInput.current.value = "";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Your CV could not be checked."); setMessageError(true); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="admin-loading"><Brand /><span className="loading-dot" />Opening your dashboard…</div>;
  if (!data) return <div className="member-page"><header className="site-header"><div className="header-inner"><Brand /></div></header><main className="member-error"><h1>We couldn't open your dashboard.</h1><p>{message || "Please sign in and try again."}</p><Link className="primary-button" href="/login">Sign in <ArrowRight size={15} /></Link></main></div>;

  const favoriteIds = new Set(data.favorites.map(job => job.id));
  const profileName = profile?.fullName || data.member.displayName;
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");
  const profileHasDetails = Boolean(profile?.profession || profile?.location || profile?.phoneNumber || profile?.cvFileName);
  return <div className="member-page">
    <header className="member-topbar"><Brand /><div><span className="member-signed-in"><ShieldCheck size={14} />Private member area</span><strong>{data.member.displayName}</strong><button type="button" className="member-signout" onClick={() => void signOut()}><LogOut size={14} />Sign out</button></div></header>
    <main className="member-content">
      <section className="member-welcome"><span className="eyebrow"><span className="eyebrow-dot" />YOUR CAREER SPACE</span><h1>Your next move, clearly in view.</h1><p>Keep your profile sharp, shortlist opportunities and track roles that fit where you want to go.</p><Link href="/#opportunities" className="secondary-button">Explore opportunities <ArrowRight size={15} /></Link></section>
      <section className="member-profile-hero" aria-label="Your professional profile summary">
        <div className="member-profile-visual" aria-hidden="true"><span className="member-profile-orbit member-profile-orbit-one" /><span className="member-profile-orbit member-profile-orbit-two" /><span className="member-profile-initials">{profileInitials || "GM"}</span><span className="member-profile-star">✦</span></div>
        <div className="member-profile-summary">
          <div className="member-profile-kicker"><span className="eyebrow muted-eyebrow">YOUR PROFESSIONAL PROFILE</span><span className={profileHasDetails ? "member-profile-status is-ready" : "member-profile-status"}>{profileHasDetails ? "PROFILE SAVED" : "GET STARTED"}</span></div>
          <h2>{profile?.profession || "Make your experience stand out"}</h2>
          <p className="member-profile-person-name">{profileName}</p>
          <div className="member-profile-facts">
            <span><MapPin size={15} /><span><small>REGION</small><strong>{profile?.location || "Add your region"}</strong></span></span>
            <span><Phone size={15} /><span><small>PHONE</small><strong>{profile?.phoneNumber || "Add your phone number"}</strong></span></span>
            <span><Mail size={15} /><span><small>EMAIL</small><strong>{data.member.email}</strong></span></span>
            <span><FileCheck2 size={15} /><span><small>CV STATUS</small><strong>{profile?.cvFileName ? "CV saved to your profile" : "No profile CV saved"}</strong></span></span>
          </div>
        </div>
        <a className="member-profile-edit" href="#member-profile-editor"><Award size={16} />{profileHasDetails ? "Update profile" : "Add your details"}<ArrowRight size={14} /></a>
      </section>
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

        <section id="member-profile-editor" className="member-panel member-profile-panel"><div className="member-section-heading"><span className="member-section-icon"><UserRound size={18} /></span><div><span className="eyebrow muted-eyebrow">YOUR PROFESSIONAL PROFILE</span><h2>Shape your profile</h2></div></div><p className="member-panel-intro">Add your profession or qualifications, contact details and CV. Your information is private by default; you decide whether to share it with the Get Mchongo administrator.</p>
          {profileUnavailable && <p role="status" className="admin-alert error-alert">Profile saving and stored-CV features are temporarily unavailable. The site administrator may need to apply the member-profile database update. Saved jobs, alerts and one-time CV matching are still available.</p>}
          <form className="admin-form member-profile-form" onSubmit={saveProfile}>
            <label>Full name<input value={profileFields.fullName} onChange={event => setProfileFields(current => ({ ...current, fullName: event.target.value }))} maxLength={150} required={profileFields.directoryOptIn} placeholder="Your full name" /></label>
            <label>Phone number<input type="tel" value={profileFields.phoneNumber} onChange={event => setProfileFields(current => ({ ...current, phoneNumber: event.target.value }))} maxLength={40} required={profileFields.directoryOptIn} placeholder="e.g. +255 7XX XXX XXX" /></label>
            <label>Location<input value={profileFields.location} onChange={event => setProfileFields(current => ({ ...current, location: event.target.value }))} maxLength={160} required={profileFields.directoryOptIn} placeholder="City or region" /></label>
            <label>Profession / qualifications<input value={profileFields.profession} onChange={event => setProfileFields(current => ({ ...current, profession: event.target.value }))} maxLength={160} required={profileFields.directoryOptIn} placeholder="e.g. Accountant, Nursing Officer, BSc in IT" /></label>
            <label className="member-file-field"><span>Upload or replace your profile CV</span><input ref={profileCvInput} type="file" accept={CV_ACCEPT} onChange={event => { const file = event.target.files?.[0] ?? null; setProfileCvFile(file); if (file) setRemoveStoredCv(false); }} /><small>PDF, DOC, DOCX, TXT or RTF · maximum 5 MB</small></label>
            {profile?.cvFileName && <div className="member-existing-cv"><FileText size={15} /><span>{removeStoredCv ? "CV will be removed when you save" : profileCvFile ? `Replacing ${profile.cvFileName}` : profile.cvFileName}</span>{!removeStoredCv && !profileCvFile && <button type="button" className="member-remove-cv" onClick={() => setRemoveStoredCv(true)}><Trash2 size={13} />Remove CV</button>}</div>}
            <label className="member-consent-control"><input type="checkbox" checked={profileFields.directoryOptIn} onChange={event => setProfileFields(current => ({ ...current, directoryOptIn: event.target.checked }))} /><span><strong>Share my profile with Get Mchongo</strong><small>I agree that the Get Mchongo administrator may view my name, phone number, profession, location and uploaded CV to identify me for relevant work opportunities. Recruiters and the public will not have access. I can withdraw consent at any time.</small></span></label>
            <p className="member-privacy-note">If you leave sharing off, your saved profile and CV remain private to you. Withdrawing consent hides your information from the admin directory immediately.</p>
            <button type="submit" className="secondary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}<ArrowRight size={14} /></button>
          </form>
        </section>

        <section className="member-panel member-cv-panel"><div className="member-section-heading"><span className="member-section-icon"><RefreshCw size={18} /></span><div><span className="eyebrow muted-eyebrow">ROLE MATCH</span><h2>Check your CV</h2></div></div><p className="member-panel-intro">Compare a CV file with a published opportunity. The check looks at shared role keywords and common CV sections.</p>
          <form className="admin-form member-cv-form" onSubmit={checkCv}><label>Choose a job<select value={cvJobId} onChange={event => setCvJobId(event.target.value)} required><option value="">Select a published opportunity</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}{job.companyName ? ` — ${job.companyName}` : ""}</option>)}</select></label><label className="member-file-field"><span>Upload your CV for this match check</span><input ref={matchCvInput} type="file" accept={CV_ACCEPT} onChange={event => setMatchCvFile(event.target.files?.[0] ?? null)} required /><small>PDF, DOC, DOCX, TXT or RTF · maximum 5 MB</small></label><p className="member-privacy-note">This match-check upload is extracted in memory for this request only. The uploaded file and extracted text are discarded and are not saved to your profile.</p><button className="primary-button" type="submit" disabled={busy || !matchCvFile || !cvJobId}>{busy ? "Checking…" : "Check my match"}<ArrowRight size={15} /></button></form>
          {result && <div className="cv-result" role="status"><div className="cv-score"><strong>{result.score}%</strong><span>estimated match</span></div><div><h3>{result.jobTitle}</h3><p>{result.note}</p><p>CV sections detected: {result.sectionsFound}/{result.sectionCount}</p>{result.matchedKeywords.length > 0 && <p><strong>Matched:</strong> {result.matchedKeywords.join(", ")}</p>}{result.missingKeywords.length > 0 && <p><strong>Consider reflecting accurately, if relevant:</strong> {result.missingKeywords.join(", ")}</p>}</div></div>}
        </section>
      </div>
      <p className="member-footer-note"><ShieldCheck size={15} />Your dashboard is private. Profile sharing with the administrator is optional; keep your password to yourself.</p>
    </main>
  </div>;
}
