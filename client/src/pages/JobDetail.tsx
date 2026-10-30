import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowUpRight, Bookmark, CalendarDays, Clock3, ExternalLink, Globe2, Heart, MapPin, Wifi } from "lucide-react";
import { Brand } from "@/components/Brand";
import { CompanyLogo } from "@/components/JobCard";
import { JobQuickShareButtons, JobShareMenu } from "@/components/JobShareMenu";
import { SiteFooter } from "@/components/SiteFooter";
import RichJobText from "@/components/RichJobText";
import { RawSocialPostText } from "@/components/RichJobText";
import { HideBrokenImage } from "@/components/HideBrokenImage";
import { api, recordJobView, type Job } from "@/lib/api";
import { applyJobPageMetadata } from "@/lib/pageMetadata";
import { formatPostedAgo } from "@/lib/timeAgo";
import { jobDeadlineLabel } from "@/lib/jobFormatting";

function hasMultipleApplicationSteps(value: string) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
  return lines.length > 1 && lines.every(line => /^(?:\d+[.)]|[-*•▪‣])\s+/.test(line));
}

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [memberLoading, setMemberLoading] = useState(true);
  const [applicant, setApplicant] = useState<{ fullName: string; email: string; phoneNumber: string; location: string } | null>(null);
  const id = params?.id;
  const postedAt = job?.publishedAt ?? job?.createdAt ?? null;
  const postedLabel = formatPostedAgo(postedAt);
  const trackedJob = useRef<number | null>(null);
  useEffect(() => job ? applyJobPageMetadata(job) : undefined, [job]);
  useEffect(() => {
    let active = true;
    async function loadApplicant() {
      try {
        const session = await api<{ authenticated: boolean; member: { displayName: string; email: string } | null }>("/api/gm/member/session");
        if (!session.authenticated || !session.member) { if (active) setApplicant(null); return; }
        let profile = { fullName: session.member.displayName, phoneNumber: "", location: "" };
        try {
          const result = await api<{ profile: { fullName: string; phoneNumber: string; location: string } }>("/api/gm/member/profile");
          profile = { fullName: result.profile.fullName || session.member.displayName, phoneNumber: result.profile.phoneNumber || "", location: result.profile.location || "" };
        } catch { /* Account email and display name remain available if the optional profile is incomplete. */ }
        if (active) setApplicant({ ...profile, email: session.member.email });
      } catch { if (active) setApplicant(null); }
      finally { if (active) setMemberLoading(false); }
    }
    void loadApplicant();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!job || navigator.doNotTrack === "1" || trackedJob.current === job.id) return;
    trackedJob.current = job.id;
    void recordJobView(job.id).catch(() => undefined);
  }, [job]);

  async function load() {
    if (!id) return;
    setLoading(true); setError("");
    try { const data = await api<{ job: Job }>(`/api/gm/jobs/${encodeURIComponent(id)}`); setJob(data.job); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This opportunity could not be found."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id]);

  function getApplicationEmail(value: string | null | undefined) {
    if (!value) return null;
    const raw = value.trim();
    if (/^mailto:/i.test(raw)) {
      try { return new URL(raw).pathname.replace(/^\/+/, ""); } catch { return raw.replace(/^mailto:/i, "").split(/[?;]/, 1)[0]; }
    }
    return /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)*\.[^\s@<>.]{2,}$/.test(raw) ? raw : null;
  }

  function applicationMailto(email: string) {
    if (!job) return "#";
    if (!applicant) return "/login?returnTo=" + encodeURIComponent("/jobs/" + job.id);
    const subject = "Application for " + job.title + (job.companyName ? " - " + job.companyName : "");
    const role = (job.title + " " + (job.category || "")).toLowerCase();
    const skillGroups: [RegExp, string[]][] = [
      [/account|finance|audit|cashier|bookkeep|payroll/, ["Numerical accuracy and attention to detail", "Record keeping and data entry", "Confidentiality and integrity", "Problem-solving"]],
      [/sales|marketing|business development|retail/, ["Customer service and relationship building", "Communication and persuasion", "Product knowledge and sales support", "Target awareness and teamwork"]],
      [/customer|client|front desk|reception|call cent|hospitality|waiter|hotel/, ["Customer care and active listening", "Clear verbal communication", "Complaint handling and problem-solving", "Patience and teamwork"]],
      [/driver|transport|logistic|warehouse|storekeeper|supply chain/, ["Time management and reliability", "Route, stock or delivery coordination", "Safety awareness and responsibility", "Accurate record keeping"]],
      [/teach|teacher|education|trainer|tutor/, ["Communication and presentation", "Planning and organisation", "Learner support and patience", "Assessment and record keeping"]],
      [/engineer|technician|maintenance|electric|mechanic|ict|it support|software|developer/, ["Technical troubleshooting and problem-solving", "Attention to detail", "Safe and systematic work practices", "Team collaboration"]],
      [/human resource|hr officer|recruit|administrat|office assistant|secretar/, ["Organisation and time management", "Professional communication", "Documentation and record keeping", "Confidentiality and teamwork"]],
      [/nurse|clinical|medical|health|laboratory|pharmacy/, ["Careful and accurate work", "Communication and teamwork", "Following procedures and safety standards", "Confidentiality and attention to detail"]],
      [/security|guard|safety|hse/, ["Observation and situational awareness", "Following procedures", "Clear reporting and communication", "Responsibility and calm decision-making"]],
      [/clean|housekeep|production|quality control|manufactur/, ["Attention to detail and quality standards", "Following procedures consistently", "Time management and reliability", "Safety awareness and teamwork"]],
    ];
    const relevantSkills = skillGroups.find(([pattern]) => pattern.test(role))?.[1] || [
      "Professional communication and teamwork",
      "Time management and organisation",
      "Attention to detail and problem-solving",
      "Adaptability and willingness to learn",
    ];
    const body = [
      "Dear Hiring Team,", "",
      "I am writing to apply for the " + job.title + " position" + (job.companyName ? " at " + job.companyName : "") + ". Please find my CV attached for your consideration.", "",
      "Full name: " + applicant.fullName,
      "Email: " + applicant.email,
      "Phone: " + (applicant.phoneNumber || "Not provided in my profile"),
      "Location: " + (applicant.location || "Not provided in my profile"), "",
      "Relevant skills:",
      ...relevantSkills.map(skill => "- " + skill), "",
      "Kind regards,", applicant.fullName,
    ].join("\n");
    return "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  async function toggle(kind: "like" | "save") {
    if (!job || busy) return;
    setBusy(true); setNotice("");
    try { await api(`/api/gm/jobs/${job.id}/react/${kind}`, { method: "POST", body: "{}" }); await load(); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not save your reaction."); }
    finally { setBusy(false); }
  }

  return <div className="site-shell"><header className="site-header"><div className="header-inner"><Brand /><a className="header-admin-link" href="/admin/login">Admin <ArrowUpRight size={14} /></a></div></header>
    <main className="detail-page">
      <Link href="/" className="back-link"><ArrowLeft size={15} /> All opportunities</Link>
      {loading ? <div className="loading-state"><span className="loading-dot" />Loading opportunity…</div> : null}
      {!loading && error ? <div className="empty-opportunities detail-empty"><span className="eyebrow muted-eyebrow">NOT AVAILABLE</span><h2>This opportunity isn't here.</h2><p>{error}</p><Link href="/" className="text-link">Back to the opportunities board <ArrowLeft size={15} /></Link></div> : null}
      {!loading && job ? <>
        <section className="detail-heading">
          <div className="detail-company-line"><CompanyLogo size="large" name={job.isSocialPost ? "Social advert" : job.companyName} imageUrl={job.isSocialPost ? job.companyLogoUrl : job.companyLogoUrl || job.imageUrl} imageAlt={job.isSocialPost ? "Company profile photo" : undefined} /><div>{job.companyName && (job.companyHref ? <Link href={job.companyHref} className="detail-company-link">{job.companyName} <ArrowUpRight size={13} /></Link> : <span className="detail-company-name">{job.companyName}</span>)}{job.isSocialPost && <span className="social-post-badge">Social media advert</span>}{job.category && <span className="job-category">{job.category}</span>}{job.isRemote && <span className="remote-job-badge"><Wifi size={12} />Remote</span>}</div></div>
          <h1>{job.title}</h1>
          <div className="detail-meta">{postedAt && postedLabel && <span className="posted-time"><Clock3 size={15} />{postedLabel}</span>}{job.location && <span><MapPin size={16} />{job.location}</span>}{job.deadline && <span><CalendarDays size={15} />{jobDeadlineLabel(job.deadline)}</span>}</div>
          <div className="detail-heading-actions"><button type="button" className={`secondary-button ${job.liked ? "is-liked" : ""}`} aria-label={`${job.liked ? "Unlike" : "Like"} this opportunity; ${job.likeCount} likes`} onClick={() => void toggle("like")} disabled={busy}><Heart size={16} fill={job.liked ? "currentColor" : "none"} /> {job.liked ? "Liked" : "Like"} <span>{job.likeCount}</span></button><button type="button" className={`secondary-button ${job.saved ? "is-saved" : ""}`} aria-label={`${job.saved ? "Remove saved" : "Save"} opportunity; ${job.saveCount} saves`} onClick={() => void toggle("save")} disabled={busy}><Bookmark size={15} fill={job.saved ? "currentColor" : "none"} /> {job.saved ? "Saved" : "Save"} <span>{job.saveCount}</span></button><JobShareMenu job={job} variant="button" onStatus={setNotice} /><JobQuickShareButtons job={job} variant="button" /></div>
        </section>
        <p className="job-view-privacy-note">Listing counts use a random browser ID per job. For aggregate country/region statistics, this site sends the visitor IP to <a href="https://ipwhois.io/terms" target="_blank" rel="noopener noreferrer">IPWhois</a> for an approximate lookup; this site stores only aggregate location totals, not IP addresses or location-linked visitor profiles.</p>
        <div className="detail-layout">
          <div className="detail-content">
            {(job.companyDescription || job.companyWebsiteUrl || job.companyHref) && <section className="detail-section"><span className="eyebrow muted-eyebrow">ABOUT THE ORGANISATION</span><h2>{job.companyName || "Company profile"}</h2>{job.companyDescription && <RichJobText text={job.companyDescription} />}{job.companyWebsiteUrl && <a href={job.companyWebsiteUrl} target="_blank" rel="noreferrer" className="text-link"><Globe2 size={14} />Official company website <ArrowUpRight size={14} /></a>}{job.companyHref && <Link href={job.companyHref} className="text-link">View company profile <ArrowUpRight size={14} /></Link>}</section>}
            {job.isSocialPost ? job.description && <section className="social-post-detail"><div className="social-post-kicker"><span>ORIGINAL SOCIAL ADVERT</span><i>Shared as provided</i></div>{job.imageUrl && <HideBrokenImage className="social-post-detail-image" src={job.imageUrl} alt="Image attached to this social media advert" loading="lazy" />}<RawSocialPostText text={job.description} headline={job.title} organized={job.isRemote} emailHref={applicationMailto} /></section> : <>
              {job.description && <section className="detail-section"><span className="eyebrow muted-eyebrow">THE OPPORTUNITY</span><h2>About the role</h2>{job.isRemote ? <RawSocialPostText text={job.description} headline={job.title} organized emailHref={applicationMailto} /> : <RichJobText text={job.description} emailHref={applicationMailto} />}</section>}
              {job.responsibilities && <section className="detail-section"><span className="eyebrow muted-eyebrow">THE WORK</span><h2>Responsibilities</h2><RichJobText text={job.responsibilities} forceList="ordered" emailHref={applicationMailto} /></section>}
              {job.qualifications && <section className="detail-section"><span className="eyebrow muted-eyebrow">WHAT YOU'LL NEED</span><h2>Qualifications & requirements</h2><RichJobText text={job.qualifications} forceList="ordered" emailHref={applicationMailto} /></section>}
            </>}
            {job.howToApply && <section className="detail-section"><span className="eyebrow muted-eyebrow">NEXT STEP</span><h2>How to apply</h2><RichJobText text={job.howToApply} forceList={hasMultipleApplicationSteps(job.howToApply) ? "ordered" : false} emailHref={applicationMailto} /></section>}
            {job.applicationUrl && <aside className="apply-card detail-apply-card">
              <span className="eyebrow muted-eyebrow">CLICK TO APPLY</span>
              {getApplicationEmail(job.applicationUrl) ? memberLoading
                ? <span className="secondary-button" aria-live="polite">Checking your account…</span>
                : applicant
                  ? <a className="primary-button apply-button" href={applicationMailto(getApplicationEmail(job.applicationUrl)!)}>EMAIL YOUR APPLICATION <ExternalLink size={16} /></a>
                  : <Link className="primary-button apply-button" href={"/login?returnTo=" + encodeURIComponent("/jobs/" + job.id)}>SIGN IN TO APPLY BY EMAIL <ArrowUpRight size={16} /></Link>
                : <a className="primary-button apply-button" href={job.applicationUrl} target="_blank" rel="noopener noreferrer">APPLY <ExternalLink size={16} /></a>}
              {getApplicationEmail(job.applicationUrl) && applicant && <p className="apply-email-hint">Your account name, email and profile phone number will be added to the email. Attach your CV before sending.</p>}
              <span className="sr-only" aria-live="polite">{notice}</span>
            </aside>}
            {job.sourceUrl && job.sourceUrl !== job.applicationUrl && <a className="source-link" href={job.sourceUrl} target="_blank" rel="noreferrer">View original source page <ExternalLink size={14} /></a>}
          </div>
        </div>
      </> : null}
    </main>
    <SiteFooter />
  </div>;
}
