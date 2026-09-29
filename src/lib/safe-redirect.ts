// Only same-origin relative paths are allowed as a post-login target
// ("/tickets?x=1" yes; "//evil.com", "https://…", "/\\evil" no).
export function safeCallbackUrl(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value === "/login" || value.startsWith("/login?")) return fallback;
  return value;
}
