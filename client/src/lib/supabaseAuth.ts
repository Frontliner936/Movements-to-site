type SupabaseUser = {
  id?: string;
  email?: string;
  email_confirmed_at?: string | null;
};

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: SupabaseUser;
  msg?: string;
  message?: string;
  error_description?: string;
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const SESSION_KEY = "gm-supabase-session";
let pendingRefresh: Promise<string | null> | null = null;

function config() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the deployment environment."
    );
  }
  return { url, publishableKey };
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (
      typeof session.accessToken !== "string" ||
      typeof session.refreshToken !== "string" ||
      !Number.isFinite(session.expiresAt)
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeSession(response: AuthResponse) {
  if (!response.access_token || !response.refresh_token) return false;
  const expiresIn = Number.isFinite(response.expires_in)
    ? Math.max(1, response.expires_in!)
    : 3600;
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    } satisfies StoredSession)
  );
  return true;
}

async function authRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string } = {}
): Promise<T> {
  const { url, publishableKey } = config();
  const headers = new Headers({
    apikey: publishableKey,
    accept: "application/json",
  });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.accessToken) {
    headers.set("authorization", `Bearer ${options.accessToken}`);
  }
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let payload: T & AuthResponse = {} as T & AuthResponse;
  try {
    payload = (await response.json()) as T & AuthResponse;
  } catch {
    // Successful logout responses may have no body.
  }
  if (!response.ok) {
    throw new Error(
      payload.msg ??
        payload.message ??
        payload.error_description ??
        "Supabase Auth request failed."
    );
  }
  return payload;
}

export async function signInWithPassword(email: string, password: string) {
  const response = await authRequest<AuthResponse>("token?grant_type=password", {
    method: "POST",
    body: { email: email.trim().toLowerCase(), password },
  });
  if (!writeSession(response) || !response.user) {
    throw new Error("Supabase did not return a sign-in session.");
  }
  return response.user;
}

export async function signUpWithPassword(email: string, password: string) {
  const response = await authRequest<AuthResponse>("signup", {
    method: "POST",
    body: { email: email.trim().toLowerCase(), password },
  });
  const authenticated = writeSession(response);
  return { user: response.user ?? null, authenticated };
}

async function refreshAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;
  try {
    const response = await authRequest<AuthResponse>(
      "token?grant_type=refresh_token",
      {
        method: "POST",
        body: { refresh_token: session.refreshToken },
      }
    );
    if (!writeSession(response)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return response.access_token ?? null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const session = readSession();
  if (!session) return null;
  if (session.expiresAt > Math.floor(Date.now() / 1000) + 30) {
    return session.accessToken;
  }
  if (!pendingRefresh) {
    pendingRefresh = refreshAccessToken().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

export async function getCurrentSupabaseUser() {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) return null;
  try {
    return await authRequest<SupabaseUser>("user", { accessToken });
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function signOutFromSupabase() {
  const accessToken = await getSupabaseAccessToken();
  try {
    if (accessToken) {
      await authRequest<AuthResponse>("logout", {
        method: "POST",
        accessToken,
      });
    }
  } catch {
    // Clear the local session even when Supabase is temporarily unavailable.
  } finally {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
