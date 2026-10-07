import type { Job } from "@/lib/api";

function addOrUpdateMeta(attribute: "name" | "property", key: string, content: string | null) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  const existed = !!element;
  const previous = element?.getAttribute("content") ?? null;
  if (!content) {
    element?.remove();
  } else {
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, key);
      document.head.append(element);
    }
    element.setAttribute("content", content);
  }
  return () => {
    if (!element) return;
    if (!existed) element.remove();
    else if (previous === null) element.removeAttribute("content");
    else { element.setAttribute("content", previous); document.head.append(element); }
  };
}

function addOrUpdateCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const existed = !!element;
  const previous = element?.getAttribute("href") ?? null;
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }
  element.href = href;
  return () => {
    if (!element) return;
    if (!existed) element.remove();
    else if (previous === null) element.removeAttribute("href");
    else { element.href = previous; document.head.append(element); }
  };
}

export function applyJobPageMetadata(job: Job) {
  const oldTitle = document.title;
  const title = `${job.title}${job.companyName ? ` — ${job.companyName}` : ""} | Get Mchongo`;
  const clean = (value?: string | null) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const description = (clean(job.description) || clean(job.responsibilities) || clean(job.qualifications) || title).slice(0, 240);
  let imageUrl: string | null = null;
  try {
    const candidate = job.imageUrl || job.companyLogoUrl;
    if (candidate) {
      const url = new URL(candidate, window.location.origin);
      if (url.protocol === "https:" && !url.username && !url.password) imageUrl = url.href;
    }
  } catch { /* Ignore invalid/unshareable image URLs. */ }
  const canonical = new URL(`/jobs/${job.id}`, window.location.origin).href;
  document.title = title;
  const restore = [
    addOrUpdateMeta("name", "description", description),
    addOrUpdateMeta("property", "og:type", "article"),
    addOrUpdateMeta("property", "og:site_name", "Get Mchongo"),
    addOrUpdateMeta("property", "og:title", title),
    addOrUpdateMeta("property", "og:description", description),
    addOrUpdateMeta("property", "og:url", canonical),
    addOrUpdateMeta("property", "og:image", imageUrl),
    addOrUpdateMeta("property", "og:image:alt", title),
    addOrUpdateMeta("name", "twitter:card", imageUrl ? "summary_large_image" : "summary"),
    addOrUpdateMeta("name", "twitter:title", title),
    addOrUpdateMeta("name", "twitter:description", description),
    addOrUpdateMeta("name", "twitter:image", imageUrl),
    addOrUpdateMeta("name", "twitter:image:alt", title),
    addOrUpdateCanonical(canonical),
  ];
  return () => { restore.reverse().forEach(restoreTag => restoreTag()); document.title = oldTitle; };
}
