import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, BriefcaseBusiness, ChevronDown, Search, Sparkles } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { Brand } from "@/components/Brand";
import { EmptyBoardIllustration } from "@/components/EditorialVisuals";
import { HideBrokenImage } from "@/components/HideBrokenImage";
import { JobCard } from "@/components/JobCard";
import { SiteFooter } from "@/components/SiteFooter";
import { announcementKinds, api, type Announcement, type Job } from "@/lib/api";

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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
    api<{ announcements: Announcement[] }>("/api/gm/announcements")
      .then(data => { if (alive) setAnnouncements(data.announcements.filter(item => item.status === "published").slice(0, 3)); })
      .catch(() => { if (alive) setAnnouncements([]); });
    return () => { alive = false; };
  }, []);

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
      <header className="site-header home-page-header">
        <div className="header-inner"><Brand /><nav className="main-nav" aria-label="Main navigation"><a className="nav-current" href="#opportunities">Opportunities</a><a href="#how-it-works">How it works</a><a href="/announcements">Announcements</a></nav><div className="header-actions"><a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a><a className="header-contact-link" href="/contact">Contact us</a><a className="header-admin-link" href="/admin/login">Admin <ArrowRight size={14} /></a></div></div>
      </header>

      <main>
        <div className="home-top-band">
        <section className="hero-wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" />TANZANIA'S OPPORTUNITY BOARD</span>
            <a className="whatsapp-channel-link" href="https://whatsapp.com/channel/0029Vb6lza03wtb62igZVt0V" target="_blank" rel="noopener noreferrer" aria-label="Join our WhatsApp channel">
              <FaWhatsapp size={16} aria-hidden="true" />
              <span>Our channel</span>
            </a>
            <h1 id="hero-title"><span className="hero-highlight">Your next move</span><br /><em>starts here.</em></h1>
            <p className="hero-description">Good work opens doors. Find jobs and opportunities worth your next step — with the original application link, always.</p>
            <a href="#opportunities" className="hero-cta">Explore opportunities <ArrowDownRight size={17} /></a>
            <p className="hero-footnote"><span className="small-sun">✳</span> Clear opportunities. No noise.</p>
          </div>
          <figure className="hero-art hero-photo-card">
            <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=85" alt="Young professionals sharing ideas around a laptop in a bright contemporary workspace." />
            <div className="hero-photo-shade" aria-hidden="true" />
            <div className="hero-photo-secondary">
              <img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=700&q=85" alt="Colleagues collaborating at a bright workplace." loading="eager" />
              <span>MOVE WITH PURPOSE</span>
            </div>
            <div className="hero-photo-orbit" aria-hidden="true" />
            <div className="hero-photo-sun" aria-hidden="true" />
            <div className="hero-photo-topline"><span className="hero-photo-live" /> MADE FOR TANZANIA</div>
            <div className="hero-photo-route" aria-hidden="true"><svg viewBox="0 0 220 120"><path d="M4 106c48 0 67-51 113-54 36-3 45 20 82-36" /></svg></div>
            <div className="hero-photo-note"><span className="hero-note-star"><Sparkles size={16} /></span><span><strong>Make your next move.</strong><small>Find. Save. Apply.</small></span></div>
            <figcaption className="hero-photo-caption">YOUR NEXT CHAPTER <ArrowRight size={13} /></figcaption>
          </figure>
        </section>

        {announcements.length > 0 && (
          <section className="home-announcements" aria-labelledby="home-announcements-title">
            <div className="home-announcements-heading">
              <div>
                <span className="eyebrow muted-eyebrow">STAY IN THE KNOW</span>
                <h2 id="home-announcements-title">Latest <em>announcements.</em></h2>
              </div>
              <a className="text-link" href="/announcements">View more <ArrowRight size={15} /></a>
            </div>
            <div className="home-announcements-grid">
              {announcements.map(item => (
                <article className="home-announcement-card" key={item.id}>
                  {item.imageUrl ? <HideBrokenImage key={item.imageUrl} src={item.imageUrl} alt={item.imageCaption || item.title} loading="lazy" /> : <div className="home-announcement-icon"><Sparkles size={20} /></div>}
                  <div className="home-announcement-content">
                    <div className="announcement-meta"><span className="announcement-kind">{announcementKinds.find(kind => kind.value === item.kind)?.label ?? "News"}</span><time dateTime={item.publishedAt ?? item.createdAt}>{new Date(item.publishedAt ?? item.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</time></div>
                    <h3>{item.title}</h3>
                    {item.body && <p>{item.body}</p>}\n                    <a className="text-link home-announcement-view" href="/announcements">View full advert <ArrowRight size={14} /></a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        </div>

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
              <div className="empty-board-illustration" aria-hidden="true"><EmptyBoardIllustration /><span className="empty-art-orbit" /><span className="empty-art-spark">✳</span></div>
              <div className="empty-stamp"><Sparkles size={19} /></div>
              <span className="eyebrow muted-eyebrow">{view === "saved" ? "YOUR SHORTLIST" : "THE BOARD IS OPEN"}</span>
              <h3>{view === "saved" ? "Nothing saved just yet." : (query || category || location) ? "No openings match those filters." : "The next opportunity starts with a listing."}</h3>
              <p>{view === "saved" ? "Tap the bookmark on a listing to keep it here for later." : (query || category || location) ? "Try a different title, category or location — or clear your filters." : "We're ready to share verified opportunities as they come in. Check back soon, or clear your search and try another filter."}</p>
              {(query || category || location || view === "saved") && <button className="secondary-button" type="button" onClick={clearFilters}>Show all opportunities <ArrowRight size={15} /></button>}
              {!jobs.length && !query && !category && !location && view === "all" && <div className="empty-board-actions"><a className="empty-submit-link" href="/submit">Employer? Submit an opportunity <ArrowRight size={14} /></a><a className="empty-admin-link" href="/admin/login">Administrator? Add the first listing <ArrowRight size={14} /></a></div>}
            </div>
          ) : null}
        </section>

        <section className="opportunity-photo-strip" aria-label="Career and workplace photography">
          <div className="photo-strip-intro">
            <span className="eyebrow muted-eyebrow">OPPORTUNITY IN MOTION</span>
            <h2>Work worth<br /><em>moving toward.</em></h2>
            <p>From first applications to new teams, every opportunity starts with a person ready for the next step.</p>
          </div>
          <figure className="opportunity-photo opportunity-photo-tall">
            <img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=85" alt="Professionals collaborating around a table in a modern workplace." loading="lazy" />
            <figcaption>Find your people.</figcaption>
          </figure>
          <figure className="opportunity-photo opportunity-photo-wide">
            <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85" alt="Colleagues working together around a laptop in an office." loading="lazy" />
            <figcaption>Build your next chapter.</figcaption>
          </figure>
          <figure className="opportunity-photo opportunity-photo-small">
            <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=85" alt="Team members discussing ideas during a work meeting." loading="lazy" />
            <figcaption>Make the move.</figcaption>
          </figure>
        </section>

        <section className="how-section" id="how-it-works"><div className="how-number">02 / THE MCHONGO WAY</div><div className="how-copy"><h2>Real opportunities.<br /><em>Original application links.</em></h2><p>Get Mchongo brings opportunities together in one clear place. When a role catches your eye, you go straight to the original application — no extra hoops.</p><a href="#opportunities" className="text-link">Browse the board <ArrowRight size={15} /></a></div><figure className="how-photo-frame"><img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85" alt="A professional reviews her notes beside a laptop in a sunlit creative workspace." /><figcaption className="how-photo-overlay"><span>ONE CLEAR NEXT STEP</span><div className="how-photo-icons"><span><Search size={13} /></span><i /><span><span className="how-save-mark">▱</span></span><i /><span><ArrowRight size={14} /></span></div></figcaption></figure></section>
      </main>

      <SiteFooter />
    </div>
  );
}
