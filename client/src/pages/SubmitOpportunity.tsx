import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Send } from "lucide-react";
import { Brand } from "@/components/Brand";
import { SiteFooter } from "@/components/SiteFooter";

type Submission = {
  title: string;
  companyName: string;
  companyDescription: string;
  companyWebsiteUrl: string;
  companyLogoUrl: string;
  category: string;
  location: string;
  deadline: string;
  description: string;
  responsibilities: string;
  qualifications: string;
  howToApply: string;
  applicationUrl: string;
  imageUrl: string;
  sourceUrl: string;
};

const emptySubmission: Submission = {
  title: "", companyName: "", companyDescription: "", companyWebsiteUrl: "", companyLogoUrl: "",
  category: "", location: "", deadline: "", description: "", responsibilities: "", qualifications: "",
  howToApply: "", applicationUrl: "", imageUrl: "", sourceUrl: "",
};

export default function SubmitOpportunity() {
  const [form, setForm] = useState<Submission>(emptySubmission);
  const [fax, setFax] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const update = (key: keyof Submission, value: string) => setForm(current => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true); setError(""); setSubmitted(false);
    try {
      const response = await fetch("/api/gm/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, fax }),
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => null) as { error?: string; submitted?: boolean } | null;
      if (!response.ok || !result?.submitted) throw new Error(result?.error || "Your job could not be sent. Please try again.");
      setSubmitted(true); setForm(emptySubmission); setFax("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your job could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return <div className="site-shell">
    <header className="site-header"><div className="header-inner"><Brand /><a className="header-admin-link" href="/">Opportunities <ArrowUpRight size={14} /></a></div></header>
    <main className="submission-page">
      <a href="/" className="back-link"><ArrowLeft size={15} /> All opportunities</a>
      <section className="submission-intro">
        <span className="eyebrow"><span className="eyebrow-dot" />FOR EMPLOYERS & ORGANISATIONS</span>
        <h1>Share an opportunity.<br /><em>We’ll review it.</em></h1>
        <p>Send the job details and original application information. Every submission is reviewed by the Get Mchongo team before it can appear on the public board.</p>
        <div className="submission-review-note"><Check size={15} />Nothing is published automatically.</div>
      </section>

      {submitted && <div className="submission-success" role="status"><span><Check size={18} /></span><div><strong>Thank you — your opportunity is in the review queue.</strong><p>It will appear on Get Mchongo only after an administrator has reviewed and approved it.</p></div></div>}
      {error && <p className="submission-error" role="alert">{error}</p>}

      <form className="submission-form" onSubmit={event => void submit(event)}>
        <div className="submission-form-heading"><div><span className="eyebrow muted-eyebrow">01 / THE LISTING</span><h2>Job details</h2></div><span><b>*</b> Required</span></div>
        <label>Job title <b>*</b><input required maxLength={300} value={form.title} onChange={event => update("title", event.target.value)} placeholder="e.g. Finance Officer" /></label>
        <div className="form-grid-two">
          <label>Company / institution <b>*</b><input required maxLength={240} value={form.companyName} onChange={event => update("companyName", event.target.value)} placeholder="Organisation name" /></label>
          <label>Company website<input type="url" value={form.companyWebsiteUrl} onChange={event => update("companyWebsiteUrl", event.target.value)} placeholder="https://…" /></label>
        </div>
        <label>About the company / institution<textarea rows={3} maxLength={12000} value={form.companyDescription} onChange={event => update("companyDescription", event.target.value)} placeholder="A short description, if available" /></label>
        <div className="form-grid-three">
          <label>Category<input maxLength={120} value={form.category} onChange={event => update("category", event.target.value)} placeholder="e.g. Finance" /></label>
          <label>Location<input maxLength={240} value={form.location} onChange={event => update("location", event.target.value)} placeholder="As listed" /></label>
          <label>Application deadline<input maxLength={240} value={form.deadline} onChange={event => update("deadline", event.target.value)} placeholder="e.g. 30 June 2026" /></label>
        </div>
        <label>Job description <b>*</b><textarea required rows={6} maxLength={30000} value={form.description} onChange={event => update("description", event.target.value)} placeholder="Describe the opportunity accurately." /></label>
        <div className="form-grid-two">
          <label>Responsibilities<textarea rows={5} maxLength={12000} value={form.responsibilities} onChange={event => update("responsibilities", event.target.value)} placeholder="Key duties, if available" /></label>
          <label>Qualifications / requirements<textarea rows={5} maxLength={12000} value={form.qualifications} onChange={event => update("qualifications", event.target.value)} placeholder="Requirements, if available" /></label>
        </div>
        <label>How to apply<textarea rows={4} maxLength={8000} value={form.howToApply} onChange={event => update("howToApply", event.target.value)} placeholder="Explain the application steps, if available" /></label>
        <div className="form-grid-two">
          <label>Original application link<input type="url" value={form.applicationUrl} onChange={event => update("applicationUrl", event.target.value)} placeholder="https://…" /><small className="field-help">Add this link or provide clear application instructions above.</small></label>
          <label>Original job/source page<input type="url" value={form.sourceUrl} onChange={event => update("sourceUrl", event.target.value)} placeholder="https://…" /></label>
        </div>
        <div className="form-grid-two">
          <label>Company logo URL<input type="url" value={form.companyLogoUrl} onChange={event => update("companyLogoUrl", event.target.value)} placeholder="https://… (optional)" /></label>
          <label>Listing image URL<input type="url" value={form.imageUrl} onChange={event => update("imageUrl", event.target.value)} placeholder="https://… (optional)" /></label>
        </div>
        <div className="submission-honeypot" aria-hidden="true"><label>Leave blank<input name="fax" tabIndex={-1} autoComplete="off" value={fax} onChange={event => setFax(event.target.value)} /></label></div>
        <p className="submission-privacy">Your details are sent to Get Mchongo for review. The listing stays private until it is approved. Possible duplicates will be flagged for the administrator.</p>
        <button className="primary-button submission-submit" type="submit" disabled={sending}>{sending ? "Sending for review…" : "Submit for admin review"}<Send size={15} /></button>
      </form>
    </main>
    <SiteFooter />
  </div>;
}
