import { useEffect, useMemo, useState } from "react";
import { Download, Search, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";

type MemberRow = { id: number; displayName: string; email: string; isActive: boolean; createdAt: string; lastSignedIn: string | null };
type TalentProfile = { memberId: number; fullName: string; phoneNumber: string; location: string; profession: string; cvFileName: string | null; email: string; updatedAt: string };
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString() : "Never";

export default function AdminMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<TalentProfile[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ members: MemberRow[] }>("/api/gm/admin/members"),
      api<{ profiles: TalentProfile[] }>("/api/gm/admin/members/directory"),
    ]).then(([memberResult, profileResult]) => {
      if (!active) return;
      setMembers(memberResult.members);
      setProfiles(profileResult.profiles);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Member list could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleProfiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return profiles;
    return profiles.filter(profile => [profile.fullName, profile.profession, profile.location, profile.email, profile.phoneNumber].some(value => value.toLowerCase().includes(normalized)));
  }, [profiles, query]);

  return <section className="admin-section">
    <div className="admin-page-title"><div><span className="eyebrow muted-eyebrow">JOB SEEKER ACCOUNTS</span><h1>Members</h1><p>Account details and a separate, opt-in professional directory.</p></div><span className="member-admin-total"><Users size={18} />{members.length} accounts</span></div>
    <div className="member-admin-privacy"><ShieldCheck size={16} /><span>Only you, as administrator, can view profiles members explicitly share. Non-opted-in profile details and CVs stay hidden. Recruiters and the public have no directory access.</span></div>
    {error && <p role="alert" className="admin-alert error-alert">{error}</p>}
    {loading ? <div className="admin-loading-inline">Loading member accounts…</div> : <>
      <div className="member-directory-heading"><div><span className="eyebrow muted-eyebrow">PRIVATE TALENT DIRECTORY</span><h2>Shared professional profiles</h2><p>{profiles.length} members have chosen to share their profile with you.</p></div><label className="member-directory-search"><Search size={16} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search profession, name or location" aria-label="Search shared professional profiles" /></label></div>
      {visibleProfiles.length ? <div className="member-admin-table-wrap"><table className="member-admin-table"><thead><tr><th>Professional</th><th>Profession</th><th>Location</th><th>Phone</th><th>Email</th><th>CV</th></tr></thead><tbody>{visibleProfiles.map(profile => <tr key={profile.memberId}><td>{profile.fullName}</td><td>{profile.profession}</td><td>{profile.location}</td><td><a href={`tel:${profile.phoneNumber}`}>{profile.phoneNumber}</a></td><td><a href={`mailto:${profile.email}`}>{profile.email}</a></td><td>{profile.cvFileName ? <a className="member-cv-download" href={`/api/gm/admin/members/${profile.memberId}/profile-cv`}><Download size={14} />Download</a> : "Not provided"}</td></tr>)}</tbody></table></div> : <div className="admin-empty"><span className="admin-empty-symbol"><Users size={19} /></span><h2>{profiles.length ? "No profiles match this search" : "No shared profiles yet"}</h2><p>{profiles.length ? "Try another name, profession, phone number or location." : "Members can choose to share their professional profile from their private dashboard."}</p></div>}

      <div className="member-directory-heading member-account-heading"><div><span className="eyebrow muted-eyebrow">ACCOUNT OVERVIEW</span><h2>Registered members</h2></div></div>
      {members.length ? <div className="member-admin-table-wrap"><table className="member-admin-table"><thead><tr><th>Member</th><th>Email</th><th>Joined</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><td>{member.displayName}</td><td><a href={`mailto:${member.email}`}>{member.email}</a></td><td>{dateLabel(member.createdAt)}</td><td>{dateLabel(member.lastSignedIn)}</td><td><span className={`member-status ${member.isActive ? "active" : "inactive"}`}>{member.isActive ? "Active" : "Disabled"}</span></td></tr>)}</tbody></table></div> : !error && <div className="admin-empty"><span className="admin-empty-symbol"><Users size={19} /></span><h2>No member accounts yet</h2><p>When visitors create accounts, their basic details will appear here.</p></div>}
    </>}
  </section>;
}
