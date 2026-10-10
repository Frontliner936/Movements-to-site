import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Wifi } from "lucide-react";
import { Brand } from "@/components/Brand";
import { JobCard } from "@/components/JobCard";
import { SiteFooter } from "@/components/SiteFooter";
import { api, type Job } from "@/lib/api";

type JobsResponse = { jobs: Job[] };

export default function RemoteJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobs = () => api<JobsResponse>("/api/gm/jobs?remote=true").then(data => setJobs(data.jobs));
  useEffect(() => {
    let active = true;
    api<JobsResponse>("/api/gm/jobs?remote=true")
      .then(data => { if (active) setJobs(data.jobs); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Remote jobs could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="site-shell">
    <header className="site-header remote-jobs-header">
      <div className="header-inner"><Brand /><div className="header-actions"><a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a><a className="remote-jobs-home-link" href="/"><ArrowLeft size={14} />Home</a></div></div>
    </header>
    <main className="opportunities-section remote-jobs-page" aria-labelledby="remote-jobs-title">
      <div className="remote-jobs-hero"><span className="remote-jobs-hero-icon"><Wifi size={23} /></span><span className="eyebrow muted-eyebrow">WORK FROM ANYWHERE</span><h1 id="remote-jobs-title">Remote jobs<span className="heading-period">.</span></h1><p>Explore opportunities marked as remote. Review each listing and its original application details before applying.</p></div>
      {!loading && !error && jobs.length > 0 && <div className="more-jobs-count"><BriefcaseBusiness size={16} /><span>{jobs.length} remote {jobs.length === 1 ? "opportunity" : "opportunities"}</span></div>}
      {loading && <div className="loading-state"><span className="loading-dot" />Finding remote opportunities…</div>}
      {error && <div className="notice-card error-card"><strong>Remote jobs could not be loaded.</strong><p>{error}</p></div>}
      {!loading && !error && jobs.length > 0 && <div className="jobs-feed">{jobs.map(job => <JobCard key={job.id} job={job} onChanged={() => { void loadJobs().catch(() => undefined); }} />)}</div>}
      {!loading && !error && jobs.length === 0 && <div className="more-jobs-empty"><span className="eyebrow muted-eyebrow">NEW POSSIBILITIES</span><h2>No remote listings just yet.</h2><p>Remote opportunities will appear here when the team publishes them. Check back soon.</p><a className="secondary-button" href="/"><ArrowLeft size={15} />Back to opportunities</a></div>}
    </main>
    <SiteFooter />
  </div>;
}
