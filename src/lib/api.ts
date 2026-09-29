// Thin client for the support backend (Bparo-hypertension-support-dashboard-backend).
// Server-side only: never import this from a "use client" component. It reads
// SUPPORT_API_URL, which is not exposed to the browser.

const API_URL = process.env.SUPPORT_API_URL ?? "http://localhost:4300/api/v1";

export class SupportApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SupportApiError";
    this.status = status;
  }
}

// Nest errors come back as `{ message, error, statusCode }`; a global filter may
// wrap `message` one level deeper, and class-validator gives an array.
function extractMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("message" in body)) return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(" ");
  if (message && typeof message === "object") return extractMessage(message, fallback);
  return fallback;
}

export async function supportFetch<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; token?: string; body?: unknown } = {},
): Promise<T> {
  const { method = "GET", token, body } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
  } catch {
    throw new SupportApiError("Unable to reach the support server. Please try again.", 0);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const fallback =
      res.status === 401
        ? "Your session has expired. Please sign in again."
        : res.status === 403
          ? "You don't have access to this."
          : res.status === 404
            ? "Not found."
            : "Something went wrong. Please try again.";
    throw new SupportApiError(extractMessage(json, fallback), res.status);
  }
  return json as T;
}
