import { useEffect, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";

type MemberRow = { id: number; displayName: string; email: string; isActive: boolean; createdAt: string; lastSignedIn: string | null };
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString() : "Never";

export default function AdminMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<{ members: MemberRow[] }>("/api/gm/admin/members").then(result => { if (active) setMembers(result.members); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Member list could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section className="admin-section">
    <div className="admin-page-title"><div><span className="eyebrow muted-eyebrow">JOB SEEKER ACCOUNTS</span><h1>Members</h1><p>Basic account details only. Passwords and CV content are never shown here.</p></div><span className="member-admin-total"><Users size={18} />{members.length} accounts</span></div>
    <div className="member-admin-privacy"><ShieldCheck size={16} /><span>Protected administrator view. Member passwords are stored as salted hashes and cannot be viewed.</span></div>
    {error && <p role="alert" className="admin-alert error-alert">{error}</p>}
    {loading ? <div className="admin-loading-inline">Loading member accounts…</div> : members.length ? <div className="member-admin-table-wrap"><table className="member-admin-table"><thead><tr><th>Member</th><th>Email</th><th>Joined</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><td>{member.displayName}</td><td><a href={`mailto:${member.email}`}>{member.email}</a></td><td>{dateLabel(member.createdAt)}</td><td>{dateLabel(member.lastSignedIn)}</td><td><span className={`member-status ${member.isActive ? "active" : "inactive"}`}>{member.isActive ? "Active" : "Disabled"}</span></td></tr>)}</tbody></table></div> : !error && <div className="admin-empty"><span className="admin-empty-symbol"><Users size={19} /></span><h2>No member accounts yet</h2><p>When visitors create accounts, their basic details will appear here.</p></div>}
  </section>;
}
