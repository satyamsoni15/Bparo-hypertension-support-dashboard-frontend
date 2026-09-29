// Shared plumbing for server actions. Server-side only; not itself a
// "use server" module, so it can export types and helpers.
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { supportFetch, SupportApiError } from "@/lib/api";
import type { Result, SupportRole } from "@/lib/types";

export const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

export function fail(err: unknown): { ok: false; error: string; status: number } {
  if (err instanceof SupportApiError) return { ok: false, error: err.message, status: err.status };
  return { ok: false, error: "Unable to reach the support server.", status: 0 };
}

export function invalid(message: string): { ok: false; error: string; status: number } {
  return { ok: false, error: message, status: 400 };
}

// Every server action re-checks the session (and role, when given): actions
// are reachable by direct POST, not only through the UI.
export async function withSession<T>(
  fn: (call: <R>(path: string, init?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }) => Promise<R>, session: Session) => Promise<T>,
  options: { role?: SupportRole } = {},
): Promise<Result<T>> {
  const session = await auth();
  if (!session || session.error) return { ok: false, error: SESSION_EXPIRED, status: 401 };
  if (options.role && session.user.role !== options.role) {
    return { ok: false, error: "You don't have access to this.", status: 403 };
  }
  const call = <R,>(path: string, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}) =>
    supportFetch<R>(path, { ...init, token: session.accessToken });
  try {
    return { ok: true, data: await fn(call, session) };
  } catch (err) {
    return fail(err);
  }
}

export const ID_RE = /^[1-9]\d{0,18}$/;

export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
