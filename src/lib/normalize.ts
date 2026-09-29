// Maps raw support-API rows onto the UI types in ./types.
//
// The contract (docs/ARCHITECTURE.md in the backend repo) fixes the columns but
// not every response key, so these accept both the nested form
// (`requester: { name }`) and the flat snapshot columns (`requesterName`). Pure
// and server-safe.
import type {
  ClinicRef,
  DashboardData,
  Id,
  Paginated,
  PaginationMeta,
  Person,
  RefKey,
  SupportUserSummary,
  TicketDetail,
  TicketEvent,
  TicketMessage,
  TicketSummary,
} from "./types";

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" || typeof v === "bigint" ? String(v) : null);
const id = (v: unknown): Id | null => (typeof v === "number" || typeof v === "string" ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const bool = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";

function person(raw: Raw, key: "requester" | "patient"): Person | null {
  const nested = raw[key];
  if (isObj(nested)) {
    return {
      bparoUserId: id(nested.bparoUserId ?? nested.id),
      name: str(nested.name),
      email: str(nested.email),
      role: str(nested.role),
    };
  }
  const bparoUserId = id(raw[`${key}BparoUserId`]);
  const name = str(raw[`${key}Name`]);
  const email = str(raw[`${key}Email`]);
  if (bparoUserId === null && !name && !email) return null;
  return { bparoUserId, name, email, role: str(raw[`${key}Role`]) };
}

function clinic(raw: Raw): ClinicRef | null {
  if (isObj(raw.clinic)) {
    const cid = id(raw.clinic.id);
    return cid === null ? null : { id: cid, name: str(raw.clinic.name) ?? `Clinic #${cid}` };
  }
  const cid = id(raw.clinicId);
  if (cid === null) return null;
  return { id: cid, name: str(raw.clinicName) ?? `Clinic #${cid}` };
}

function assignee(raw: Raw): SupportUserSummary | null {
  if (isObj(raw.assignee)) {
    const aid = id(raw.assignee.id);
    return aid === null ? null : { id: aid, name: str(raw.assignee.name), email: str(raw.assignee.email) };
  }
  const aid = id(raw.assigneeId);
  return aid === null ? null : { id: aid, name: str(raw.assigneeName), email: null };
}

const REF_KEYS: RefKey[] = ["appointmentId", "paymentId", "pharmacyOrderId", "homeTestBookingId", "ahsClaimId"];

function refs(raw: Raw): Partial<Record<RefKey, Id | null>> {
  const source = isObj(raw.refs) ? raw.refs : raw;
  const out: Partial<Record<RefKey, Id | null>> = {};
  for (const key of REF_KEYS) {
    const value = id(source[key]);
    if (value !== null) out[key] = value;
  }
  return out;
}

const ACTIVE = new Set(["open", "in_progress", "waiting_on_patient", "escalated"]);

export function toTicketSummary(value: unknown): TicketSummary {
  const raw = isObj(value) ? value : {};
  const status = str(raw.status) ?? "open";
  const dueAt = str(raw.dueAt);
  const overdue =
    typeof raw.overdue === "boolean"
      ? raw.overdue
      : !!dueAt && ACTIVE.has(status) && new Date(dueAt).getTime() < Date.now();
  return {
    id: id(raw.id) ?? "",
    number: str(raw.number) ?? `#${str(raw.id) ?? ""}`,
    subject: str(raw.subject) ?? "(no subject)",
    category: str(raw.category) ?? "other",
    priority: str(raw.priority) ?? "normal",
    status,
    source: str(raw.source) ?? "patient",
    isConfidential: bool(raw.isConfidential),
    requester: person(raw, "requester"),
    patient: person(raw, "patient"),
    clinic: clinic(raw),
    assignee: assignee(raw),
    refs: refs(raw),
    dueAt,
    overdue,
    firstResponseAt: str(raw.firstResponseAt),
    escalatedAt: str(raw.escalatedAt),
    resolvedAt: str(raw.resolvedAt),
    closedAt: str(raw.closedAt),
    createdAt: str(raw.createdAt) ?? "",
    updatedAt: str(raw.updatedAt),
  };
}

function attachments(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((a): a is string => typeof a === "string") : [];
}

function authorName(raw: Raw, prefix: "author" | "actor"): string | null {
  const nested = raw[prefix];
  if (isObj(nested)) return str(nested.name);
  return str(raw[`${prefix}Name`]);
}

function message(value: unknown): TicketMessage {
  const raw = isObj(value) ? value : {};
  return {
    id: id(raw.id) ?? "",
    body: str(raw.body) ?? "",
    isInternal: bool(raw.isInternal),
    attachments: attachments(raw.attachments),
    authorType: str(raw.authorType) ?? "system",
    authorName: authorName(raw, "author"),
    createdAt: str(raw.createdAt) ?? "",
  };
}

function event(value: unknown): TicketEvent {
  const raw = isObj(value) ? value : {};
  return {
    id: id(raw.id) ?? "",
    type: str(raw.type) ?? "",
    from: str(raw.from),
    to: str(raw.to),
    note: str(raw.note),
    actorType: str(raw.actorType),
    actorName: authorName(raw, "actor"),
    createdAt: str(raw.createdAt) ?? "",
  };
}

export function toTicketDetail(value: unknown): TicketDetail {
  const raw = isObj(value) ? value : {};
  const carebot = isObj(raw.carebot)
    ? {
        lastBotReply: str(raw.carebot.lastBotReply),
        transcriptShared: bool(raw.carebot.transcriptShared) || !!str(raw.carebot.transcript),
        transcript: str(raw.carebot.transcript),
      }
    : str(raw.carebotLastReply) || str(raw.carebotTranscript)
      ? {
          lastBotReply: str(raw.carebotLastReply),
          transcriptShared: !!str(raw.carebotTranscript),
          transcript: str(raw.carebotTranscript),
        }
      : null;
  return {
    ...toTicketSummary(raw),
    description: str(raw.description) ?? "",
    resolutionSummary: str(raw.resolutionSummary),
    carebot,
    messages: Array.isArray(raw.messages) ? raw.messages.map(message) : [],
    history: Array.isArray(raw.history) ? raw.history.map(event) : Array.isArray(raw.events) ? raw.events.map(event) : [],
  };
}

export function toMeta(value: unknown, fallbackCount: number): PaginationMeta {
  const raw = isObj(value) ? value : {};
  const page = num(raw.page) || 1;
  const limit = num(raw.limit) || Math.max(fallbackCount, 1);
  const total = num(raw.total) || (raw.total === undefined ? fallbackCount : 0);
  const totalPages = num(raw.totalPages) || Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: typeof raw.hasNextPage === "boolean" ? raw.hasNextPage : page < totalPages,
    hasPrevPage: typeof raw.hasPrevPage === "boolean" ? raw.hasPrevPage : page > 1,
  };
}

