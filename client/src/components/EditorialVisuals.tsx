export function EmptyBoardIllustration() {
  return (
    <svg className="empty-board-drawing" viewBox="0 0 320 176" aria-hidden="true" focusable="false">
      <ellipse cx="160" cy="154" rx="116" ry="10" fill="#dce8db" />
      <circle cx="250" cy="39" r="15" fill="#f2c96d" opacity=".9" />
      <circle cx="250" cy="39" r="28" fill="none" stroke="#d6b96e" strokeOpacity=".4" />
      <path d="M36 145c43 0 58-15 81-45 18-24 39-38 75-39" fill="none" stroke="#12664f" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 8" />
      <circle cx="37" cy="145" r="5" fill="#12664f" />
      <circle cx="111" cy="108" r="4" fill="#f2c96d" />
      <path d="M134 144V69c0-22 14-38 34-38s34 16 34 38v75" fill="#eaf2e8" stroke="#9eb7a3" strokeWidth="2" />
      <path d="M143 144V75c0-18 11-31 25-31s25 13 25 31v69" fill="#f9f8f0" stroke="#c5d3c4" strokeWidth="1.5" />
      <path d="M169 144V74c0-11 7-19 15-20" fill="none" stroke="#12664f" strokeWidth="2" strokeLinecap="round" />
      <circle cx="179" cy="92" r="2.5" fill="#d09a36" />
      <rect x="219" y="91" width="66" height="43" rx="10" fill="#fffefa" stroke="#e3e8de" />
      <circle cx="236" cy="108" r="6" fill="#e8f1e8" />
      <path d="M248 105h25M248 113h17" stroke="#9cad9f" strokeWidth="2" strokeLinecap="round" />
      <path d="m271 124 4 4 7-8" fill="none" stroke="#12664f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
