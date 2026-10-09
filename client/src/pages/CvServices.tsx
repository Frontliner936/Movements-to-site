import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/Brand";
import { SiteFooter } from "@/components/SiteFooter";
import { cvBenefits, cvCategories, cvPackages, cvWhatsAppLink, cvWhatsAppNumber, formatTsh } from "@/lib/cvServices";

function getPackage(id: string) {
  return cvPackages.find(item => item.id === id)!;
}

export default function CvServices() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return <div className="site-shell">
    <header className="site-header"><div className="header-inner"><Brand /><div className="header-actions"><a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a><a className="header-admin-link" href="/">Opportunities</a></div></div></header>
    <main className="cv-services-page">
      <div className="cv-services-container">
        <a href="/" className="back-link"><ArrowLeft size={14} /> Back to opportunities</a>

        <section className="cv-services-hero" aria-labelledby="cv-services-title">
          <div className="cv-services-hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" />CV SUPPORT, BUILT AROUND YOU</span>
            <h1 id="cv-services-title">Tell your career story <em>with clarity.</em></h1>
            <p>Get a CV shaped around your real experience, target role, and career stage — from your first application to your next leadership move.</p>
            <div className="cv-services-hero-actions">
              <a className="primary-button" href={cvWhatsAppLink("Hello, I would like to improve my existing CV. Please tell me how to get started.")} target="_blank" rel="noopener noreferrer">Improve My Existing CV <ArrowRight size={15} /></a>
              <a className="cv-secondary-button" href={cvWhatsAppLink("Hello, I would like to ask about your CV packages.")} target="_blank" rel="noopener noreferrer">Ask About a Package <MessageCircle size={15} /></a>
            </div>
            <p className="cv-services-contact"><MessageCircle size={14} /> WhatsApp us on <a href="tel:+255743738062">{cvWhatsAppNumber}</a></p>
          </div>
          <aside className="cv-services-feature" aria-label="Recommended CV package">
            <span className="cv-feature-kicker"><Sparkles size={14} /> RECOMMENDED</span>
            <h2>Professional ATS CV</h2>
            <p>Clear structure, relevant skills, and job-specific keywords grounded in your information.</p>
            <strong className="cv-feature-price">{formatTsh(getPackage("professional-ats").priceTsh)}</strong>
            <a className="cv-feature-order" href={cvWhatsAppLink(`Hello, I would like to order the Professional ATS CV package for ${formatTsh(getPackage("professional-ats").priceTsh)}. Please tell me the next steps.`)} target="_blank" rel="noopener noreferrer">Order via WhatsApp <ArrowRight size={15} /></a>
            <small>No promise of a job, interview, or ATS selection.</small>
          </aside>
        </section>

        <section className="cv-services-section" aria-labelledby="cv-packages-title">
          <div className="cv-section-heading"><div><span className="eyebrow muted-eyebrow">CLEAR PRICES, PRACTICAL OPTIONS</span><h2 id="cv-packages-title">CV packages and prices</h2></div><p>Choose a service, then message us to discuss your goals and the information we’ll need.</p></div>
          <div className="cv-package-grid">
            {cvPackages.map((item, index) => <article className={`cv-package-card${item.recommended ? " cv-package-recommended" : ""}`} key={item.id}>
              <div className="cv-package-topline"><span>0{index + 1} / CV SERVICE</span>{item.recommended && <span className="cv-recommended-badge"><Sparkles size={12} /> RECOMMENDED</span>}</div>
              <h3>{item.name}</h3>
              <p className="cv-package-description">{item.description}</p>
              <p className="cv-package-price">{formatTsh(item.priceTsh)} <span>per service</span></p>
              <ul className="cv-inclusions">{item.inclusions.map(inclusion => <li key={inclusion}><Check size={15} aria-hidden="true" />{inclusion}</li>)}</ul>
              <a className={item.recommended ? "primary-button cv-order-button" : "cv-outline-order"} href={cvWhatsAppLink(`Hello, I would like to order the ${item.name} package for ${formatTsh(item.priceTsh)}. Please tell me the next steps.`)} target="_blank" rel="noopener noreferrer">Order via WhatsApp <ArrowRight size={14} /></a>
            </article>)}
          </div>
        </section>

        <section className="cv-services-section cv-categories-section" aria-labelledby="cv-categories-title">
          <div className="cv-section-heading"><div><span className="eyebrow muted-eyebrow">PICK THE CAREER STAGE</span><h2 id="cv-categories-title">CVs for different career paths</h2></div><p>Select a category to see who it suits and the package options available.</p></div>
          <div className="cv-category-grid">
            {cvCategories.map(category => {
              const expanded = openCategory === category.id;
              return <article className={`cv-category-card${expanded ? " cv-category-open" : ""}`} key={category.id}>
                <button className="cv-category-trigger" type="button" aria-expanded={expanded} aria-controls={`cv-category-${category.id}`} onClick={() => setOpenCategory(current => current === category.id ? null : category.id)}>
                  <span><small>CV CATEGORY</small><strong>{category.name}</strong></span><span className="cv-category-toggle">{expanded ? "Hide details" : "View details"}<ChevronDown size={16} aria-hidden="true" /></span>
                </button>
                {expanded && <div className="cv-category-details" id={`cv-category-${category.id}`}>
                  <p>{category.description}</p>
                  <h3>Who it is suitable for</h3><p>{category.suitableFor}</p>
                  <h3>Relevant package options</h3>
                  <div className="cv-category-packages">{category.packageIds.map(id => {
                    const item = getPackage(id);
                    return <a key={id} href={cvWhatsAppLink(`Hello, I am interested in a ${category.name}. Please tell me about the ${item.name} package (${formatTsh(item.priceTsh)}).`)} target="_blank" rel="noopener noreferrer">{item.name} <strong>{formatTsh(item.priceTsh)}</strong></a>;
                  })}</div>
                  <a className="primary-button cv-category-order" href={cvWhatsAppLink(`Hello, I am interested in the ${category.name}. Please help me choose a suitable package.`)} target="_blank" rel="noopener noreferrer">Order via WhatsApp <ArrowRight size={14} /></a>
                </div>}
              </article>;
            })}
          </div>
        </section>

        <section className="cv-services-section cv-benefits-section" aria-labelledby="cv-benefits-title">
          <div className="cv-section-heading"><div><span className="eyebrow muted-eyebrow">THOUGHTFUL, TRUTHFUL SUPPORT</span><h2 id="cv-benefits-title">Why Choose Our CV Services?</h2></div><p>Professional presentation matters. Your CV must still reflect your real qualifications, work, and achievements.</p></div>
          <div className="cv-benefit-grid">{cvBenefits.map((benefit, index) => <article className="cv-benefit-card" key={benefit.title}><span className="cv-benefit-number">0{index + 1}</span><div><h3>{benefit.title}</h3><p>{benefit.description}</p></div></article>)}</div>
          <div className="cv-integrity-note"><ShieldCheck size={19} aria-hidden="true" /><p><strong>Honest CV support.</strong> We never invent qualifications or achievements, and we never guarantee employment, interviews, or ATS selection.</p></div>
        </section>

        <section className="cv-services-final-cta" aria-label="Contact us about CV services">
          <div><span className="eyebrow">READY WHEN YOU ARE</span><h2>Let’s make your experience easier to see.</h2><p>Tell us what role you’re applying for and which kind of support you need.</p></div>
          <div className="cv-services-final-actions"><a className="primary-button" href={cvWhatsAppLink("Hello, I would like to order a CV service. Please contact me about the available packages.")} target="_blank" rel="noopener noreferrer">Order via WhatsApp <ArrowRight size={15} /></a><a className="cv-final-text-link" href={cvWhatsAppLink("Hello, I would like to ask about a CV package.")} target="_blank" rel="noopener noreferrer">Ask About a Package</a></div>
        </section>
        <p className="cv-services-disclaimer">Prices are shown in Tanzanian shillings. Please confirm the package scope and final details with us on WhatsApp before we begin.</p>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
