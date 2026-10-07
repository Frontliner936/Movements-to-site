import { useEffect, useState } from "react";
import { ArrowUpRight, BarChart3, Eye, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/api";

type JobAnalytics = {
  id: number;
  title: string;
  companyName: string | null;
  location: string | null;
  publishedAt: string | null;
  uniqueVisitors: number;
  lastViewedAt: string | null;
};

const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function AdminAnalytics() {
  const [jobs, setJobs] = useState<JobAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setRefreshing(true);
    setError("");
    try {
      const result = await api<{ jobs: JobAnalytics[] }>("/api/gm/admin/analytics/jobs");
      setJobs(result.jobs);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load visitor analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visitorsAcrossListings = jobs.reduce((total, job) => total + job.uniqueVisitors, 0);
  const ranked = [...jobs].sort((a, b) => b.uniqueVisitors - a.uniqueVisitors || a.title.localeCompare(b.title));

  return <section className="admin-section analytics-section">
    <div className="admin-page-title">
      <div><span className="eyebrow muted-eyebrow">JOB AUDIENCE</span><h1>Visitor analytics.</h1><p>See how many anonymous browsers have opened each published opportunity.</p></div>
      <button type="button" className="secondary-button" onClick={() => void load()} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "spin" : ""} />Refresh</button>
    </div>
    {error && <p className="admin-alert error-alert">{error}</p>}
    <div className="overview-stats analytics-summary">
      <div className="overview-stat"><span className="stat-icon"><BarChart3 size={18} /></span><span className="stat-label">Published listings</span><strong>{numberFormat.format(jobs.length)}</strong><small>Jobs currently shown in this report</small></div>
      <div className="overview-stat"><span className="stat-icon"><Eye size={18} /></span><span className="stat-label">Visitor entries across listings</span><strong>{numberFormat.format(visitorsAcrossListings)}</strong><small>A browser can appear once in more than one job row</small></div>
    </div>
    <section className="admin-panel analytics-panel">
      <div className="panel-heading"><div><span className="eyebrow muted-eyebrow">PUBLISHED JOBS</span><h2>Visitors by opportunity</h2></div><span className="analytics-definition">Unique browsers, counted once per job</span></div>
      {loading ? <div className="admin-loading-inline">Loading visitor analytics…</div> : !ranked.length ? <div className="admin-empty"><span className="admin-empty-symbol"><BarChart3 size={18} /></span><h2>No published jobs to report yet</h2><p>Analytics rows appear after a job is published.</p></div> : <div className="analytics-table-scroll"><table className="analytics-table">
        <thead><tr><th>Opportunity</th><th>Company</th><th>Location</th><th className="analytics-number">Visitors</th><th>Last seen</th><th aria-label="Open job" /></tr></thead>
        <tbody>{ranked.map(job => <tr key={job.id}>
          <td><strong>{job.title}</strong></td>
          <td>{job.companyName || "Not listed"}</td>
          <td>{job.location || "—"}</td>
          <td className="analytics-number"><span className="visitor-count">{numberFormat.format(job.uniqueVisitors)}</span></td>
          <td>{job.lastViewedAt ? dateFormat.format(new Date(job.lastViewedAt)) : "No visitors yet"}</td>
          <td><Link className="analytics-open-link" href={`/jobs/${job.id}`} aria-label={`Open ${job.title}`}><ArrowUpRight size={15} /></Link></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    <p className="analytics-privacy-note">Counts are approximate unique browsers per job—not identified people. Each listing uses a separate random browser ID, and only its one-way hash and visit timestamps are stored; no names, IP addresses or user-agent strings. Visitors who block local storage or enable Do Not Track are not counted.</p>
  </section>;
}
