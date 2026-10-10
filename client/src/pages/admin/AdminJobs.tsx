import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, Edit3, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { api, jsonBody, type Company, type Job } from "@/lib/api";
import { JobEditor, type JobDraft } from "./AdminForms";
import JobAdImporter, { type ImportedJobAd } from "./JobAdImporter";

export default function AdminJobs({ onChanged }: { onChanged: () => void }) {
  const [jobs, setJobs] = useState<Array<Job & { status: "draft" | "published" }>>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<(Job & { status: "draft" | "published" }) | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importedDraft, setImportedDraft] = useState<(Partial<Job> & { companyId?: number | null }) | null>(null);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [jobData, companyData] = await Promise.all([
        api<{ jobs: Array<Job & { status: "draft" | "published" }> }>("/api/gm/admin/jobs"),
        api<{ companies: Company[] }>("/api/gm/admin/companies"),
      ]);
      setJobs(jobData.jobs); setCompanies(companyData.companies);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load jobs."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(data: JobDraft, id?: number) {
    const payload = { ...data, companyId: data.companyId ? Number(data.companyId) : null };
    await api(id ? `/api/gm/admin/jobs/${id}` : "/api/gm/admin/jobs", { method: id ? "PUT" : "POST", body: jsonBody(payload) });
    setEditing(null); setCreating(false); setImportedDraft(null); setImportNotes([]);
    await load(); onChanged();
  }
  async function setStatus(job: Job & { status: "draft" | "published" }, status: "draft" | "published") {
    await api(`/api/gm/admin/jobs/${job.id}`, { method: "PUT", body: jsonBody({ status }) }); await load(); onChanged();
  }
  async function remove(job: Job) {
    if (!window.confirm(`Permanently delete “${job.title}” and its saved likes/saves?`)) return;
    await api(`/api/gm/admin/jobs/${job.id}`, { method: "DELETE" }); await load(); onChanged();
  }
  function startNewJob() {
    setImportedDraft(null); setImportNotes([]); setImportOpen(false); setEditing(null); setCreating(true);
  }
  function useImportedDraft(result: ImportedJobAd) {
    setImportedDraft({ ...result.fields, companyId: null, sourceUrl: "", imageUrl: "", companyLogoUrl: "", status: "draft" });
    setImportNotes(result.reviewNotes); setImportOpen(false); setEditing(null); setCreating(true);
  }

  return <div className="admin-section">
    <div className="admin-page-title"><div><span className="eyebrow muted-eyebrow">THE PUBLIC BOARD</span><h1>Job listings</h1><p>Add, edit or change visibility. Public pages show published listings only.</p></div><div className="admin-jobs-actions"><button className="secondary-button" type="button" onClick={() => { setCreating(false); setEditing(null); setImportOpen(open => !open); }}><Sparkles size={15} />Import from ad</button><button className="primary-button" type="button" onClick={startNewJob}><Plus size={16} />Add job</button></div></div>
    {error && <p className="admin-alert error-alert">{error}</p>}
    {importOpen && <JobAdImporter onCancel={() => setImportOpen(false)} onImport={useImportedDraft} />}
    {creating && <div className="admin-panel edit-panel">{importedDraft && <div className="ai-import-review" role="status"><Sparkles size={17} /><div><strong>Extracted draft — verify every field against the original ad.</strong><p>Local OCR and rule-based parsing can miss details; offline translations should be reviewed. Missing details remain blank, and the source file is not attached as a public image.</p>{importNotes.map((note, index) => <p key={`${index}-${note}`}>{note}</p>)}</div></div>}<JobEditor initial={importedDraft ?? undefined} companies={companies} showVisibility={!importedDraft} submitLabel={importedDraft ? "Save as draft" : "Save listing"} onCancel={() => { setCreating(false); setImportedDraft(null); setImportNotes([]); }} onSave={data => save({ ...data, status: importedDraft ? "draft" : data.status })} /></div>}
    {editing && <div className="admin-panel edit-panel"><JobEditor initial={editing} companies={companies} onCancel={() => setEditing(null)} onSave={data => save(data, editing.id)} /></div>}
    {loading ? <div className="admin-loading-inline">Loading listings…</div> : jobs.length ? <div className="admin-list">{jobs.map(job => <article className="admin-list-card" key={job.id}><div className="admin-list-card-main"><span className={`status-label ${job.status === "published" ? "status-published" : "status-draft"}`}><span />{job.status === "published" ? "Published" : "Unpublished"}</span>{job.isRemote && <span className="remote-job-badge"><span aria-hidden="true">⌁</span>Remote</span>}<h3>{job.title}</h3><p>{job.companyName || "Company not specified"}{job.location ? ` · ${job.location}` : ""}</p><small>{job.publishedAt ? `Published ${new Date(job.publishedAt).toLocaleDateString()}` : `Created ${job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ""}`}</small></div><div className="admin-card-actions"><button className="icon-button" title="Edit listing" aria-label="Edit listing" onClick={() => { setEditing(job); setCreating(false); setImportedDraft(null); setImportNotes([]); setImportOpen(false); }}><Edit3 size={15} /></button><button className={`icon-button ${job.status === "published" ? "status-action-on" : ""}`} title={job.status === "published" ? "Unpublish" : "Publish"} aria-label={job.status === "published" ? "Unpublish" : "Publish"} onClick={() => void setStatus(job, job.status === "published" ? "draft" : "published")}>{job.status === "published" ? <ArrowDownToLine size={16} /> : <Send size={15} />}</button><button className="icon-button danger-icon" title="Delete listing" aria-label="Delete listing" onClick={() => void remove(job)}><Trash2 size={15} /></button></div></article>)}</div> : !creating && !editing ? <div className="admin-empty"><BriefcaseBusinessIcon /><h2>No jobs yet.</h2><p>Start with a verified opportunity. You can publish it now or save it as a draft.</p><button className="secondary-button" onClick={startNewJob}>Add the first job <ArrowUpRight size={14} /></button></div> : null}
  </div>;
}
function BriefcaseBusinessIcon() { return <span className="admin-empty-symbol"><Check size={20} /></span>; }
