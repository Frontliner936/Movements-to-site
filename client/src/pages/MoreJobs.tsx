import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness } from "lucide-react";
import { Brand } from "@/components/Brand";
import { JobCard } from "@/components/JobCard";
import { SiteFooter } from "@/components/SiteFooter";
import { api, type Job } from "@/lib/api";

const INITIAL_JOB_COUNT = 9;

type JobsResponse = { jobs: Job[] };

export default function MoreJobs() {
  const routeParams = new URLSearchParams(window.location.search);
  const query = routeParams.get("q")?.trim() ?? "";
  const category = routeParams.get("category") ?? "";
  const location = routeParams.get("location") ?? "";
  const savedOnly = routeParams.get("view") === "saved";
  const apiParams = new URLSearchParams();
  if (query) apiParams.set("q", query);
  if (category) apiParams.set("category", category);
  if (location) apiParams.set("location", location);
  const apiSearch = apiParams.toString();
  const apiUrl = `/api/gm/jobs${apiSearch ? `?${apiSearch}` : ""}`;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<JobsResponse>(apiUrl)
      .then(data => { if (active) setJobs(data.jobs); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "More opportunities could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl]);

  const matchingJobs = useMemo(() => savedOnly ? jobs.filter(job => job.saved) : jobs, [jobs, savedOnly]);
  const proceedingJobs = matchingJobs.slice(INITIAL_JOB_COUNT);

  function goBackToPreviousPage() {
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer?.origin === window.location.origin && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch {
      // Fall back to the opportunities page if the previous URL is unavailable.
    }
    window.location.assign("/");
  }

  function refreshJobs() {
    void api<JobsResponse>(apiUrl).then(data => setJobs(data.jobs)).catch(() => undefined);
  }

  const filterLabels = [query && `Search: ${query}`, category && `Category: ${category}`, location && `Location: ${location}`].filter(Boolean);

  return <div className="site-shell">
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <div className="header-actions"><a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a></div>
      </div>
    </header>
    <main className="opportunities-section more-jobs-page" aria-labelledby="more-jobs-title">
      <button className="more-jobs-back" type="button" onClick={goBackToPreviousPage}><ArrowLeft size={16} />Back to previous page</button>
      <div className="more-jobs-page-heading">
        <span className="eyebrow muted-eyebrow">THE NEXT OPENINGS</span>
        <h1 id="more-jobs-title">More opportunities<span className="heading-period">.</span></h1>
        <p>{filterLabels.length ? `Showing further opportunities for ${filterLabels.join(" · ")}.` : "Explore the opportunities listed after the first nine on the main board."}</p>
      </div>

      {loading ? <div className="loading-state"><span className="loading-dot" />Loading more opportunities…</div> : null}
      {!loading && error ? <div className="notice-card error-card"><strong>Could not load more jobs.</strong><p>{error}</p><button className="more-jobs-back" type="button" onClick={goBackToPreviousPage}><ArrowLeft size={15} />Back to previous page</button></div> : null}
      {!loading && !error && proceedingJobs.length > 0 ? <>
        <div className="more-jobs-count"><BriefcaseBusiness size={16} /><span>{proceedingJobs.length} additional {proceedingJobs.length === 1 ? "opportunity" : "opportunities"}</span></div>
        <div className="jobs-feed">
          {proceedingJobs.map(job => <JobCard key={job.id} job={job} onChanged={refreshJobs} />)}
        </div>
      </> : null}
      {!loading && !error && proceedingJobs.length === 0 ? <div className="more-jobs-empty">
        <span className="eyebrow muted-eyebrow">YOU’RE ALL CAUGHT UP</span>
        <h2>No further opportunities yet.</h2>
        <p>There are no additional matching jobs after the first nine. Return to the previous page to change your search or filters.</p>
        <button className="secondary-button" type="button" onClick={goBackToPreviousPage}><ArrowLeft size={15} />Back to previous page</button>
      </div> : null}
    </main>
    <SiteFooter />
  </div>;
}
