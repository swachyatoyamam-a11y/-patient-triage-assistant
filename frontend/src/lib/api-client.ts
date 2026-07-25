/**
 * Thin fetch wrapper for the backend REST API (see backend/README.md for
 * the full route table). Handles the auth header and unwraps the
 * `{ error: { message } }` shape the backend's error handler always uses.
 *
 * Auth note: Clerk is the long-term plan, but it needs real API keys this
 * environment doesn't have. Until then, this client authenticates directly
 * against the backend's own JWT endpoints (`/api/auth/login` etc.) and
 * keeps the token in a plain (non-httpOnly) cookie so `middleware.ts` can
 * read it too. This is an explicit, temporary trade-off: a real deployment
 * MUST issue this cookie httpOnly from the server instead of writing it
 * from client JS, or it's readable by any script on the page (XSS risk).
 * Swapping to Clerk later replaces `getToken`/`setToken` here and the
 * verification in `middleware.ts` — nothing in the dashboards themselves
 * needs to change, since they only ever call `apiFetch`.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
const TOKEN_COOKIE = "triage_token";

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function setToken(token: string) {
  // 8h expiry to match the backend's default JWT_EXPIRES_IN.
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${8 * 60 * 60}; SameSite=Lax`;
}

export function clearToken() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
}

export class ApiClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiClientError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
