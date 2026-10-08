export type ShareableJob = {
  id: number;
  title: string;
  companyName?: string | null;
  shareImageUrl?: string | null;
};

export type SocialDestination = {
  id: "whatsapp" | "facebook" | "x" | "linkedin" | "telegram";
  label: string;
  href: string;
};

export function createJobShareInfo(job: ShareableJob, currentOrigin: string, canonicalHref?: string | null) {
  let origin = currentOrigin;
  try { if (canonicalHref) origin = new URL(canonicalHref).origin; } catch { /* Use the active browser origin. */ }
  const shareUrl = new URL(`/jobs/${job.id}`, origin);
  try {
    const image = job.shareImageUrl ? new URL(job.shareImageUrl, origin) : null;
    const version = image?.pathname === `/og/jobs/${job.id}.jpg` ? image.searchParams.get("v") : null;
    if (version && /^\d+$/.test(version)) shareUrl.searchParams.set("share", version);
  } catch { /* Share the stable job path if no card version is available. */ }

  const url = shareUrl.href;
  const text = `${job.title}${job.companyName ? ` — ${job.companyName}` : ""}`;
  const whatsapp = new URL("https://wa.me/");
  whatsapp.searchParams.set("text", `${text}\n${url}`);
  const facebook = new URL("https://www.facebook.com/sharer/sharer.php");
  facebook.searchParams.set("u", url);
  const x = new URL("https://twitter.com/intent/tweet");
  x.searchParams.set("text", text);
  x.searchParams.set("url", url);
  const linkedin = new URL("https://www.linkedin.com/sharing/share-offsite/");
  linkedin.searchParams.set("url", url);
  const telegram = new URL("https://t.me/share/url");
  telegram.searchParams.set("url", url);
  telegram.searchParams.set("text", text);

  const destinations: SocialDestination[] = [
    { id: "whatsapp", label: "WhatsApp", href: whatsapp.href },
    { id: "facebook", label: "Facebook", href: facebook.href },
    { id: "x", label: "X", href: x.href },
    { id: "linkedin", label: "LinkedIn", href: linkedin.href },
    { id: "telegram", label: "Telegram", href: telegram.href },
  ];
  return { url, text, title: `${text} | Get Mchongo`, destinations };
}
