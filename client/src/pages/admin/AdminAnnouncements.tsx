import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Edit3, FileText, LoaderCircle, Megaphone, Plus, Send, Trash2, Upload } from "lucide-react";
import { announcementKinds, api, jsonBody, type Announcement, type AnnouncementKind } from "@/lib/api";
import { ImagePicker } from "./AdminForms";

type Draft = { title: string; kind: AnnouncementKind; body: string; imageUrl: string; imageCaption: string; pdfUrl: string; pdfName: string; linkUrl: string; linkLabel: string; status: "draft" | "published" };
const toDraft = (item?: Announcement): Draft => ({
  title: item?.title ?? "", kind: item?.kind ?? "news", body: item?.body ?? "", imageUrl: item?.imageUrl ?? "", imageCaption: item?.imageCaption ?? "",
  pdfUrl: item?.pdfUrl ?? "", pdfName: item?.pdfName ?? "", linkUrl: item?.linkUrl ?? "", linkLabel: item?.linkLabel ?? "", status: item?.status ?? "draft",
});

function PdfPicker({ url, name, onChange }: { url: string; name: string; onChange: (url: string, name: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  async function pick(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) { setMessage("Choose a PDF file under 5 MB."); return; }
    setMessage(""); setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error("The PDF could not be read."));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.readAsDataURL(file);
      });
      const data = await api<{ url: string }>("/api/gm/admin/upload", { method: "POST", body: jsonBody({ base64, mimeType: "application/pdf" }) });
      onChange(data.url, file.name.slice(0, 240));
    } catch (error) { setMessage(error instanceof Error ? error.message : "PDF upload failed."); }
    finally { setUploading(false); }
  }
  return <div className="image-picker"><span className="field-label">PDF document (optional)</span>
    <div className="image-picker-row">
      <span className="image-preview image-preview-empty"><FileText size={21} /></span>
      <label className="upload-control"><input type="file" accept="application/pdf" onChange={event => void pick(event.target.files?.[0])} /><span className="secondary-button">{uploading ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />}{uploading ? "Uploading…" : url ? "Replace PDF" : "Upload PDF"}</span></label>
      {url && <button type="button" className="subtle-link" onClick={() => onChange("", "")}>Remove</button>}
    </div>
    {url && <small className="field-help">Attached: {name || "PDF document"}</small>}
    {message && <small className="field-help">{message}</small>}
    <small className="field-help">PDF only · maximum 5 MB</small>
  </div>;
}