// Accepts `{ data, meta }` or a bare array.
export function toPage<T>(value: unknown, map: (row: unknown) => T): Paginated<T> {
  if (Array.isArray(value)) return { data: value.map(map), meta: toMeta(undefined, value.length) };
  const raw = isObj(value) ? value : {};
  const rows = Array.isArray(raw.data) ? raw.data : [];
  return { data: rows.map(map), meta: toMeta(raw.meta, rows.length) };
}

// Accepts a bare array or `{ data: [...] }`.
export function toList<T>(value: unknown, map: (row: unknown) => T): T[] {
  if (Array.isArray(value)) return value.map(map);
  if (isObj(value) && Array.isArray(value.data)) return value.data.map(map);
  return [];
}

function counts(v: unknown): Record<string, number> {
  if (!isObj(v)) return {};
  return Object.fromEntries(Object.entries(v).map(([k, n]) => [k, num(n)]));
}

export function toDashboard(value: unknown): DashboardData {
  const raw = isObj(value) ? value : {};
  const last7 = isObj(raw.last7Days) ? raw.last7Days : {};
  const recent = raw.recentUrgent ?? raw.recentEscalations ?? raw.recent;
  return {
    myOpen: num(raw.myOpen ?? raw.myQueue),
    unassigned: num(raw.unassigned),
    overdue: num(raw.overdue),
    byStatus: counts(raw.byStatus),
    byPriority: counts(raw.byPriority),
    createdLast7Days: num(raw.createdLast7Days ?? last7.created),
    resolvedLast7Days: num(raw.resolvedLast7Days ?? last7.resolved),
    recentUrgent: Array.isArray(recent) ? recent.map(toTicketSummary) : [],
  };
}
