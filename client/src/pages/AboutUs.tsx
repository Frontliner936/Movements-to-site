import { useEffect } from "react";
import { ArrowRight, BriefcaseBusiness, Building2, Compass, Eye, GraduationCap, HeartHandshake, Landmark, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Brand } from "@/components/Brand";
import { SiteFooter } from "@/components/SiteFooter";

const opportunityTypes = [
  { label: "Government and private-sector jobs", Icon: BriefcaseBusiness },
  { label: "NGO vacancies", Icon: HeartHandshake },
  { label: "Internships and graduate programmes", Icon: GraduationCap },
  { label: "Scholarships", Icon: Landmark },
  { label: "Training programmes", Icon: Building2 },
  { label: "Career development resources", Icon: Compass },
];

const values = [
  {
    id: "aim",
    label: "OUR AIM",
    title: "Make the next step easier to find.",
    description: "Our aim is to empower Tanzanian job seekers by providing timely access to reliable opportunity information, reducing the difficulty of searching across multiple sources, and helping individuals take meaningful steps toward their career goals.",
    Icon: Target,
  },
  {
    id: "mission",
    label: "OUR MISSION",
    title: "Access for every Tanzanian.",
    description: "To make opportunity information more accessible to every Tanzanian, regardless of their education level, professional background or location, while encouraging informed applications and continuous career development.",
    Icon: Compass,
  },
  {
    id: "vision",
    label: "OUR VISION",
    title: "A more informed, skilled workforce.",
    description: "To become a trusted platform in Tanzania for discovering employment and development opportunities, helping individuals build better futures and contributing to a more informed, skilled and empowered workforce.",
    Icon: Eye,
  },
  {
    id: "commitment",
    label: "OUR COMMITMENT",
    title: "Credibility, accessibility and transparency.",
    description: "At MichongoDaily, we value credibility, accessibility and transparency. We strive to share opportunities from official institutions, employers and other reliable sources, while encouraging applicants to verify application details through the original advertiser before applying.",
    additional: "Beyond sharing opportunities, we also aim to support job seekers through CV writing, application letter preparation and other career-related services that help them present their qualifications professionally.",
    Icon: ShieldCheck,
  },
];

export default function AboutUs() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "About Us | Get Mchongo";
    return () => { document.title = previousTitle; };
  }, []);

  return <div className="site-shell">
    <header className="site-header home-page-header">
      <div className="header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <a href="/">Opportunities</a>
          <a href="/announcements">Announcements</a>
          <a className="nav-current" aria-current="page" href="/about-us">About us</a>
        </nav>
        <div className="header-actions">
          <a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a>
          <a className="header-contact-link" href="/contact">Contact us</a>
        </div>
      </div>
    </header>

    <main className="about-page">
      <div className="about-container">
        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" />ABOUT MICHONGODAILY</span>
            <h1 id="about-title">Connecting Tanzanians with <em>opportunities.</em></h1>
            <p className="about-hero-tagline">Empowering Careers. Inspiring Growth.</p>
            <p className="about-intro">MichongoDaily is an opportunity-sharing platform dedicated to helping Tanzanians discover employment opportunities and career development resources from trusted and credible sources. We aim to bridge the gap between job seekers and opportunities by making relevant information more accessible, organized and easier to find.</p>
            <div className="about-hero-actions">
              <a className="primary-button" href="/#opportunities">Explore opportunities <ArrowRight size={15} /></a>
              <a className="about-secondary-link" href="/cv-services">Explore CV services <ArrowRight size={14} /></a>
            </div>
          </div>
          <aside className="about-hero-card" aria-label="Our purpose">
            <span className="about-hero-card-icon"><Sparkles size={20} /></span>
            <span className="about-card-eyebrow">OUR PURPOSE</span>
            <h2>Clear information.<br /><em>Meaningful next steps.</em></h2>
            <p>MichongoDaily — Your Daily Gateway to Opportunities.</p>
            <span className="about-card-route" aria-hidden="true" />
          </aside>
        </section>

        <section className="about-opportunities" aria-labelledby="about-opportunities-title">
          <div className="about-section-heading">
            <span className="eyebrow muted-eyebrow">WHAT YOU CAN FIND</span>
            <h2 id="about-opportunities-title">Opportunities for every stage.</h2>
            <p>Our platform shares a wide range of opportunities, including government and private-sector jobs, NGO vacancies, internships, graduate programmes, scholarships, training programmes and other opportunities that support personal and professional growth.</p>
          </div>
          <div className="about-opportunity-types">
            {opportunityTypes.map(({ label, Icon }) => <div className="about-opportunity-type" key={label}><span><Icon size={18} aria-hidden="true" /></span><strong>{label}</strong></div>)}
          </div>
        </section>

        <section className="about-values" aria-label="Our aim, mission, vision and commitment">
          {values.map(({ id, label, title, description, additional, Icon }, index) => <article className={`about-value-card about-value-${id}`} key={id}>
            <div className="about-value-topline"><span className="about-value-icon"><Icon size={19} aria-hidden="true" /></span><span>{String(index + 1).padStart(2, "0")} / {label}</span></div>
            <h2>{title}</h2>
            <p>{description}</p>
            {additional && <p>{additional}</p>}
          </article>)}
        </section>

        <section className="about-cta" aria-labelledby="about-cta-title">
          <div>
            <span className="eyebrow">CAREER DEVELOPMENT</span>
            <h2 id="about-cta-title">Your next move can start today.</h2>
            <p>Discover opportunities or get support presenting your real experience with confidence.</p>
            <strong>MichongoDaily — Your Daily Gateway to Opportunities.</strong>
          </div>
          <div className="about-cta-actions">
            <a className="about-cta-primary" href="/cv-services">Explore CV services <ArrowRight size={15} /></a>
            <a className="about-cta-secondary" href="/#opportunities">Browse opportunities</a>
          </div>
        </section>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
