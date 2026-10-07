import { useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Bookmark, Heart, MapPin, Share2 } from "lucide-react";
import { api, type Job } from "@/lib/api";

export function CompanyLogo({ name, imageUrl, size = "normal" }: { name?: string | null; imageUrl?: string | null; size?: "normal" | "large" }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`company-logo ${size === "large" ? "company-logo-large" : ""}`}>
      {imageUrl && !failed ? <img src={imageUrl} alt={name ? `${name} logo` : "Company logo"} onError={() => setFailed(true)} /> : <span aria-hidden="true">{(name || "?").trim().slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

export async function shareJob(job: Job) {
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  let origin = window.location.origin;
  try { if (canonical) origin = new URL(canonical).origin; } catch { /* Use the active browser origin. */ }
  const url = new URL(`/jobs/${job.id}`, origin).href;
  const title = `${job.title}${job.companyName ? ` — ${job.companyName}` : ""} | Get Mchongo`;
  const text = `${job.title}${job.companyName ? ` — ${job.companyName}` : ""}`;
  if (navigator.share) return navigator.share({ title, text, url });
  await navigator.clipboard.writeText(url);
  return "copied";
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
  async function share() {
    try { const result = await shareJob(job); setNotice(result === "copied" ? "Link copied" : ""); }
    catch { setNotice("Could not share this listing."); }
  }
  return (
    <article className="job-card">
      <div className="job-card-topline">
        <CompanyLogo name={job.companyName} imageUrl={job.companyLogoUrl || job.imageUrl} />
        <span className="job-category">{job.category || "Opportunity"}</span>
        <div className="job-card-actions">
          <button className={`icon-button ${job.liked ? "is-liked" : ""}`} type="button" aria-label={job.liked ? "Unlike job" : "Like job"} aria-pressed={job.liked} disabled={!!busy} onClick={() => void toggle("like")}><Heart size={17} fill={job.liked ? "currentColor" : "none"} /></button>
          <button className={`icon-button ${job.saved ? "is-saved" : ""}`} type="button" aria-label={job.saved ? "Remove saved job" : "Save job"} aria-pressed={job.saved} disabled={!!busy} onClick={() => void toggle("save")}><Bookmark size={17} fill={job.saved ? "currentColor" : "none"} /></button>
          <button className="icon-button" type="button" aria-label="Share job" onClick={() => void share()}><Share2 size={16} /></button>
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
