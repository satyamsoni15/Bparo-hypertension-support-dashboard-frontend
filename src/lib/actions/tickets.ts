"use server";

import { ID_RE, invalid, qs, withSession } from "@/lib/session";
import { toDashboard, toList, toPage, toTicketDetail, toTicketSummary } from "@/lib/normalize";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type DashboardData,
  type Paginated,
  type PatientOverview,
  type Result,
  type SupportUserSummary,
  type TicketDetail,
  type TicketFilters,
  type TicketSummary,
  type TicketUpdate,
} from "@/lib/types";

const MAX_BODY = 5000;
const STATUS_FILTER_RE = /^(active|open|in_progress|waiting_on_patient|escalated|resolved|closed)(,(open|in_progress|waiting_on_patient|escalated|resolved|closed))*$/;

function filterParams(filters: TicketFilters) {
  return {
    status: filters.status && STATUS_FILTER_RE.test(filters.status) ? filters.status : undefined,
    priority: filters.priority,
    category: filters.category,
    source: filters.source,
    assignee: filters.assignee && /^(me|unassigned|[1-9]\d*)$/.test(filters.assignee) ? filters.assignee : undefined,
    clinicId: filters.clinicId && ID_RE.test(filters.clinicId) ? filters.clinicId : undefined,
    overdue: filters.overdue,
    search: filters.search?.trim().slice(0, 200),
    sort: filters.sort,
  };
}

export async function getDashboard(): Promise<Result<DashboardData>> {
  return withSession(async (call) => toDashboard(await call("/dashboard")));
}

export async function listTickets(
  filters: TicketFilters,
  page: number,
  limit = 15,
): Promise<Result<Paginated<TicketSummary>>> {
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 15, 1), 100);
  return withSession(async (call) =>
    toPage(await call(`/tickets${qs({ ...filterParams(filters), page: safePage, limit: safeLimit })}`), toTicketSummary),
  );
}

export async function getTicket(id: string): Promise<Result<TicketDetail>> {
  if (!ID_RE.test(id)) return invalid("Invalid ticket.");
  return withSession(async (call) => toTicketDetail(await call(`/tickets/${id}`)));
}

export async function updateTicket(id: string, input: TicketUpdate): Promise<Result<TicketDetail>> {
  if (!ID_RE.test(id)) return invalid("Invalid ticket.");
  const body: TicketUpdate = {};
  if (input.status !== undefined) {
    if (!TICKET_STATUSES.includes(input.status)) return invalid("Invalid status.");
    body.status = input.status;
  }
  if (input.priority !== undefined) {
    if (!TICKET_PRIORITIES.includes(input.priority)) return invalid("Invalid priority.");
    body.priority = input.priority;
  }
  if (input.category !== undefined) {
    if (!TICKET_CATEGORIES.includes(input.category)) return invalid("Invalid category.");
    body.category = input.category;
  }
  if (input.assigneeId !== undefined) {
    if (input.assigneeId !== null && !ID_RE.test(String(input.assigneeId))) return invalid("Invalid assignee.");
    body.assigneeId = input.assigneeId === null ? null : Number(input.assigneeId);
  }
  if (input.clinicId !== undefined) {
    if (input.clinicId !== null && !ID_RE.test(String(input.clinicId))) return invalid("Invalid clinic.");
    body.clinicId = input.clinicId === null ? null : Number(input.clinicId);
  }
  if (input.resolutionSummary !== undefined) {
    const summary = input.resolutionSummary?.trim() ?? "";
    if (summary.length > MAX_BODY) return invalid("The resolution summary is too long.");
    body.resolutionSummary = summary || null;
  }
  if (body.status === "resolved" && !body.resolutionSummary) {
    return invalid("A resolution summary is required to resolve a ticket.");
  }
  if (input.note?.trim()) body.note = input.note.trim().slice(0, 1000);
  if (Object.keys(body).length === 0) return invalid("Nothing to update.");
  return withSession(async (call) => toTicketDetail(await call(`/tickets/${id}`, { method: "PATCH", body })));
}

export async function addMessage(
  id: string,
  input: { body: string; isInternal: boolean },
): Promise<Result<TicketDetail>> {
  if (!ID_RE.test(id)) return invalid("Invalid ticket.");
  const text = input.body.trim();
  if (!text) return invalid("A message is required.");
  if (text.length > MAX_BODY) return invalid("The message is too long.");
  return withSession(async (call) =>
    toTicketDetail(
      await call(`/tickets/${id}/messages`, { method: "POST", body: { body: text, isInternal: input.isInternal === true } }),
    ),
  );
}

export async function escalateTicket(id: string, reason: string): Promise<Result<TicketDetail>> {
  if (!ID_RE.test(id)) return invalid("Invalid ticket.");
  const trimmed = reason.trim().slice(0, 1000);
  return withSession(async (call) =>
    toTicketDetail(await call(`/tickets/${id}/escalate`, { method: "POST", body: trimmed ? { reason: trimmed } : {} })),
  );
}

export async function assignToMe(id: string): Promise<Result<TicketDetail>> {
  if (!ID_RE.test(id)) return invalid("Invalid ticket.");
  return withSession(async (call) => toTicketDetail(await call(`/tickets/${id}/assign-to-me`, { method: "POST" })));
}

export async function getPatientOverview(id: string): Promise<Result<PatientOverview>> {
  if (!ID_RE.test(id)) return invalid("Invalid ticket.");
  return withSession(async (call) => call<PatientOverview>(`/tickets/${id}/patient-overview`));
}

export async function getAttachmentUrl(id: string, key: string): Promise<Result<string>> {
  if (!ID_RE.test(id)) return invalid("Invalid ticket.");
  if (!key || key.length > 500 || key.includes("..")) return invalid("Invalid attachment.");
  return withSession(async (call) => {
    const res = await call<{ url?: string } | string>(`/tickets/${id}/attachment-url${qs({ key })}`);
    const url = typeof res === "string" ? res : res?.url;
    if (!url || !/^https?:\/\//.test(url)) throw new Error("No download link was returned.");
    return url;
  });
}

export async function listAssignable(clinicId: string | null): Promise<Result<SupportUserSummary[]>> {
  if (clinicId !== null && !ID_RE.test(clinicId)) return invalid("Invalid clinic.");
  return withSession(async (call) =>
    toList(await call(`/support-users/assignable${qs({ clinicId })}`), (row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      return {
        id: (r.id as string | number) ?? "",
        name: typeof r.name === "string" ? r.name : null,
        email: typeof r.email === "string" ? r.email : null,
        role: r.role === "support_admin" || r.role === "clinic_agent" ? r.role : undefined,
      };
    }),
  );
}
