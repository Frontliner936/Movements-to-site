import { useEffect, useState } from "react";
import { Check, CheckCircle2, CircleDollarSign, RefreshCw, ShieldCheck, X } from "lucide-react";
import { api, jsonBody } from "@/lib/api";

type RecruiterRow = { id: number; email: string; contactName: string; phone: string; companyName: string; location: string; businessDetails: string; memberCount: number; tier: "small" | "medium" | "large"; priceTsh: number; payerPhone: string | null; paymentReference: string | null; paymentStatus: "unsubmitted" | "submitted" | "verified" | "rejected"; accessStatus: "pending" | "approved" | "rejected"; createdAt: string; updatedAt: string };
const tiers = { small: { range: "0–199 members", amount: 15000 }, medium: { range: "200–999 members", amount: 30000 }, large: { range: "1,000+ members", amount: 50000 } } as const;
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";

export default function AdminRecruiters() {
  const [rows, setRows] = useState<RecruiterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setError(""); setLoading(true);
    try {
      const result = await api<{ recruiters: RecruiterRow[] }>("/api/gm/admin/recruiters");
      setRows(result.recruiters);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Recruiter applications could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function update(id: number, endpoint: "payment" | "decision", body: unknown, message: string) {
    setBusyId(id); setError(""); setNotice("");
    try {
      await api(`/api/gm/admin/recruiters/${id}/${endpoint}`, { method: "POST", body: jsonBody(body) });
      setNotice(message); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The recruiter record could not be updated."); }
    finally { setBusyId(null); }
  }

  const pending = rows.filter(row => row.accessStatus === "pending").length;
  const paymentAwaiting = rows.filter(row => row.paymentStatus === "submitted").length;
  return <section className="admin-section">
    <div className="admin-page-title"><div><span className="eyebrow muted-eyebrow">RECRUITER ACCESS</span><h1>Recruiter applications</h1><p>Verify HaloPesa references and make an independent account-access decision.</p></div><button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} />Refresh</button></div>
    <div className="member-admin-privacy"><ShieldCheck size={16} /><span>Payment verification and recruiter approval are separate actions. Directory access is enabled only when both are complete; recruiter access is limited to member profiles that were explicitly opted in, never CVs.</span></div>
    {error && <p role="alert" className="admin-alert error-alert">{error}</p>}{notice && <p role="status" className="admin-alert success-alert">{notice}</p>}
    <div className="overview-stats recruiter-admin-stats"><div className="overview-stat"><span className="stat-icon"><ShieldCheck size={18} /></span><span className="stat-label">Applications</span><strong>{rows.length}</strong><small>{pending} awaiting a decision</small></div><div className="overview-stat"><span className="stat-icon"><CircleDollarSign size={18} /></span><span className="stat-label">Payments to verify</span><strong>{paymentAwaiting}</strong><small>Submitted references</small></div></div>
    {loading ? <div className="admin-loading-inline">Loading recruiter applications…</div> : rows.length ? <div className="recruiter-admin-list">{rows.map(row => <article key={row.id} className="admin-panel recruiter-admin-card">
      <header className="recruiter-admin-card-head"><div><span className="eyebrow muted-eyebrow">{tiers[row.tier].range} · TSh {row.priceTsh.toLocaleString("en-US")}</span><h2>{row.companyName}</h2><p>{row.contactName} · <a href={`mailto:${row.email}`}>{row.email}</a></p></div><div className="recruiter-admin-badges"><span className={`member-status ${row.paymentStatus === "verified" ? "active" : row.paymentStatus === "submitted" ? "pending" : "inactive"}`}>{row.paymentStatus === "verified" ? "Payment verified" : row.paymentStatus === "submitted" ? "Payment submitted" : row.paymentStatus === "rejected" ? "Payment rejected" : "Unpaid"}</span><span className={`member-status ${row.accessStatus === "approved" ? "active" : row.accessStatus === "pending" ? "pending" : "inactive"}`}>{row.accessStatus === "approved" ? "Approved" : row.accessStatus === "pending" ? "Pending approval" : "Rejected"}</span></div></header>
      <div className="recruiter-admin-details"><div><small>Business location</small><strong>{row.location}</strong></div><div><small>Recruiter phone</small><a href={`tel:${row.phone}`}>{row.phone}</a></div><div><small>Selected members</small><strong>{row.memberCount.toLocaleString("en-US")}</strong></div><div><small>Payer phone</small>{row.payerPhone ? <a href={`tel:${row.payerPhone}`}>{row.payerPhone}</a> : <strong>Not submitted</strong>}</div><div><small>Payment reference</small><strong>{row.paymentReference || "Not submitted"}</strong></div><div><small>Applied</small><strong>{dateLabel(row.createdAt)}</strong></div><div><small>Business details</small><strong>{row.businessDetails}</strong></div></div>
      <div className="recruiter-admin-actions">{row.paymentStatus === "submitted" && <button type="button" className="secondary-button" disabled={busyId === row.id} onClick={() => void update(row.id, "payment", { verified: true }, `Payment verified for ${row.companyName}.`)}><CheckCircle2 size={15} />{busyId === row.id ? "Saving…" : "Confirm payment"}</button>}{row.accessStatus === "pending" && row.paymentStatus === "verified" && <button type="button" className="primary-button" disabled={busyId === row.id} onClick={() => void update(row.id, "decision", { decision: "approved" }, `Recruiter access approved for ${row.companyName}.`)}><Check size={15} />Approve access</button>}{row.accessStatus === "pending" && <button type="button" className="danger-button" disabled={busyId === row.id} onClick={() => void update(row.id, "decision", { decision: "rejected" }, `Recruiter application declined for ${row.companyName}.`)}><X size={15} />Reject application</button>}</div>
    </article>)}</div> : <div className="admin-empty"><span className="admin-empty-symbol"><ShieldCheck size={19} /></span><h2>No recruiter applications yet</h2><p>Recruiter account applications will appear here for payment review and approval.</p></div>}
  </section>;
}
