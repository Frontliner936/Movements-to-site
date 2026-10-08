import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, FileText, Maximize2, Megaphone, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import { SiteFooter } from "@/components/SiteFooter";
import { announcementKinds, api, type Announcement } from "@/lib/api";

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState<Announcement | null>(null);
  useEffect(() => {
    document.title = "Announcements — Get Mchongo";
    api<{ announcements: Announcement[] }>("/api/gm/announcements")
      .then(data => setItems(data.announcements))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Announcements could not be loaded."))
      .finally(() => setLoading(false));
  }, []);
  const kindLabel = (kind: Announcement["kind"]) => announcementKinds.find(item => item.value === kind)?.label ?? "News";

  return <div className="site-shell announcements-shell">
    <header className="site-header"><div className="header-inner"><Brand /><div className="header-actions"><a className="header-submit-link" href="/submit">Post a job <ArrowRight size={14} /></a><a className="header-admin-link" href="/">Opportunities</a></div></div></header>
    <main className="announcements-page">
      <a href="/" className="back-link"><ArrowLeft size={14} /> Back to opportunities</a>
      <section className="announcements-intro"><span className="eyebrow"><span className="eyebrow-dot" />LATEST</span><h1>Announcements</h1><p>Interviews, events, adverts and businesses we want you to know about.</p></section>
      {error && <div className="submission-error" role="alert">{error}</div>}
      {loading ? <p className="announcements-empty">Loading announcements…</p> : items.length === 0 && !error ? <div className="announcements-empty"><Megaphone size={22} /><p>No announcements yet. Please check back soon.</p></div> : <div className="announcement-list">
        {items.map(item => <article className="announcement-card" key={item.id}>
          {item.imageUrl && <figure className="announcement-photo"><img src={item.imageUrl} alt={item.imageCaption || item.title} loading="lazy" />{item.imageCaption && <figcaption>{item.imageCaption}</figcaption>}</figure>}
          <div className="announcement-body">
            <div className="announcement-meta"><span className="announcement-kind">{kindLabel(item.kind)}</span><time dateTime={item.publishedAt ?? item.createdAt}>{new Date(item.publishedAt ?? item.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></div>
            <h2>{item.title}</h2>
            {item.body && <p className="announcement-text">{item.body}</p>}
            {(item.imageUrl || item.pdfUrl || item.linkUrl) && <div className="announcement-actions">
              {(item.imageUrl || item.pdfUrl) && <button type="button" className="secondary-button" onClick={() => setViewer(item)}><Maximize2 size={14} />View full advert</button>}
              {item.pdfUrl && <a className="secondary-button" href={item.pdfUrl} download={item.pdfName || "announcement.pdf"}><FileText size={14} />{item.pdfName ? `Download ${item.pdfName}` : "Download PDF"}</a>}
              {item.linkUrl && <a className="secondary-button" href={item.linkUrl} target="_blank" rel="noopener noreferrer nofollow">{item.linkLabel || "Open link"}<ExternalLink size={14} /></a>}
            </div>}
          </div>
        </article>)}
      </div>}
    </main>
    <SiteFooter />
  </div>;
}
