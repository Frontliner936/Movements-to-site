import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowUpRight, Globe2, MapPin } from "lucide-react";
import { Brand } from "@/components/Brand";
import { CompanyLogo, JobCard } from "@/components/JobCard";
import { SiteFooter } from "@/components/SiteFooter";
import { api, type Company, type Job } from "@/lib/api";

export default function CompanyProfile() {
  const [, params] = useRoute("/companies/:id");
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    if (params?.id) api<{ company: Company; jobs: Job[] }>(`/api/gm/companies/${encodeURIComponent(params.id)}`)
      .then(data => { if (alive) { setCompany(data.company); setJobs(data.jobs); } })
      .catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : "Company profile could not be found."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params?.id, refresh]);
  return <div className="site-shell"><header className="site-header"><div className="header-inner"><Brand /><a href="/admin/login" className="header-admin-link">Admin <ArrowUpRight size={14} /></a></div></header><main className="company-page"><Link href="/" className="back-link"><ArrowLeft size={15} /> All opportunities</Link>{loading ? <div className="loading-state"><span className="loading-dot" />Loading company profile…</div> : error || !company ? <div className="empty-opportunities"><h2>Company profile not found.</h2><p>{error || "This profile is not available."}</p></div> : <><section className="company-profile-heading"><CompanyLogo name={company.name} imageUrl={company.logoUrl} size="large" /><div><span className="eyebrow muted-eyebrow">COMPANY PROFILE</span><h1>{company.name}</h1><div className="detail-meta">{company.location && <span><MapPin size={15} />{company.location}</span>}{company.websiteUrl && <a href={company.websiteUrl} target="_blank" rel="noreferrer"><Globe2 size={15} />Official website <ArrowUpRight size={13} /></a>}</div></div></section>{company.description && <section className="company-description"><span className="eyebrow muted-eyebrow">ABOUT</span><p>{company.description}</p></section>}<section className="company-jobs"><div className="section-heading-row"><div><span className="eyebrow muted-eyebrow">OPEN OPPORTUNITIES</span><h2>Work with {company.name.split(" ")[0]}<span className="heading-period">.</span></h2></div><span className="company-jobs-count">{jobs.length} {jobs.length === 1 ? "listing" : "listings"}</span></div>{jobs.length ? <div className="jobs-feed">{jobs.map(job => <JobCard key={job.id} job={job} onChanged={() => setRefresh(value => value + 1)} />)}</div> : <div className="empty-opportunities company-empty"><h3>No published roles right now.</h3><p>When this organisation shares an opportunity, it will appear here.</p></div>}</section></>}</main><SiteFooter /></div>;
}
