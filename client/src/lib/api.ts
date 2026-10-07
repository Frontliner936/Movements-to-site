export type Company = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
};

export type Job = {
  id: number;
  title: string;
  companyId: number | null;
  companyName: string | null;
  companyDescription: string | null;
  companyLogoUrl: string | null;
  companyHref: string | null;
  category: string | null;
  location: string | null;
  deadline: string | null;
  description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  howToApply: string | null;
  applicationUrl: string | null;
  imageUrl: string | null;
  sourceUrl?: string | null;
  status?: "draft" | "published";
  likeCount: number;
  saveCount: number;
  liked: boolean;
  saved: boolean;
  createdAt?: string;
  publishedAt?: string | null;
};

export function getVisitorKey() {
  const key = "gm-visitor-key";
  try {
    let value = localStorage.getItem(key);
    if (!value) {
      value = globalThis.crypto?.randomUUID?.() ?? `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "ApiError"; }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-visitor-key", getVisitorKey());
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  let data: any = null;
  try { data = await response.json(); } catch { /* empty */ }
  if (!response.ok) throw new ApiError(typeof data?.error === "string" ? data.error : "The request could not be completed.", response.status);
  return data as T;
}

export const jsonBody = (value: unknown) => JSON.stringify(value);
