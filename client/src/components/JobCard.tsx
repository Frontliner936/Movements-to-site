import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Bookmark, Heart, MapPin } from "lucide-react";
import { api, type Job } from "@/lib/api";
import { JobQuickShareButtons, JobShareMenu } from "@/components/JobShareMenu";

export function CompanyLogo({ name, imageUrl, size = "normal" }: { name?: string | null; imageUrl?: string | null; size?: "normal" | "large" }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`company-logo ${size === "large" ? "company-logo-large" : ""}`}>
      {imageUrl && !failed ? <img src={imageUrl} alt={name ? `${name} logo` : "Company logo"} onError={() => setFailed(true)} /> : <span aria-hidden="true">{(name || "?").trim().slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

export function JobCard({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const [busy, setBusy] = useState<"like" | "save" | null>(null);
  const [notice, setNotice] = useState("");
  async function toggle(kind: "like" | "save") {
    if (busy) return;
    setBusy(kind); setNotice("");
    try { await api(`/api/gm/jobs/${job.id}/react/${kind}`, { method: "POST", body: "{}" }); onChanged(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not save your reaction."); }
    finally { setBusy(null); }
  }
  return (
    <article className="job-card">
      <div className="job-card-topline">
        <CompanyLogo name={job.companyName} imageUrl={job.companyLogoUrl || job.imageUrl} />
        <span className="job-category">{job.category || "Opportunity"}</span>
        <div className="job-card-actions">
          <button className={`icon-button ${job.liked ? "is-liked" : ""}`} type="button" aria-label={job.liked ? "Unlike job" : "Like job"} aria-pressed={job.liked} disabled={!!busy} onClick={() => void toggle("like")}><Heart size={17} fill={job.liked ? "currentColor" : "none"} /></button>
          <button className={`icon-button ${job.saved ? "is-saved" : ""}`} type="button" aria-label={job.saved ? "Remove saved job" : "Save job"} aria-pressed={job.saved} disabled={!!busy} onClick={() => void toggle("save")}><Bookmark size={17} fill={job.saved ? "currentColor" : "none"} /></button>
          <JobShareMenu job={job} variant="icon" onStatus={setNotice} />
          <JobQuickShareButtons job={job} variant="icon" />
        </div>
      </div>
      <Link href={`/jobs/${job.id}`} className="job-card-title">{job.title}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      {job.companyName && (job.companyHref ? <Link className="job-company-link" href={job.companyHref}>{job.companyName}</Link> : <p className="job-company-name">{job.companyName}</p>)}
      <p className="job-description-preview">{job.description || "Open the listing to view the information shared by the source."}</p>
      <div className="job-card-footer">
        <span>{job.location && <><MapPin size={14} />{job.location}</>}</span>
        {job.deadline && <span className="deadline-chip">Closes {job.deadline}</span>}
        <Link href={`/jobs/${job.id}`} className="text-link">View details <ArrowUpRight size={14} /></Link>
      </div>
      <span className="sr-only" aria-live="polite">{notice}</span>
      <span className="reaction-counts" aria-label={`${job.likeCount} likes and ${job.saveCount} saves`}>{job.likeCount} liked · {job.saveCount} saved</span>
    </article>
  );
}
