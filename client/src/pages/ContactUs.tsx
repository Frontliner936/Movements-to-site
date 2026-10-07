import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import { Brand } from "@/components/Brand";
import { SiteFooter } from "@/components/SiteFooter";

export default function ContactUs() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [fax, setFax] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/gm/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, message, fax }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Your message could not be sent. Please try again.");
      setSent(true);
      setEmail("");
      setMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your message could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="site-shell">
    <header className="site-header"><div className="header-inner"><Brand /><div className="header-actions"><a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a><a className="header-admin-link" href="/">Opportunities</a></div></div></header>
    <main className="contact-page">
      <a href="/" className="back-link"><ArrowLeft size={14} /> Back to opportunities</a>
      <section className="contact-intro"><span className="eyebrow"><span className="eyebrow-dot" />WE’RE LISTENING</span><h1>Leave us a <em>message.</em></h1><p>Send the Get Mchongo team a note. Your email and message go to our private admin inbox; we’ll use your email if a reply is needed.</p></section>
      <section className="contact-card" aria-labelledby="contact-form-title">
        {sent ? <div className="contact-success" role="status"><span><Check size={17} /></span><div><strong>Your message is in our inbox.</strong><p>Thanks for getting in touch. We’ll review it and can reply using the email you provided.</p><button type="button" className="text-link" onClick={() => setSent(false)}>Send another message <ArrowRight size={13} /></button></div></div> : <>
          {error && <div className="submission-error" role="alert">{error}</div>}
          <form className="contact-form" onSubmit={event => void submit(event)}>
            <div className="contact-form-heading"><span className="contact-message-icon"><MessageCircle size={19} /></span><div><span className="eyebrow muted-eyebrow">GET IN TOUCH</span><h2 id="contact-form-title">Write to us</h2></div></div>
            <label>Email address <b>*</b><input type="email" name="email" autoComplete="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Your message <b>*</b><textarea name="message" rows={7} minLength={3} maxLength={5000} value={message} onChange={event => setMessage(event.target.value)} placeholder="How can we help?" required /></label>
            <div className="contact-honeypot" aria-hidden="true"><label>Fax<input type="text" name="fax" autoComplete="off" tabIndex={-1} value={fax} onChange={event => setFax(event.target.value)} /></label></div>
            <p className="contact-privacy"><Mail size={13} /> Your email and message are private to the Get Mchongo admin inbox. We don’t publish them or send an automatic email.</p>
            <button className="primary-button contact-submit" type="submit" disabled={busy}>{busy ? "Sending…" : "Send message"} <ArrowRight size={15} /></button>
          </form>
        </>}
      </section>
      <p className="contact-direct-note">Prefer to call or email directly? Both options are in the footer below.</p>
    </main>
    <SiteFooter />
  </div>;
}
