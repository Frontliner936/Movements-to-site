import { Mail, MessageCircle, Phone } from "lucide-react";
import { Brand } from "@/components/Brand";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-brand-copy"><Brand light /><p>Made for the next move.</p></div>
    <div className="footer-contact" id="contact">
      <span className="footer-contact-title">Contact us</span>
      <a href="tel:+255743738062"><Phone size={13} aria-hidden="true" /><span>+255 743 738 062</span></a>
      <a href="mailto:frontlinertech@gmail.com"><Mail size={13} aria-hidden="true" /><span>frontlinertech@gmail.com</span></a>
    </div>
    <div className="footer-useful-links" aria-labelledby="footer-useful-links-title">
      <span className="footer-contact-title" id="footer-useful-links-title">Useful links</span>
      <div className="footer-useful-links-list">
        <a className="footer-useful-link" href="https://portal.ajira.go.tz/" target="_blank" rel="noopener noreferrer">Ajira Portal</a>
        <a className="footer-useful-link" href="https://www.michaelpageafrica.com/advice/career-advice/job-interview-tips/top-10-interview-questions-and-how-answer-them" target="_blank" rel="noopener noreferrer">Interview questions</a>
        <a className="footer-useful-link" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT</a>
        <a className="footer-useful-link" href="https://www.utumishi.go.tz/pages/remuneration-and-staff-welfare" target="_blank" rel="noopener noreferrer">Government salary scale</a>
        <a className="footer-useful-link" href="https://matokeo.necta.go.tz/" target="_blank" rel="noopener noreferrer">NECTA results</a>
      </div>
    </div>
    <div className="footer-links"><a href="/">Opportunities</a><a href="/announcements">Announcements</a><a href="/submit">Post a job</a><a href="/contact"><MessageCircle size={13} />Send a message</a><a href="/admin/login">Admin access</a></div>
    <span className="footer-year">© {new Date().getFullYear()} GET MCHONGO</span>
  </footer>;
}
