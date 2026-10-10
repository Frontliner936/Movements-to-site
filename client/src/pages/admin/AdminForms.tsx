import { useEffect, useState } from "react";
import { ArrowUpRight, ImagePlus, LoaderCircle, Upload } from "lucide-react";
import { api, jsonBody, type Company, type Job } from "@/lib/api";
import { formatJobBulletItems } from "@/lib/jobFormatting";

export type JobDraft = {
  title: string; companyId: string; companyName: string; category: string; location: string; isRemote: boolean; deadline: string;
  companyDescription: string; companyLogoUrl: string; companyWebsiteUrl: string;
  description: string; responsibilities: string; qualifications: string; howToApply: string;
  applicationUrl: string; imageUrl: string; sourceUrl: string; status: "draft" | "published";
};
export type SourceKind = "rss" | "json" | "career" | "scraper";
export type SourceRecord = { id: number; name: string; type: SourceKind; url: string; isActive: boolean; settings: Record<string, unknown> | null; lastRunAt: string | null; lastRunError: string | null; lastRunCount: number; totalJobsFound: number };
export type PendingRecord = Job & { sourceId: number; sourceName: string; sourceUrl: string | null; rawContext: string | null; duplicateMatches: Array<{ recordType: string; recordId: number; title: string; companyName: string | null; reasons: string[] }> };

const emptyJob: JobDraft = { title: "", companyId: "", companyName: "", companyDescription: "", companyLogoUrl: "", companyWebsiteUrl: "", category: "", location: "", isRemote: false, deadline: "", description: "", responsibilities: "", qualifications: "", howToApply: "", applicationUrl: "", imageUrl: "", sourceUrl: "", status: "draft" };
export const toJobDraft = (job?: Partial<Job> & { companyId?: number | null }): JobDraft => job ? ({
  title: job.title ?? "", companyId: job.companyId ? String(job.companyId) : "", companyName: job.companyName ?? "", companyDescription: job.companyDescription ?? "", companyLogoUrl: job.companyLogoUrl ?? "", companyWebsiteUrl: job.companyWebsiteUrl ?? "", category: job.category ?? "", location: job.location ?? "", isRemote: job.isRemote ?? false, deadline: job.deadline ?? "", description: job.description ?? "", responsibilities: job.responsibilities ?? "", qualifications: job.qualifications ?? "", howToApply: job.howToApply ?? "", applicationUrl: job.applicationUrl ?? "", imageUrl: job.imageUrl ?? "", sourceUrl: job.sourceUrl ?? "", status: job.status === "published" ? "published" : "draft",
}) : { ...emptyJob };

export function ImagePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [preview, setPreview] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setPreview(value), [value]);
  async function pick(file?: File) {
    if (!file) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type) || file.size > 5 * 1024 * 1024) { setMessage("Choose a PNG, JPEG or WebP image under 5 MB."); return; }
    const localPreview = URL.createObjectURL(file); setPreview(localPreview); setMessage(""); setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error("Image could not be read."));
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.readAsDataURL(file);
      });
      const data = await api<{ url: string }>("/api/gm/admin/upload", { method: "POST", body: jsonBody({ base64, mimeType: file.type }) });
      onChange(data.url); setPreview(data.url); setMessage("Image uploaded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image upload failed."); }
    finally { setUploading(false); }
  }
  return <div className="image-picker"><span className="field-label">{label}</span><div className="image-picker-row">{preview ? <img src={preview} alt="Selected image preview" className="image-preview" /> : <span className="image-preview image-preview-empty"><ImagePlus size={21} /></span>}<label className="upload-control"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void pick(event.target.files?.[0])} /><span className="secondary-button">{uploading ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />}{uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}</span></label>{value && <button type="button" className="subtle-link" onClick={() => { onChange(""); setPreview(""); setMessage(""); }}>Remove</button>}</div>{message && <small className="field-help">{message}</small>}<small className="field-help">PNG, JPEG or WebP · maximum 5 MB</small></div>;
}

