import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowUpRight, Bookmark, CalendarDays, ExternalLink, Globe2, Heart, MapPin, Share2 } from "lucide-react";
import { Brand } from "@/components/Brand";
import { CompanyLogo, shareJob } from "@/components/JobCard";
import { SiteFooter } from "@/components/SiteFooter";
import RichJobText from "@/components/RichJobText";
import { api, recordJobView, type Job } from "@/lib/api";
import { applyJobPageMetadata } from "@/lib/pageMetadata";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const id = params?.id;
  const trackedJob = useRef<number | null>(null);
  useEffect(() => job ? applyJobPageMetadata(job) : undefined, [job]);
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

  async function toggle(kind: "like" | "save") {
    if (!job || busy) return;
    setBusy(true); setNotice("");
    try { await api(`/api/gm/jobs/${job.id}/react/${kind}`, { method: "POST", body: "{}" }); await load(); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "Could not save your reaction."); }
    finally { setBusy(false); }
  }

  async function share() {
    if (!job) return;
    try { const result = await shareJob(job); setNotice(result === "copied" ? "Link copied to clipboard." : ""); }
    catch { setNotice("Could not share this listing."); }
  }

  return <div className="site-shell"><header className="site-header"><div className="header-inner"><Brand /><a className="header-admin-link" href="/admin/login">Admin <ArrowUpRight size={14} /></a></div></header>
    <main className="detail-page">
      <Link href="/" className="back-link"><ArrowLeft size={15} /> All opportunities</Link>
      {loading ? <div className="loading-state"><span className="loading-dot" />Loading opportunity…</div> : null}
      {!loading && error ? <div className="empty-opportunities detail-empty"><span className="eyebrow muted-eyebrow">NOT AVAILABLE</span><h2>This opportunity isn't here.</h2><p>{error}</p><Link href="/" className="text-link">Back to the opportunities board <ArrowLeft size={15} /></Link></div> : null}
      {!loading && job ? <>
        <section className="detail-heading">
          <div className="detail-company-line"><CompanyLogo size="large" name={job.companyName} imageUrl={job.companyLogoUrl || job.imageUrl} /><div>{job.companyName && (job.companyHref ? <Link href={job.companyHref} className="detail-company-link">{job.companyName} <ArrowUpRight size={13} /></Link> : <span className="detail-company-name">{job.companyName}</span>)}{job.category && <span className="job-category">{job.category}</span>}</div></div>
          <h1>{job.title}</h1>
          <div className="detail-meta">{job.location && <span><MapPin size={16} />{job.location}</span>}{job.deadline && <span><CalendarDays size={15} />Deadline: {job.deadline}</span>}</div>
          <div className="detail-heading-actions"><button type="button" className={`secondary-button ${job.liked ? "is-liked" : ""}`} onClick={() => void toggle("like")} disabled={busy}><Heart size={16} fill={job.liked ? "currentColor" : "none"} /> {job.liked ? "Liked" : "Like"} <span>{job.likeCount}</span></button><button type="button" className={`secondary-button ${job.saved ? "is-saved" : ""}`} onClick={() => void toggle("save")} disabled={busy}><Bookmark size={15} fill={job.saved ? "currentColor" : "none"} /> {job.saved ? "Saved" : "Save"}</button><button type="button" className="secondary-button" onClick={() => void share()}><Share2 size={15} /> Share</button></div>
        </section>
        <p className="job-view-privacy-note">Visitor counts use a random browser ID for this job only and count once per listing. No IP address or personal profile is stored; Do Not Track is respected.</p>
        <div className="detail-layout">
          <div className="detail-content">
            {(job.companyDescription || job.companyWebsiteUrl || job.companyHref) && <section className="detail-section"><span className="eyebrow muted-eyebrow">ABOUT THE ORGANISATION</span><h2>{job.companyName || "Company profile"}</h2>{job.companyDescription && <RichJobText text={job.companyDescription} />}{job.companyWebsiteUrl && <a href={job.companyWebsiteUrl} target="_blank" rel="noreferrer" className="text-link"><Globe2 size={14} />Official company website <ArrowUpRight size={14} /></a>}{job.companyHref && <Link href={job.companyHref} className="text-link">View company profile <ArrowUpRight size={14} /></Link>}</section>}
            {job.description && <section className="detail-section"><span className="eyebrow muted-eyebrow">THE OPPORTUNITY</span><h2>About the role</h2><RichJobText text={job.description} /></section>}
            {job.responsibilities && <section className="detail-section"><span className="eyebrow muted-eyebrow">THE WORK</span><h2>Responsibilities</h2><RichJobText text={job.responsibilities} forceList /></section>}
            {job.qualifications && <section className="detail-section"><span className="eyebrow muted-eyebrow">WHAT YOU'LL NEED</span><h2>Qualifications & requirements</h2><RichJobText text={job.qualifications} forceList /></section>}
            {job.howToApply && <section className="detail-section"><span className="eyebrow muted-eyebrow">NEXT STEP</span><h2>How to apply</h2><RichJobText text={job.howToApply} /></section>}
            {job.sourceUrl && job.sourceUrl !== job.applicationUrl && <a className="source-link" href={job.sourceUrl} target="_blank" rel="noreferrer">View original source page <ExternalLink size={14} /></a>}
          </div>
          <aside className="apply-card"><span className="eyebrow muted-eyebrow">READY WHEN YOU ARE</span><h2>Make your next move.</h2><p>Applications go directly to the original opportunity source.</p>{job.applicationUrl ? <a className="primary-button apply-button" href={job.applicationUrl} target="_blank" rel="noopener noreferrer">Apply on original site <ExternalLink size={16} /></a> : <p className="missing-apply">No application link was listed by the source.</p>}<span className="apply-footnote"><span className="green-dot" />Original application link</span><span className="sr-only" aria-live="polite">{notice}</span></aside>
        </div>
      </> : null}
    </main>
    <SiteFooter />
  </div>;
}
