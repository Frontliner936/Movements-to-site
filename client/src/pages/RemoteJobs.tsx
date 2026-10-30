import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Wifi, LogOut } from "lucide-react";
import { Brand } from "@/components/Brand";
import { JobCard } from "@/components/JobCard";
import { SiteFooter } from "@/components/SiteFooter";
import { api, type Job } from "@/lib/api";

type JobsResponse = { jobs: Job[] };

export default function RemoteJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberSignedIn, setMemberSignedIn] = useState(false);
  const socialRemoteJobs = jobs.filter(job => job.isSocialPost);
  const regularRemoteJobs = jobs.filter(job => !job.isSocialPost);
  const totalRemoteJobs = jobs.length;

  useEffect(() => {
    let active = true;
    api<{ authenticated: boolean }>("/api/gm/member/session").then(result => { if (active) setMemberSignedIn(result.authenticated); }).catch(() => { if (active) setMemberSignedIn(false); });
    return () => { active = false; };
  }, []);

  async function signOutMember() {
    try {
      const result = await api<{ authenticated: boolean }>("/api/gm/member/logout", { method: "POST", body: "{}" });
      if (result.authenticated === false) {
        setMemberSignedIn(false);
        window.location.assign("/");
        return;
      }
      throw new Error("The sign-out request did not confirm that your session ended.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  }

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
      <div className="header-inner"><Brand /><div className="header-actions"><a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a>{memberSignedIn && <button className="member-nav-login" type="button" onClick={() => void signOutMember()}><LogOut size={14} /> Sign out</button>}<a className="remote-jobs-home-link" href="/"><ArrowLeft size={14} />Home</a></div></div>
    </header>
    <main className="opportunities-section remote-jobs-page" aria-labelledby="remote-jobs-title">
      <div className="remote-jobs-hero"><span className="remote-jobs-hero-icon"><Wifi size={23} /></span><span className="eyebrow muted-eyebrow">WORK FROM ANYWHERE</span><h1 id="remote-jobs-title">Remote jobs<span className="heading-period">.</span></h1><p>Find flexible opportunities you can explore from anywhere. Browse clear job listings or social media adverts, then open any opportunity for full details.</p></div>
      {!loading && !error && totalRemoteJobs > 0 && <div className="remote-jobs-overview" aria-label="Remote opportunities summary">
        <div className="remote-overview-stat"><strong>{totalRemoteJobs}</strong><span>Total remote opportunities</span></div>
        <div className="remote-overview-stat"><strong>{regularRemoteJobs.length}</strong><span>Job listings</span></div>
        <div className="remote-overview-stat"><strong>{socialRemoteJobs.length}</strong><span>Social media adverts</span></div>
      </div>}
      {loading && <div className="loading-state"><span className="loading-dot" />Finding remote opportunities…</div>}
      {error && <div className="notice-card error-card"><strong>Remote jobs could not be loaded.</strong><p>{error}</p></div>}
      {!loading && !error && jobs.length > 0 && <div className="remote-job-groups">
        {regularRemoteJobs.length > 0 && <section className="remote-job-group" aria-labelledby="standard-remote-jobs-title"><div className="remote-group-heading"><div><span className="eyebrow muted-eyebrow">EXPLORE OPEN ROLES</span><h2 id="standard-remote-jobs-title">Remote job listings</h2><p>Structured opportunities with details to help you decide whether to apply.</p></div><span className="remote-group-count">{regularRemoteJobs.length} {regularRemoteJobs.length === 1 ? "listing" : "listings"}</span></div><div className="jobs-feed">{regularRemoteJobs.map(job => <JobCard key={job.id} job={job} onChanged={() => { void loadJobs().catch(() => undefined); }} />)}</div></section>}
        {socialRemoteJobs.length > 0 && <section className="remote-job-group" aria-labelledby="social-remote-jobs-title"><div className="remote-group-heading"><div><span className="eyebrow muted-eyebrow">SHARED BY SOURCES</span><h2 id="social-remote-jobs-title">Remote social media adverts</h2><p>Original adverts shared from social platforms. Open one to read the complete message and source details.</p></div><span className="remote-group-count">{socialRemoteJobs.length} {socialRemoteJobs.length === 1 ? "advert" : "adverts"}</span></div><div className="jobs-feed">{socialRemoteJobs.map(job => <JobCard key={job.id} job={job} onChanged={() => { void loadJobs().catch(() => undefined); }} />)}</div></section>}
      </div>}
      {!loading && !error && jobs.length === 0 && <div className="more-jobs-empty"><span className="eyebrow muted-eyebrow">NEW POSSIBILITIES</span><h2>No remote listings just yet.</h2><p>Remote opportunities will appear here when the team publishes them. Check back soon.</p><a className="secondary-button" href="/"><ArrowLeft size={15} />Back to opportunities</a></div>}
    </main>
    <SiteFooter />
  </div>;
}
