import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, BriefcaseBusiness, ChevronDown, Search, Sparkles } from "lucide-react";
import { Brand } from "@/components/Brand";
import { JobCard } from "@/components/JobCard";
import { api, type Job } from "@/lib/api";

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [view, setView] = useState<"all" | "saved">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    api<{ jobs: Job[]; categories: string[]; locations: string[] }>(`/api/gm/jobs?${params.toString()}`)
      .then(data => { if (alive) { setJobs(data.jobs); setCategories(data.categories); setLocations(data.locations); } })
      .catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : "Job listings could not be loaded."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query, category, location]);

  const visibleJobs = useMemo(() => view === "saved" ? jobs.filter(job => job.saved) : jobs, [jobs, view]);
  const clearFilters = () => { setQuery(""); setCategory(""); setLocation(""); setView("all"); };

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner"><Brand /><nav className="main-nav" aria-label="Main navigation"><a className="nav-current" href="#opportunities">Opportunities</a><a href="#how-it-works">How it works</a></nav><a className="header-admin-link" href="/admin/login">Admin <ArrowRight size={14} /></a></div>
      </header>

      <main>
        <section className="hero-wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" />TANZANIA'S OPPORTUNITY BOARD</span>
            <h1 id="hero-title">Your next move<br /><em>starts here.</em></h1>
            <p className="hero-description">Good work opens doors. Find jobs and opportunities worth your next step — with the original application link, always.</p>
            <a href="#opportunities" className="hero-cta">Explore opportunities <ArrowDownRight size={17} /></a>
            <p className="hero-footnote"><span className="small-sun">✳</span> Clear opportunities. No noise.</p>
          </div>
          <div className="hero-art" aria-label="Get Mchongo brand illustration">
            <span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" />
            <div className="hero-art-sun" />
            <div className="hero-path"><span /><span /><span /></div>
            <div className="hero-art-note note-top"><span className="note-dot" /> REAL LISTINGS</div>
            <div className="hero-art-note note-bottom">YOUR NEXT CHAPTER <ArrowRight size={14} /></div>
            <p className="hero-art-caption">Opportunity moves<br />when you do.</p>
          </div>
        </section>

        <section className="opportunities-section" id="opportunities" aria-labelledby="opportunities-title">
          <div className="section-heading-row">
            <div><span className="eyebrow muted-eyebrow">FIND YOUR OPENING</span><h2 id="opportunities-title">Opportunities <span className="heading-period">.</span></h2></div>
            <div className="section-side-note"><span>01</span><p>Every listing links back<br />to its original application.</p></div>
          </div>
          <div className="search-panel">
            <label className="search-input-wrap"><Search size={20} /><span className="sr-only">Search by role or company</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Role, company or keyword" type="search" /></label>
            <label className="filter-select-wrap"><span className="sr-only">Filter by category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(option => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={15} /></label>
            <label className="filter-select-wrap"><span className="sr-only">Filter by location</span><select value={location} onChange={event => setLocation(event.target.value)}><option value="">All locations</option>{locations.map(option => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={15} /></label>
            <button className="search-button" type="button" onClick={() => { const el = document.querySelector<HTMLInputElement>(".search-input-wrap input"); el?.focus(); }}>Search <ArrowRight size={16} /></button>
          </div>

          <div className="listing-bar">
            <div className="listing-count"><BriefcaseBusiness size={15} /><span>{loading ? "Finding openings…" : `${jobs.length} ${jobs.length === 1 ? "opportunity" : "opportunities"}`}</span></div>
            <div className="listing-toggle" role="group" aria-label="Listings view"><button type="button" className={view === "all" ? "toggle-active" : ""} onClick={() => setView("all")}>All openings</button><button type="button" className={view === "saved" ? "toggle-active" : ""} onClick={() => setView("saved")}>Saved <span className="toggle-heart">♥</span></button></div>
          </div>

          {error ? <div className="notice-card error-card"><strong>Could not load listings.</strong><p>{error}</p><button type="button" className="text-link" onClick={() => window.location.reload()}>Try again <ArrowRight size={14} /></button></div> : null}
          {!error && loading ? <div className="loading-state"><span className="loading-dot" /><span>Looking for the right opportunity…</span></div> : null}
          {!error && !loading && visibleJobs.length > 0 ? <div className="jobs-feed">{visibleJobs.map(job => <JobCard key={job.id} job={job} onChanged={() => { void api<{ jobs: Job[] }>(`/api/gm/jobs?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(category ? { category } : {}), ...(location ? { location } : {}) })}`).then(data => setJobs(data.jobs)); }} />)}</div> : null}
          {!error && !loading && visibleJobs.length === 0 ? (
            <div className="empty-opportunities">
              <div className="empty-stamp"><Sparkles size={19} /></div>
              <span className="eyebrow muted-eyebrow">{view === "saved" ? "YOUR SHORTLIST" : "THE BOARD IS OPEN"}</span>
              <h3>{view === "saved" ? "Nothing saved just yet." : (query || category || location) ? "No openings match those filters." : "The next opportunity starts with a listing."}</h3>
              <p>{view === "saved" ? "Tap the bookmark on a listing to keep it here for later." : (query || category || location) ? "Try a different title, category or location — or clear your filters." : "We're ready to share verified opportunities as they come in. Check back soon, or clear your search and try another filter."}</p>
              {(query || category || location || view === "saved") && <button className="secondary-button" type="button" onClick={clearFilters}>Show all opportunities <ArrowRight size={15} /></button>}
              {!jobs.length && !query && !category && !location && view === "all" && <a className="empty-admin-link" href="/admin/login">Administrator? Add the first listing <ArrowRight size={14} /></a>}
            </div>
          ) : null}
        </section>

        <section className="how-section" id="how-it-works"><div className="how-number">02 / THE MCHONGO WAY</div><div className="how-copy"><h2>Real opportunities.<br /><em>Original application links.</em></h2><p>Get Mchongo brings opportunities together in one clear place. When a role catches your eye, you go straight to the original application — no extra hoops.</p><a href="#opportunities" className="text-link">Browse the board <ArrowRight size={15} /></a></div><div className="how-mark"><span>↗</span><small>YOUR NEXT<br />MOVE</small></div></section>
      </main>

      <footer className="site-footer"><Brand light /><p>Made for the next move.</p><div className="footer-links"><a href="#opportunities">Opportunities</a><a href="/admin/login">Admin access</a></div><span className="footer-year">© {new Date().getFullYear()} GET MCHONGO</span></footer>
    </div>
  );
}
