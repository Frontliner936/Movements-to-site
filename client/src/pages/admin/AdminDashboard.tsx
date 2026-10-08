import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, BarChart3, BriefcaseBusiness, Building2, Clock3, LogOut, Megaphone, MessageCircle, PanelTop, Rss, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/api";
import AdminJobs from "./AdminJobs";
import AdminCompanies from "./AdminCompanies";
import AdminSources from "./AdminSources";
import AdminReview from "./AdminReview";
import AdminAnalytics from "./AdminAnalytics";
import AdminMessages from "./AdminMessages";
import AdminAnnouncements from "./AdminAnnouncements";

type Tab = "overview" | "review" | "messages" | "announcements" | "jobs" | "companies" | "sources" | "analytics";
type Overview = { jobs: Record<string, number>; companies: number; sources: number; activeSources: number; pending: number; unreadMessages: number; recentRuns: Array<{ id: number; name: string; lastRunAt: string | null; lastRunError: string | null; lastRunCount: number; isActive: boolean }>; schedule: { enabled: boolean; cronExpression: string; lastRunAt: string | null } };
const tabs: Array<{ id: Tab; label: string; icon: typeof PanelTop }> = [
  { id: "overview", label: "Overview", icon: PanelTop }, { id: "review", label: "Review queue", icon: Clock3 }, { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "announcements", label: "Announcements", icon: Megaphone }, { id: "jobs", label: "Jobs", icon: BriefcaseBusiness }, { id: "companies", label: "Companies", icon: Building2 }, { id: "sources", label: "Tracked sources", icon: Rss },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const loadOverview = useCallback(async () => {
    try { setOverview((await api<{ overview?: Overview } & Overview>("/api/gm/admin/overview")) as Overview); }
    catch (error) { if (error instanceof Error && /login|required|401/i.test(error.message)) setLocation("/admin/login"); else setMessage(error instanceof Error ? error.message : "Could not refresh overview."); }
  }, [setLocation]);

  useEffect(() => {
    let alive = true;
    api<{ authenticated: boolean }>("/api/gm/admin/session").then(result => {
      if (!alive) return;
      if (!result.authenticated) setLocation("/admin/login");
      else { setReady(true); void loadOverview(); }
    }).catch(() => { if (alive) setLocation("/admin/login"); });
    return () => { alive = false; };
  }, [setLocation, loadOverview]);

  async function signOut() {
    try { await api("/api/gm/admin/logout", { method: "POST", body: "{}" }); } finally { setLocation("/admin/login"); }
  }

  const counts = overview ? [
    { label: "Published jobs", value: overview.jobs.published ?? 0, icon: BriefcaseBusiness, note: `${overview.jobs.draft ?? 0} unpublished` },
    { label: "To review", value: overview.pending, icon: Clock3, note: "Never published automatically" },
    { label: "Companies", value: overview.companies, icon: Building2, note: "Profiles and logos" },
    { label: "Active sources", value: overview.activeSources, icon: Rss, note: `${overview.sources} tracked total` },
  ] : [];

  if (!ready) return <div className="admin-loading"><Brand /><span className="loading-dot" />Checking admin access…</div>;

  return <div className="admin-shell">
    <aside className="admin-sidebar"><Brand /><div className="sidebar-label">CONTROL ROOM</div><nav className="admin-nav" aria-label="Admin sections">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? "admin-nav-active" : ""} onClick={() => { setTab(id); setMessage(""); }}><Icon size={17} />{label}{id === "review" && !!overview?.pending && <span className="nav-count">{overview.pending}</span>}{id === "messages" && !!overview?.unreadMessages && <span className="nav-count">{overview.unreadMessages}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-admin"><span className="admin-avatar">GM</span><div><strong>Administrator</strong><small>Protected access</small></div></div><button type="button" className="sidebar-logout" onClick={() => void signOut()}><LogOut size={16} />Sign out</button></div></aside>
    <div className="admin-workspace"><header className="admin-topbar"><div className="mobile-admin-brand"><Brand /></div><div className="admin-topbar-title"><span>GET MCHONGO</span><strong>{tabs.find(item => item.id === tab)?.label}</strong></div><div className="admin-topbar-links"><span className="secure-indicator"><ShieldCheck size={14} />Admin session</span><button type="button" className="messages-topbar-link" aria-pressed={tab === "messages"} onClick={() => { setTab("messages"); setMessage(""); }}><MessageCircle size={14} />Messages{!!overview?.unreadMessages && <span className="messages-topbar-badge">{overview.unreadMessages}</span>}</button><button type="button" className="analytics-topbar-link" aria-pressed={tab === "analytics"} onClick={() => { setTab("analytics"); setMessage(""); }}><BarChart3 size={14} />Analytics</button><Link href="/" className="public-site-link">Public site <ArrowUpRight size={14} /></Link></div></header>
      <main className="admin-content">
        {tab === "overview" && <><div className="admin-page-title"><div><span className="eyebrow muted-eyebrow">YOUR BOARD AT A GLANCE</span><h1>Good to see you.</h1><p>Keep the opportunities accurate, current and easy to act on.</p></div><button className="primary-button" onClick={() => setTab("jobs")}>Add a job <ArrowUpRight size={15} /></button></div>{message && <p className="admin-alert error-alert">{message}</p>}<div className="overview-stats">{counts.map(({ label, value, icon: Icon, note }) => <div className="overview-stat" key={label}><span className="stat-icon"><Icon size={18} /></span><span className="stat-label">{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div><button type="button" className="overview-analytics-shortcut" onClick={() => { setTab("analytics"); setMessage(""); }}><span className="overview-analytics-icon"><BarChart3 size={18} /></span><span className="overview-analytics-copy"><strong>Visitor analytics</strong><small>See unique browsers for each published job</small></span><span className="overview-analytics-action">Open report <ArrowUpRight size={15} /></span></button><div className="overview-lower"><section className="admin-panel recent-runs-panel"><div className="panel-heading"><div><span className="eyebrow muted-eyebrow">SOURCE ACTIVITY</span><h2>Recent runs</h2></div><button className="subtle-link" onClick={() => setTab("sources")}>Manage sources <ArrowUpRight size={14} /></button></div>{overview?.recentRuns.length ? <div className="recent-runs">{overview.recentRuns.map(run => <div className="recent-run" key={run.id}><span className={`status-dot ${run.lastRunError ? "status-dot-error" : run.isActive ? "" : "status-dot-muted"}`} /><div className="recent-run-main"><strong>{run.name}</strong><small>{run.lastRunAt ? new Date(run.lastRunAt).toLocaleString() : "Not run yet"}</small>{run.lastRunError && <em>{run.lastRunError}</em>}</div><span className="run-count">{run.lastRunCount} found</span></div>)}</div> : <div className="panel-empty"><Rss size={20} /><p>No tracked sources yet.</p><button className="text-link" onClick={() => setTab("sources")}>Add a source <ArrowUpRight size={13} /></button></div>}</section><section className="admin-panel workflow-panel"><span className="eyebrow muted-eyebrow">EDITORIAL WORKFLOW</span><h2>Nothing goes live by itself.</h2><div className="workflow-steps"><span>SOURCE</span><i>→</i><span>REVIEW</span><i>→</i><strong>YOUR APPROVAL</strong><i>→</i><span>PUBLIC</span></div><p>Collected listings wait here until you review and approve them.</p><button className="secondary-button" onClick={() => setTab("review")}>Open review queue <ArrowUpRight size={14} /></button></section></div><div className="overview-footer-note"><ShieldCheck size={15} />All admin actions are protected. Public pages show published jobs only.</div></>}
        {tab === "review" && <AdminReview onChanged={loadOverview} />}
        {tab === "announcements" && <AdminAnnouncements />}
        {tab === "jobs" && <AdminJobs onChanged={loadOverview} />}
        {tab === "companies" && <AdminCompanies />}
        {tab === "sources" && <AdminSources onChanged={loadOverview} />}
        {tab === "analytics" && <AdminAnalytics />}
        {tab === "messages" && <AdminMessages onChanged={loadOverview} />}
      </main>
    </div>
  </div>;
}
