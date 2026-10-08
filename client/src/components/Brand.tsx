import { Link } from "wouter";

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? "brand-mark brand-mark-small" : "brand-mark"} viewBox="0 0 44 44" role="img" aria-label="Get Mchongo mark">
      <rect x="3" y="3" width="38" height="38" rx="12" fill="currentColor" />
      <path d="M10 28.5 16.8 16l6.1 10.5L28.7 16 35 28.5" fill="none" stroke="#fffdf7" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27.8 11.2h7.8v7.8" fill="none" stroke="#f4c96b" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35.5 11.5 27 20" fill="none" stroke="#f4c96b" strokeWidth="2.7" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`brand${light ? " brand-light" : ""}`} aria-label="Get Mchongo home">
      <BrandMark />
      <span className="brand-wordmark">Get <strong>Mchongo</strong></span>
    </Link>
  );
}
