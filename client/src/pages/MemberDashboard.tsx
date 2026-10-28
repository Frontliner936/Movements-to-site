import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Award, Bookmark, BriefcaseBusiness, CheckCircle2, FileCheck2, FileText, LogOut, Mail, MapPin, Phone, RefreshCw, ShieldCheck, Sparkles, Trash2, UserRound } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api, jsonBody, type Job } from "@/lib/api";
import { ChoiceGroup, PositionGroup } from "@/components/AlertPreferencePicker";

type Member = { id: number; displayName: string; email: string; createdAt: string; lastSignedIn: string | null; alertsEnabled: boolean; emailAlertsEnabled: boolean; alertCategories: string[]; alertPositions?: string[]; alertLocations: string[] };
type MemberProfile = { fullName: string; phoneNumber: string; location: string; profession: string; directoryOptIn: boolean; cvFileName: string | null; updatedAt: string | null };
type ProfileFields = Omit<MemberProfile, "cvFileName" | "updatedAt">;
type AtsCategory = { id: string; label: string; weight: number; score: number; points: number; summary: string; findings: { issue: string; suggestion: string }[] };
type AtsReport = { id: number; score: number; targetLabel: string; createdAt: string; categories: AtsCategory[]; strengths: string[]; matchedKeywords: string[]; missingKeywords: string[]; targetProvided: boolean; disclaimer: string; sourceNotes?: string[] };
type DashboardData = { member: Member; favorites: Job[]; alerts: Job[]; emailAlertsAvailable: boolean; emailAlertSchemaAvailable: boolean };
const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf";
const CV_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "rtf"]);
const ATS_CV_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const JOB_AD_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf,image/jpeg,image/png,image/webp";
const JOB_AD_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "rtf", "jpg", "jpeg", "png", "webp"]);

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

function validateJobAdvertFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!JOB_AD_EXTENSIONS.has(extension)) throw new Error("Choose a PDF, Word, TXT, RTF, JPEG, PNG or WebP job advert.");
  if (!file.size) throw new Error("The selected job-advert file is empty.");
  if (file.size > CV_MAX_BYTES) throw new Error("Job-advert files must be 5 MB or smaller.");
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
  const [chosenPositions, setChosenPositions] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);
  const [emailAlertsAvailable, setEmailAlertsAvailable] = useState(false);
  const [emailAlertSchemaAvailable, setEmailAlertSchemaAvailable] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileFields, setProfileFields] = useState<ProfileFields>(emptyProfile);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const [profileCvFile, setProfileCvFile] = useState<File | null>(null);
  const [removeStoredCv, setRemoveStoredCv] = useState(false);
  const atsCvInput = useRef<HTMLInputElement>(null);
  const jobAdvertInput = useRef<HTMLInputElement>(null);
  const profileCvInput = useRef<HTMLInputElement>(null);
  const [atsCvFile, setAtsCvFile] = useState<File | null>(null);
  const [atsTargetMode, setAtsTargetMode] = useState<"general" | "published" | "custom">("general");
  const [atsJobId, setAtsJobId] = useState("");
  const [atsJobDescription, setAtsJobDescription] = useState("");
  const [jobAdvertFile, setJobAdvertFile] = useState<File | null>(null);
  const [atsReport, setAtsReport] = useState<AtsReport | null>(null);
  const [savedAtsReports, setSavedAtsReports] = useState<AtsReport[]>([]);
  const [reportsAvailable, setReportsAvailable] = useState(true);
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
      setChosenCategories(dashboard.member.alertCategories); setChosenLocations(dashboard.member.alertLocations); setChosenPositions(dashboard.member.alertPositions ?? []); setAlertsEnabled(dashboard.member.alertsEnabled); setEmailAlertsEnabled(dashboard.member.emailAlertsEnabled); setEmailAlertsAvailable(dashboard.emailAlertsAvailable); setEmailAlertSchemaAvailable(dashboard.emailAlertSchemaAvailable);
      try {
        const profileResult = await api<{ profile: MemberProfile }>("/api/gm/member/profile");
        setProfile(profileResult.profile);
        setProfileFields({ fullName: profileResult.profile.fullName || dashboard.member.displayName, phoneNumber: profileResult.profile.phoneNumber, location: profileResult.profile.location, profession: profileResult.profile.profession, directoryOptIn: profileResult.profile.directoryOptIn });
        setProfileUnavailable(false);
      } catch {
        // An unapplied optional profile-table migration must not block saved jobs, alerts or the ATS checker.
        setProfile(null);
        setProfileFields({ ...emptyProfile, fullName: dashboard.member.displayName });
        setProfileUnavailable(true);
      }
      try {
        const saved = await api<{ reports: Array<{ id: number; score: number; targetLabel: string; createdAt: string; report: Omit<AtsReport, "id" | "score" | "targetLabel" | "createdAt"> }> }>("/api/gm/member/cv-reports");
        const reports = saved.reports.map(row => ({ ...row.report, id: row.id, score: row.score, targetLabel: row.targetLabel, createdAt: row.createdAt }));
        setSavedAtsReports(reports); setReportsAvailable(true);
      } catch { setReportsAvailable(false); }
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

  const positionSuggestions = useMemo(() => [...new Set(jobs.map(job => job.title.trim()).filter(title => title.length >= 2 && title.length <= 60))].sort().slice(0, 60), [jobs]);

  function toggleChoice(value: string, list: string[], setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  }

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setMessageError(false); setBusy(true);
    try {
      await api("/api/gm/member/preferences", { method: "PUT", body: jsonBody({ categories: chosenCategories, positions: chosenPositions, locations: chosenLocations, enabled: alertsEnabled, emailAlertsEnabled }) });
      setMessage("Your alert preferences are saved."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preferences could not be saved."); setMessageError(true); }
    finally { setBusy(false); }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setMessageError(false); setBusy(true);
    try {
      if (profileUnavailable) throw new Error("Profile saving is temporarily unavailable. Please ask the site administrator to apply the member-profile database update. Saved jobs, alerts and the ATS checker are still available.");
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

  async function checkAtsCv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setMessageError(false); setAtsReport(null); setBusy(true);
    try {
      if (!atsCvFile) throw new Error("Choose your PDF or DOCX CV first.");
      validateCvFile(atsCvFile);
      const extension = atsCvFile.name.split(".").pop()?.toLowerCase();
      if (extension !== "pdf" && extension !== "docx") throw new Error("The CV Checker accepts PDF and DOCX files only.");
      if (atsTargetMode === "published" && !atsJobId) throw new Error("Choose a published job description to compare with.");
      const pastedJobDescription = atsJobDescription.trim();
      if (atsTargetMode === "custom" && !pastedJobDescription && !jobAdvertFile) throw new Error("Paste a job description or upload a job advert.");
      if (atsTargetMode === "custom" && pastedJobDescription && pastedJobDescription.length < 50) throw new Error("A pasted job description must contain at least 50 characters.");
      if (atsTargetMode === "custom" && pastedJobDescription.length > 20000) throw new Error("A pasted job description must be no more than 20,000 characters.");
      if (atsTargetMode === "custom" && jobAdvertFile) validateJobAdvertFile(jobAdvertFile);
      const body: Record<string, unknown> = { cvFileName: atsCvFile.name, cvBase64: await fileToBase64(atsCvFile), targetMode: atsTargetMode };
      if (atsTargetMode === "published") body.jobId = Number(atsJobId);
      if (atsTargetMode === "custom" && pastedJobDescription) body.jobDescription = pastedJobDescription;
      if (atsTargetMode === "custom" && jobAdvertFile) {
        body.jobAdvertFileName = jobAdvertFile.name;
        body.jobAdvertBase64 = await fileToBase64(jobAdvertFile);
      }
      const saved = await api<{ report: AtsReport }>("/api/gm/member/cv-check", { method: "POST", body: jsonBody(body) });
      setAtsReport(saved.report);
      setSavedAtsReports(current => [saved.report, ...current.filter(report => report.id !== saved.report.id)].slice(0, 50));
      setReportsAvailable(true); setAtsCvFile(null); setJobAdvertFile(null);
      if (atsCvInput.current) atsCvInput.current.value = "";
      if (jobAdvertInput.current) jobAdvertInput.current.value = "";
      setMessage("Your CV review has been saved. Upload an improved PDF or DOCX to create a new report and compare your progress.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Your CV could not be checked."); setMessageError(true); }
    finally { setBusy(false); }
  }

  function viewAtsReport(report: AtsReport) {
    setAtsReport(report);
    document.getElementById("member-ats-report")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function deleteAtsReport(reportId: number) {
    setMessage(""); setMessageError(false);
    try {
      await api(`/api/gm/member/cv-reports/${reportId}`, { method: "DELETE" });
      setSavedAtsReports(current => current.filter(report => report.id !== reportId));
      setAtsReport(current => current?.id === reportId ? null : current);
      setMessage("Saved CV report deleted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The CV report could not be deleted."); setMessageError(true); }
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
          {!alertsEnabled || (!chosenCategories.length && !chosenPositions.length && !chosenLocations.length) ? <div className="member-empty"><Sparkles size={20} /><p>Choose categories, positions or locations below to see new matching jobs here.</p></div> : data.alerts.length ? <div className="member-job-list">{data.alerts.map(job => <article className="member-job-row" key={job.id}><div><Link href={`/jobs/${job.id}`}>{job.title}</Link><p>{job.companyName || "Employer"}{job.location ? ` · ${job.location}` : ""}</p></div><span className="member-new-label">NEW</span></article>)}</div> : <div className="member-empty"><Sparkles size={20} /><p>No recent published jobs match your selections yet.</p></div>}
          <form className="member-preferences" onSubmit={savePreferences}><h3>Choose what to track</h3><small className="member-alert-help">Open a section to choose. Jobs must match one choice from every section you fill in.</small><div className="member-pref-groups"><ChoiceGroup title="Categories" options={categories} chosen={chosenCategories} onToggle={item => toggleChoice(item, chosenCategories, setChosenCategories)} emptyText="No categories available yet." /><PositionGroup title="Positions & departments" chosen={chosenPositions} onChange={setChosenPositions} suggestions={positionSuggestions} /><ChoiceGroup title="Locations" options={locations} chosen={chosenLocations} onToggle={item => toggleChoice(item, chosenLocations, setChosenLocations)} emptyText="No locations available yet." /></div><label className="member-toggle"><input type="checkbox" checked={alertsEnabled} onChange={event => setAlertsEnabled(event.target.checked)} />Show matching jobs in my dashboard</label><small className="member-alert-help">Dashboard alerts remain available here. Email alerts are a separate choice below.</small><label className="member-toggle member-email-alert-toggle"><input type="checkbox" checked={emailAlertsEnabled} disabled={busy || (!emailAlertsAvailable && !emailAlertsEnabled)} aria-describedby="member-email-alert-help" onChange={event => setEmailAlertsEnabled(event.target.checked)} />Email me when a new matching job is posted</label><small id="member-email-alert-help" className={`member-alert-help${emailAlertsAvailable ? " is-ready" : ""}`}>{!emailAlertSchemaAvailable ? "Email preferences need the site administrator to apply database migration 0013." : emailAlertsAvailable ? `New matches will be sent to ${data.member.email}. You can turn off email alerts here at any time.` : emailAlertsEnabled ? "Email delivery is currently unavailable. You may turn off email alerts here." : "Email delivery is not configured yet. Your dashboard alerts will continue to work; ask the site administrator to configure email delivery."}</small><button type="submit" className="secondary-button" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button></form>
        </section>

        <section id="member-profile-editor" className="member-panel member-profile-panel"><div className="member-section-heading"><span className="member-section-icon"><UserRound size={18} /></span><div><span className="eyebrow muted-eyebrow">YOUR PROFESSIONAL PROFILE</span><h2>Shape your profile</h2></div></div><p className="member-panel-intro">Add your profession or qualifications, contact details and CV. Your information is private by default; you decide whether to share it with the Get Mchongo administrator.</p>
          {profileUnavailable && <p role="status" className="admin-alert error-alert">Profile saving and stored-CV features are temporarily unavailable. The site administrator may need to apply the member-profile database update. Saved jobs, alerts and the ATS checker are still available.</p>}
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

        <section className="member-panel member-cv-ats-panel"><div className="member-section-heading"><span className="member-section-icon member-ats-icon"><FileCheck2 size={18} /></span><div><span className="eyebrow muted-eyebrow">CV CHECKER & ATS SCORE</span><h2>Make your CV easier to read</h2></div><span className="member-ats-weight-badge">8 categories · 100 points</span></div>
          <p className="member-panel-intro">Get a practical, evidence-based checklist from your CV text. Add a target job description for a role-specific keyword review, then retest after making improvements.</p>
          <form id="member-ats-form" className="admin-form member-ats-form" onSubmit={checkAtsCv}>
            <label>What would you like to review?<select value={atsTargetMode} onChange={event => { const mode = event.target.value as "general" | "published" | "custom"; setAtsTargetMode(mode); if (mode !== "custom") { setJobAdvertFile(null); setAtsJobDescription(""); if (jobAdvertInput.current) jobAdvertInput.current.value = ""; } }}><option value="general">General CV review</option><option value="published">Compare with a published job</option><option value="custom">Use a specific job description</option></select></label>
            {atsTargetMode === "published" && <label>Published job<select value={atsJobId} onChange={event => setAtsJobId(event.target.value)} required><option value="">Choose a published job</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}{job.companyName ? ` — ${job.companyName}` : ""}</option>)}</select></label>}
            {atsTargetMode === "custom" && <><label>Paste job-description text (optional if you upload an advert)<textarea rows={6} maxLength={20000} value={atsJobDescription} onChange={event => setAtsJobDescription(event.target.value)} placeholder="Paste the role responsibilities and qualifications here (50–20,000 characters). You can also upload the advert below." /><small className="field-help">You may paste text, upload a file, or provide both. Pasted text is not saved with the report.</small></label><label className="member-file-field member-ats-file-field"><span>Upload a job advert (optional)</span><input ref={jobAdvertInput} type="file" accept={JOB_AD_ACCEPT} onChange={event => setJobAdvertFile(event.target.files?.[0] ?? null)} /><small>{jobAdvertFile ? `${jobAdvertFile.name} · ${(jobAdvertFile.size / 1024 / 1024).toFixed(2)} MB` : "PDF, DOC, DOCX, TXT, RTF, JPEG, PNG or WebP · maximum 5 MB"}</small></label></>}
            <label className="member-file-field member-ats-file-field"><span>Upload the CV you want to check</span><input ref={atsCvInput} type="file" accept={ATS_CV_ACCEPT} onChange={event => setAtsCvFile(event.target.files?.[0] ?? null)} required /><small>PDF or DOCX · maximum 5 MB · selectable text required</small></label>
            <p className="member-privacy-note member-ats-privacy"><ShieldCheck size={14} />Your CV file and extracted text are processed for this check and discarded. Only the score, category findings, suggestions and safe target label are saved to your private account. This is a heuristic review—not an ATS system, full proofread or success guarantee.</p>
            <button className="primary-button" type="submit" disabled={busy || !atsCvFile || (atsTargetMode === "published" && !atsJobId) || (atsTargetMode === "custom" && !atsJobDescription.trim() && !jobAdvertFile) || (atsTargetMode === "custom" && atsJobDescription.trim().length > 0 && atsJobDescription.trim().length < 50)}>{busy ? "Reviewing your CV…" : "Check and save report"}<ArrowRight size={15} /></button>
          </form>
          {!reportsAvailable && <p role="status" className="admin-alert error-alert member-ats-migration-note">Saved reports need the latest member CV reports database update. Ask the site administrator to apply the documented migration.</p>}
          {atsReport && <div id="member-ats-report" className="member-ats-report" aria-live="polite"><div className="member-ats-report-heading"><div className="member-ats-score-ring" style={{ "--ats-score": `${atsReport.score}%` } as React.CSSProperties}><strong>{atsReport.score}</strong><span>out of 100</span></div><div><span className="eyebrow muted-eyebrow">SAVED CV REVIEW · {new Date(atsReport.createdAt).toLocaleDateString()}</span><h3>{atsReport.targetLabel}</h3><p>Weighted estimate from eight transparent checks. Each category shows its score and contribution to your total.</p></div></div>
            {atsReport.sourceNotes?.length ? <div className="member-ats-source-notes"><strong>Advert extraction notes</strong><ul>{atsReport.sourceNotes.map((note, index) => <li key={index}>{note}</li>)}</ul><small>Check the original advert to confirm names, requirements, dates and other details were read correctly.</small></div> : null}
            {atsReport.strengths.length > 0 && <div className="member-ats-strengths"><CheckCircle2 size={15} /><span><strong>What’s working:</strong> {atsReport.strengths.join(" · ")}</span></div>}
            <div className="member-ats-category-list">{atsReport.categories.map(category => <article className="member-ats-category" key={category.id}><div className="member-ats-category-top"><div><h4>{category.label}</h4><p>{category.summary}</p></div><strong>{category.score}<small>/100</small></strong></div><div className="member-ats-progress" role="progressbar" aria-label={`${category.label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={category.score}><span style={{ width: `${category.score}%` }} /></div><div className="member-ats-weight-row"><span>Weight {category.weight}%</span><span>Contribution {category.points.toFixed(2)} / {category.weight} points</span></div>{category.findings.length > 0 ? <ul className="member-ats-findings">{category.findings.map((finding, index) => <li key={`${category.id}-${index}`}><strong>{finding.issue}</strong><span>{finding.suggestion}</span></li>)}</ul> : <p className="member-ats-clear"><CheckCircle2 size={13} />No issues detected by this category’s checks.</p>}</article>)}</div>
            {atsReport.targetProvided && <div className="member-ats-keywords"><div><strong>Matched role terms</strong><p>{atsReport.matchedKeywords.length ? atsReport.matchedKeywords.join(" · ") : "No matching terms detected."}</p></div><div><strong>Terms to review</strong><p>{atsReport.missingKeywords.length ? atsReport.missingKeywords.join(" · ") : "No sampled terms are missing."}</p><small>Add a term only if it accurately reflects your skills or experience.</small></div></div>}
            <p className="member-ats-disclaimer">{atsReport.disclaimer}</p><button type="button" className="secondary-button member-ats-retest" onClick={() => { setAtsReport(null); document.getElementById("member-ats-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Retest an improved CV <RefreshCw size={14} /></button>
          </div>}
          <div className="member-ats-history"><div className="member-directory-heading"><div><span className="eyebrow muted-eyebrow">YOUR PRIVATE REPORTS</span><h3>Saved CV reviews</h3><p>Reports stay in your account until you delete them. New tests create separate reports for progress comparisons.</p></div></div>
            {savedAtsReports.length ? <div className="member-ats-report-list">{savedAtsReports.map(report => <article className={`member-ats-history-row${atsReport?.id === report.id ? " selected" : ""}`} key={report.id}><div><span className="member-ats-history-score">{report.score}<small>/100</small></span><span><strong>{report.targetLabel}</strong><small>{new Date(report.createdAt).toLocaleString()}</small></span></div><div><button type="button" className="member-ats-view" onClick={() => viewAtsReport(report)}>View report</button><button type="button" className="member-remove-cv" onClick={() => void deleteAtsReport(report.id)} aria-label={`Delete report for ${report.targetLabel}`}><Trash2 size={14} />Delete</button></div></article>)}</div> : <div className="member-empty member-ats-empty"><FileText size={19} /><p>Your saved CV reports will appear here after your first check.</p></div>}
          </div>
        </section>
      </div>
      <p className="member-footer-note"><ShieldCheck size={15} />Your dashboard is private. Profile sharing with the administrator is optional; keep your password to yourself.</p>
    </main>
  </div>;
}
