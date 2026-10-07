import { Link } from "wouter";

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? "brand-mark brand-mark-small" : "brand-mark"} viewBox="0 0 44 44" role="img" aria-label="Get Mchongo mark">
      <rect x="2" y="2" width="40" height="40" rx="13" fill="currentColor" />
      <circle cx="28.5" cy="14.5" r="4.5" fill="#f4c96b" />
      <path d="M11 30.5c4.5 0 6.3-8.2 11.5-8.2 3.2 0 4.1 3.1 7.2 3.1 1.5 0 2.7-.8 3.7-1.8" fill="none" stroke="#fffdf7" strokeWidth="2.7" strokeLinecap="round" />
      <path d="m29.9 20.6 4.3.3-.9 4.1" fill="none" stroke="#fffdf7" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
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
