import { useRef, useState } from "react";
import { FileText, Languages, LoaderCircle, Sparkles, X } from "lucide-react";
import { api, jsonBody } from "@/lib/api";
import type { JobAdFields, OutputLanguage } from "../../../../server/getmchongo/job-ad-structurer";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export type ImportedJobAd = { fields: JobAdFields; reviewNotes: string[] };

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function JobAdImporter({ onCancel, onImport }: { onCancel: () => void; onImport: (result: ImportedJobAd) => void }) {
  const [sourceText, setSourceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("source");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!sourceText.trim() && !file) { setError("Paste the advertisement text or choose a PDF/image first."); return; }
    if (file && (!allowedTypes.has(file.type) || file.size > MAX_FILE_BYTES)) { setError("Choose a PDF, JPEG, PNG or WebP image no larger than 5 MB."); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { sourceText: sourceText.trim(), outputLanguage };
      if (file) { body.fileBase64 = await readBase64(file); body.mimeType = file.type; }
      const result = await api<ImportedJobAd>("/api/gm/admin/jobs/structure", { method: "POST", body: jsonBody(body) });
      onImport(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The advertisement could not be structured. Please try again.");
    } finally { setBusy(false); }
  }

  return <section className="admin-panel ai-import-panel" aria-labelledby="ai-import-title">
    <div className="ai-import-heading"><div><span className="eyebrow muted-eyebrow">ASSISTED STRUCTURING</span><h2 id="ai-import-title">Turn an ad into a job draft</h2><p>Paste the advert, upload its PDF/image, or use both. The AI leaves missing details blank.</p></div><button type="button" className="icon-button" aria-label="Close import assistant" onClick={onCancel}><X size={16} /></button></div>
    <form className="admin-form ai-import-form" onSubmit={event => void submit(event)}>
      <label>Advertisement text <span className="field-help">Up to 40,000 characters</span><textarea rows={7} maxLength={40_000} value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="Paste the full job advert here…" /></label>
      <label className="ai-file-field"><span>PDF or image <span className="field-help">PDF, JPEG, PNG or WebP · max 5 MB</span></span><input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} /><small className="field-help">{file ? <><FileText size={13} /> {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB) <button type="button" className="text-link" onClick={event => { event.preventDefault(); event.stopPropagation(); setFile(null); if (fileInput.current) fileInput.current.value = ""; }}>Remove</button></> : "The source document is used for extraction only; it will not be published as a listing image."}</small></label>
      <label className="ai-language-field"><Languages size={15} />Output language<select value={outputLanguage} onChange={event => setOutputLanguage(event.target.value as OutputLanguage)}><option value="source">Keep the source language</option><option value="English">English</option><option value="Kiswahili">Kiswahili</option></select></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={15} />Structuring…</> : <><Sparkles size={15} />Structure ad</>}</button></div>
      <p className="field-help ai-privacy-note">Uploaded files are held temporarily in memory for this request and removed afterwards. AI output is only a draft; review every field before saving or publishing.</p>
    </form>
  </section>;
}