export function JobEditor({ initial, companies, showVisibility = true, submitLabel = "Save listing", onSave, onCancel }: { initial?: Partial<Job> & { companyId?: number | null }; companies: Company[]; showVisibility?: boolean; submitLabel?: string; onSave: (data: JobDraft) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<JobDraft>(() => toJobDraft(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof JobDraft, value: string) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { await onSave({ ...form, responsibilities: formatJobBulletItems(form.responsibilities), qualifications: formatJobBulletItems(form.qualifications) }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Listing could not be saved."); } finally { setSaving(false); } }
  return <form className="admin-form editor-form" onSubmit={event => void submit(event)}>
    <div className="form-section-heading"><span className="eyebrow muted-eyebrow">LISTING DETAILS</span><strong>{initial?.id ? "Edit opportunity" : "New opportunity"}</strong></div>
    <label>Job title <span className="required-star">*</span><input value={form.title} onChange={event => update("title", event.target.value)} required maxLength={300} /></label>
    <div className="form-grid-two"><label>Company / institution<input value={form.companyName} onChange={event => update("companyName", event.target.value)} maxLength={240} placeholder="As stated in the listing" /></label><label>Company profile<select value={form.companyId} onChange={event => { const selected = companies.find(company => String(company.id) === event.target.value); setForm(current => ({ ...current, companyId: event.target.value, ...(selected && !current.companyName ? { companyName: selected.name } : {}) })); }}><option value="">No profile linked</option>{companies.map(company => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label></div>
    <div className="form-grid-two"><label>About the company / institution<textarea rows={3} value={form.companyDescription} onChange={event => update("companyDescription", event.target.value)} /></label><label>Company website<input type="url" value={form.companyWebsiteUrl} onChange={event => update("companyWebsiteUrl", event.target.value)} placeholder="https://…" /></label></div>
    <div className="form-grid-three"><label>Category<input value={form.category} onChange={event => update("category", event.target.value)} placeholder="e.g. Technology" maxLength={120} /></label><label>Location<input value={form.location} onChange={event => update("location", event.target.value)} placeholder="As listed" maxLength={240} /></label><label>Deadline<input value={form.deadline} onChange={event => update("deadline", event.target.value)} placeholder="e.g. 30 June 2026" maxLength={240} /></label></div>
    <label className="remote-job-toggle"><input type="checkbox" checked={form.isRemote} onChange={event => setForm(current => ({ ...current, isRemote: event.target.checked }))} /><span><strong>Remote job</strong><small>Show this listing on the public Remote Jobs page.</small></span></label>
    <label>Description<textarea rows={5} value={form.description} onChange={event => update("description", event.target.value)} placeholder="Only include information confirmed by the original listing." /></label>
    <div className="form-grid-two"><label>Responsibilities<textarea rows={4} value={form.responsibilities} onChange={event => update("responsibilities", event.target.value)} placeholder="Enter one responsibility per line." /><small className="field-help">Each non-empty line will be saved as a bullet.</small></label><label>Qualifications / requirements<textarea rows={4} value={form.qualifications} onChange={event => update("qualifications", event.target.value)} placeholder="Enter one qualification per line." /><small className="field-help">Each non-empty line will be saved as a bullet.</small></label></div>
    <label>How to apply<textarea rows={3} value={form.howToApply} onChange={event => update("howToApply", event.target.value)} /></label>
    <div className="form-grid-two"><label>Original application link<input type="url" value={form.applicationUrl} onChange={event => update("applicationUrl", event.target.value)} placeholder="https://…" /></label><label>Original source page<input type="url" value={form.sourceUrl} onChange={event => update("sourceUrl", event.target.value)} placeholder="https://…" /></label></div>
    <ImagePicker label="Company logo" value={form.companyLogoUrl} onChange={value => update("companyLogoUrl", value)} />
    <ImagePicker label="Listing image" value={form.imageUrl} onChange={value => update("imageUrl", value)} />
    {showVisibility && <label>Visibility<select value={form.status} onChange={event => update("status", event.target.value as JobDraft["status"])}><option value="draft">Draft / unpublished</option><option value="published">Published on Get Mchongo</option></select><small className="field-help">Only published listings appear on the public website.</small></label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : submitLabel}<ArrowUpRight size={14} /></button></div>
  </form>;
}

export function CompanyEditor({ initial, onSave, onCancel }: { initial?: Company; onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? "", description: initial?.description ?? "", location: initial?.location ?? "", websiteUrl: initial?.websiteUrl ?? "", logoUrl: initial?.logoUrl ?? "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { await onSave(form); } catch (reason) { setError(reason instanceof Error ? reason.message : "Company could not be saved."); } finally { setSaving(false); } }
  return <form className="admin-form editor-form" onSubmit={event => void submit(event)}><div className="form-section-heading"><span className="eyebrow muted-eyebrow">COMPANY PROFILE</span><strong>{initial ? "Edit company" : "Add a company"}</strong></div><label>Company / institution name <span className="required-star">*</span><input required value={form.name} onChange={event => update("name", event.target.value)} /></label><div className="form-grid-two"><label>Location<input value={form.location} onChange={event => update("location", event.target.value)} /></label><label>Website<input type="url" value={form.websiteUrl} onChange={event => update("websiteUrl", event.target.value)} placeholder="https://…" /></label></div><label>About the organisation<textarea rows={4} value={form.description} onChange={event => update("description", event.target.value)} /></label><ImagePicker label="Company logo" value={form.logoUrl} onChange={value => update("logoUrl", value)} />{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : initial ? "Save company" : "Add company"}</button></div></form>;
}

export function SourceEditor({ initial, onSave, onCancel }: { initial?: SourceRecord; onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const settings = initial?.settings ?? {};
  const [name, setName] = useState(initial?.name ?? ""); const [url, setUrl] = useState(initial?.url ?? ""); const [type, setType] = useState<SourceKind>(initial?.type ?? "rss");
  const [companyName, setCompanyName] = useState(String(settings.companyName ?? "")); const [itemsPath, setItemsPath] = useState(String(settings.itemsPath ?? ""));
  const [linkSelector, setLinkSelector] = useState(String(settings.linkSelector ?? "")); const [fieldMap, setFieldMap] = useState(JSON.stringify(settings.fieldMap ?? {}, null, 2));
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const map = JSON.parse(fieldMap || "{}"); if (!map || Array.isArray(map) || typeof map !== "object") throw new Error("Field map must be a JSON object."); await onSave({ name, url, type, isActive: initial?.isActive ?? true, settings: { companyName: companyName || undefined, itemsPath: itemsPath || undefined, linkSelector: linkSelector || undefined, fieldMap: map } }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Source could not be saved."); } finally { setSaving(false); } }
  return <form className="admin-form editor-form" onSubmit={event => void submit(event)}><div className="form-section-heading"><span className="eyebrow muted-eyebrow">TRACKED SOURCE</span><strong>{initial ? "Edit source" : "Add a source"}</strong></div><div className="form-grid-two"><label>Source name <span className="required-star">*</span><input required value={name} onChange={event => setName(event.target.value)} /></label><label>Source type<select value={type} onChange={event => setType(event.target.value as SourceKind)}><option value="rss">RSS / Atom feed</option><option value="json">JSON API</option><option value="career">Career / static page</option><option value="scraper">Web scraping</option></select></label></div><label>Source URL <span className="required-star">*</span><input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /><small className="field-help">Only public HTTP(S) hosts and standard web ports are accepted.</small></label><div className="form-grid-two"><label>Company (only if confirmed)<input value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="Leave blank if not known" /></label><label>JSON items path<input value={itemsPath} onChange={event => setItemsPath(event.target.value)} placeholder="e.g. data.jobs" disabled={type !== "json"} /></label></div>{type === "json" && <label>JSON field map<textarea rows={7} spellCheck={false} value={fieldMap} onChange={event => setFieldMap(event.target.value)} /><small className="field-help">Optional JSON paths: title, companyName, category, location, deadline, description, responsibilities, qualifications, howToApply, sourceUrl, imageUrl. Leave fields unmapped to use common API field names.</small></label>}{(type === "career" || type === "scraper") && <label>Optional job-link CSS selector<input value={linkSelector} onChange={event => setLinkSelector(event.target.value)} placeholder="a[href] with job links detected automatically" /><small className="field-help">Career pages with structured JobPosting data are parsed first; source pages without a field are left blank.</small></label>}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : initial ? "Save source" : "Add source"}</button></div></form>;
}