function AnnouncementEditor({ initial, onSave, onCancel }: { initial?: Announcement; onSave: (data: Draft) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<Draft>(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await onSave(form); } catch (reason) { setError(reason instanceof Error ? reason.message : "Announcement could not be saved."); } finally { setSaving(false); }
  }
  return <form className="admin-form editor-form" onSubmit={event => void submit(event)}>
    <div className="form-section-heading"><span className="eyebrow muted-eyebrow">ANNOUNCEMENT</span><strong>{initial ? "Edit announcement" : "New announcement"}</strong></div>
    <div className="form-grid-two">
      <label>Title <span className="required-star">*</span><input value={form.title} onChange={event => update("title", event.target.value)} required maxLength={300} /></label>
      <label>Type<select value={form.kind} onChange={event => update("kind", event.target.value as AnnouncementKind)}>{announcementKinds.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
    </div>
    <label>Text<textarea rows={6} value={form.body} onChange={event => update("body", event.target.value)} maxLength={20000} placeholder="Write the announcement…" /></label>
    <ImagePicker label="Photo (optional)" value={form.imageUrl} onChange={value => update("imageUrl", value)} />
    {form.imageUrl && <label>Photo caption<input value={form.imageCaption} onChange={event => update("imageCaption", event.target.value)} maxLength={600} placeholder="Describe the photo" /></label>}
    <PdfPicker url={form.pdfUrl} name={form.pdfName} onChange={(url, name) => setForm(current => ({ ...current, pdfUrl: url, pdfName: name }))} />
    <div className="form-grid-two">
      <label>Link (optional)<input type="url" value={form.linkUrl} onChange={event => update("linkUrl", event.target.value)} placeholder="https://…" /></label>
      {form.linkUrl && <label>Link text<input value={form.linkLabel} onChange={event => update("linkLabel", event.target.value)} maxLength={120} placeholder="e.g. Watch the interview" /></label>}
    </div>
    <label>Visibility<select value={form.status} onChange={event => update("status", event.target.value as Draft["status"])}><option value="draft">Draft / hidden</option><option value="published">Published on the website</option></select><small className="field-help">Only published announcements appear on the public site.</small></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save announcement"}<ArrowUpRight size={14} /></button></div>
  </form>;
}

export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await api<{ announcements: Announcement[] }>("/api/gm/admin/announcements")).announcements); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load announcements."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(data: Draft, id?: number) {
    await api(id ? `/api/gm/admin/announcements/${id}` : "/api/gm/admin/announcements", { method: id ? "PUT" : "POST", body: jsonBody(data) });
    setEditing(null); setCreating(false); await load();
  }
  async function setStatus(item: Announcement, status: "draft" | "published") {
    try { await api(`/api/gm/admin/announcements/${item.id}`, { method: "PUT", body: jsonBody({ status }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not change visibility."); }
  }
  async function remove(item: Announcement) {
    if (!window.confirm(`Permanently delete “${item.title}”?`)) return;
    try { await api(`/api/gm/admin/announcements/${item.id}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete the announcement."); }
  }
  const kindLabel = (kind: AnnouncementKind) => announcementKinds.find(item => item.value === kind)?.label ?? kind;

  return <div className="admin-section">
    <div className="admin-page-title"><div><span className="eyebrow muted-eyebrow">PUBLIC NOTICEBOARD</span><h1>Announcements</h1><p>Interviews, events, adverts and announced businesses. Published items show on the website.</p></div><button className="primary-button" type="button" onClick={() => { setEditing(null); setCreating(true); }}><Plus size={16} />Add announcement</button></div>
    {error && <p className="admin-alert error-alert">{error}</p>}
    {creating && <div className="admin-panel edit-panel"><AnnouncementEditor onCancel={() => setCreating(false)} onSave={data => save(data)} /></div>}
    {editing && <div className="admin-panel edit-panel"><AnnouncementEditor initial={editing} onCancel={() => setEditing(null)} onSave={data => save(data, editing.id)} /></div>}
    {loading ? <div className="admin-loading-inline">Loading announcements…</div> : items.length ? <div className="admin-list">{items.map(item => <article className="admin-list-card" key={item.id}>
      <div className="admin-list-card-main"><span className={`status-label ${item.status === "published" ? "status-published" : "status-draft"}`}><span />{item.status === "published" ? "Published" : "Hidden"}</span><h3>{item.title}</h3><p>{kindLabel(item.kind)}{item.imageUrl ? " · Photo" : ""}{item.pdfUrl ? " · PDF" : ""}{item.linkUrl ? " · Link" : ""}</p><small>Created {new Date(item.createdAt).toLocaleDateString()}</small></div>
      <div className="admin-card-actions">
        <button className="icon-button" title="Edit" aria-label="Edit announcement" onClick={() => { setEditing(item); setCreating(false); }}><Edit3 size={15} /></button>
        <button className={`icon-button ${item.status === "published" ? "status-action-on" : ""}`} title={item.status === "published" ? "Hide from website" : "Publish"} aria-label={item.status === "published" ? "Hide from website" : "Publish"} onClick={() => void setStatus(item, item.status === "published" ? "draft" : "published")}>{item.status === "published" ? <ArrowDownToLine size={16} /> : <Send size={15} />}</button>
        <button className="icon-button danger-icon" title="Delete" aria-label="Delete announcement" onClick={() => void remove(item)}><Trash2 size={15} /></button>
      </div>
    </article>)}</div> : !creating && !editing ? <div className="admin-empty"><span className="admin-empty-symbol"><Megaphone size={20} /></span><h2>No announcements yet.</h2><p>Add an interview, event, advert or business announcement. You can publish it now or keep it hidden as a draft.</p><button className="secondary-button" onClick={() => setCreating(true)}>Add the first announcement <ArrowUpRight size={14} /></button></div> : null}
  </div>;
}
