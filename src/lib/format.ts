// Display helpers. Every timestamp is shown in the viewer's own local time
// zone (the browser's), with the zone name so there is no ambiguity.

export function initials(name: string | null | undefined, fallback = "?"): string {
  const letters = (name ?? "")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || fallback;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// "in 3h", "5d ago" — for SLA due dates.
export function formatRelative(value: string | null | undefined, now: number = Date.now()): string {
  const date = toDate(value);
  if (!date) return "—";
  const diffMs = date.getTime() - now;
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const text = minutes < 60 ? `${minutes}m` : hours < 48 ? `${hours}h` : `${days}d`;
  return diffMs >= 0 ? `in ${text}` : `${text} ago`;
}

export function label(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/[_-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function hours(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)} h` : "—";
}
