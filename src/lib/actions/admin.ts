"use server";

import { ID_RE, invalid, qs, withSession } from "@/lib/session";
import { toList } from "@/lib/normalize";
import {
  SUPPORT_ROLES,
  type AdminClinic,
  type AdminUser,
  type AgentReportRow,
  type CategoryReportRow,
  type ClinicRef,
  type ClinicReportRow,
  type ReportsData,
  type Result,
  type SupportRole,
} from "@/lib/types";

const ADMIN = { role: "support_admin" as const };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Raw = Record<string, unknown>;
const asObj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});

function clinicsOf(v: unknown): ClinicRef[] {
  if (!Array.isArray(v)) return [];
  return v.map((c) => {
    const r = asObj(c);
    // Accept `{ id, name }` or a join row `{ clinic: { id, name } }`.
    const inner = r.clinic ? asObj(r.clinic) : r;
    const id = inner.id as string | number;
    return { id, name: typeof inner.name === "string" ? inner.name : `Clinic #${id}` };
  });
}

function toAdminUser(row: unknown): AdminUser {
  const r = asObj(row);
  return {
    id: r.id as string | number,
    name: typeof r.name === "string" ? r.name : null,
    email: String(r.email ?? ""),
    role: r.role === "support_admin" ? "support_admin" : "clinic_agent",
    isActive: r.isActive === true || r.isActive === 1,
    lastLoginAt: typeof r.lastLoginAt === "string" ? r.lastLoginAt : null,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : null,
    clinics: clinicsOf(r.clinics ?? r.agentClinics),
  };
}

function toAdminClinic(row: unknown): AdminClinic {
  const r = asObj(row);
  const count = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return {
    id: r.id as string | number,
    name: typeof r.name === "string" ? r.name : `Clinic #${r.id}`,
    isActive: r.isActive === undefined ? true : r.isActive === true || r.isActive === 1,
    syncedAt: typeof r.syncedAt === "string" ? r.syncedAt : null,
    agentCount: count(r.agentCount),
    openTicketCount: count(r.openTicketCount),
  };
}

function validClinicIds(ids: string[]): number[] | null {
  const out: number[] = [];
  for (const raw of ids) {
    if (!ID_RE.test(raw)) return null;
    out.push(Number(raw));
  }
  return [...new Set(out)];
}

function checkPassword(password: string): string | null {
  if (password.length < 8) return "The password must be at least 8 characters.";
  if (password.length > 128) return "The password is too long.";
  return null;
}

export async function listUsers(): Promise<Result<AdminUser[]>> {
  return withSession(async (call) => toList(await call(`/admin/users${qs({ limit: 100 })}`), toAdminUser), ADMIN);
}

export async function createUser(input: {
  name: string;
  email: string;
  role: SupportRole;
  password: string;
  clinicIds: string[];
}): Promise<Result<AdminUser>> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 120) return invalid("Enter a name (up to 120 characters).");
  if (!EMAIL_RE.test(email)) return invalid("Enter a valid email.");
  if (!SUPPORT_ROLES.includes(input.role)) return invalid("Pick a role.");
  const passwordError = checkPassword(input.password);
  if (passwordError) return invalid(passwordError);
  const clinicIds = validClinicIds(input.clinicIds);
  if (!clinicIds) return invalid("Invalid clinic selection.");
  if (input.role === "clinic_agent" && clinicIds.length === 0) {
    return invalid("A clinic agent needs at least one clinic.");
  }
  return withSession(
    async (call) =>
      toAdminUser(
        await call("/admin/users", {
          method: "POST",
          body: { name, email, role: input.role, password: input.password, clinicIds },
        }),
      ),
    ADMIN,
  );
}

export async function updateUser(
  id: string,
  input: { name?: string; role?: SupportRole; isActive?: boolean; clinicIds?: string[] },
): Promise<Result<AdminUser>> {
  if (!ID_RE.test(id)) return invalid("Invalid user.");
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 120) return invalid("Enter a name (up to 120 characters).");
    body.name = name;
  }
  if (input.role !== undefined) {
    if (!SUPPORT_ROLES.includes(input.role)) return invalid("Pick a role.");
    body.role = input.role;
  }
  if (input.isActive !== undefined) body.isActive = input.isActive === true;
  if (input.clinicIds !== undefined) {
    const clinicIds = validClinicIds(input.clinicIds);
    if (!clinicIds) return invalid("Invalid clinic selection.");
    body.clinicIds = clinicIds;
  }
  if (Object.keys(body).length === 0) return invalid("Nothing to update.");
  return withSession(async (call) => toAdminUser(await call(`/admin/users/${id}`, { method: "PATCH", body })), ADMIN);
}

export async function resetUserPassword(id: string, password: string): Promise<Result<null>> {
  if (!ID_RE.test(id)) return invalid("Invalid user.");
  const passwordError = checkPassword(password);
  if (passwordError) return invalid(passwordError);
  return withSession(async (call) => {
    await call(`/admin/users/${id}/reset-password`, { method: "POST", body: { password } });
    return null;
  }, ADMIN);
}

export async function listClinics(): Promise<Result<AdminClinic[]>> {
  return withSession(async (call) => toList(await call("/admin/clinics"), toAdminClinic), ADMIN);
}

export async function syncClinics(): Promise<Result<Record<string, unknown>>> {
  return withSession(async (call) => asObj(await call("/admin/clinics/sync", { method: "POST" })), ADMIN);
}

export async function getReports(from: string, to: string): Promise<Result<ReportsData>> {
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) return invalid("Invalid date range.");
  if (from && to && from > to) return invalid("The start date must be on or before the end date.");
  return withSession(async (call) => {
    const raw = asObj(await call(`/admin/reports${qs({ from, to })}`));
    const rows = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    return {
      agents: rows<AgentReportRow>(raw.agents ?? raw.byAgent),
      clinics: rows<ClinicReportRow>(raw.clinics ?? raw.byClinic),
      categories: rows<CategoryReportRow>(raw.categories ?? raw.byCategory),
    };
  }, ADMIN);
}
