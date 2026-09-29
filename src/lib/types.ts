// Shapes returned by the support backend, typed from
// Bparo-hypertension-support-dashboard-backend/docs/ARCHITECTURE.md. BIGINT ids
// can come back as strings, so ids are `number | string`; compare them with
// String(). Anything the contract does not pin down is optional, so render
// defensively.

export type Id = number | string;

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type Paginated<T> = { data: T[]; meta: PaginationMeta };

// ─── Roles & users ─────────────────────────────────────────────────────────

export const SUPPORT_ROLES = ["support_admin", "clinic_agent"] as const;
export type SupportRole = (typeof SUPPORT_ROLES)[number];

export const ROLE_LABELS: Record<SupportRole, string> = {
  support_admin: "Support admin",
  clinic_agent: "Clinic agent",
};

export type ClinicRef = { id: Id; name: string };

export type SupportUserSummary = { id: Id; name: string | null; email?: string | null; role?: SupportRole };

export type AuthUser = {
  id: Id;
  name: string | null;
  email: string;
  role: SupportRole;
  clinics: ClinicRef[];
};

export type LoginResponse = { accessToken: string; expiresIn?: number | string; user: AuthUser };

export type AdminUser = {
  id: Id;
  name: string | null;
  email: string;
  role: SupportRole;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  clinics?: ClinicRef[];
};

export type AdminClinic = {
  id: Id;
  name: string;
  isActive: boolean;
  syncedAt?: string | null;
  agentCount?: number;
  openTicketCount?: number;
};

// ─── Tickets ───────────────────────────────────────────────────────────────

export const TICKET_STATUSES = ["open", "in_progress", "waiting_on_patient", "escalated", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const ACTIVE_STATUSES: readonly TicketStatus[] = ["open", "in_progress", "waiting_on_patient", "escalated"];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  "appointment",
  "payment",
  "ahs",
  "pharmacy",
  "home_test",
  "technical",
  "account",
  "carebot",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_SOURCES = ["patient", "doctor", "carebot", "staff"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

// Mirrors support.rules.ts TICKET_TRANSITIONS so the status picker only offers
// moves the backend will accept.
export const TICKET_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ["in_progress", "waiting_on_patient", "escalated", "resolved", "closed"],
  in_progress: ["open", "waiting_on_patient", "escalated", "resolved", "closed"],
  waiting_on_patient: ["in_progress", "escalated", "resolved", "closed"],
  escalated: ["in_progress", "waiting_on_patient", "resolved", "closed"],
  resolved: ["open", "in_progress", "closed"],
  closed: ["open"],
};

export const REF_LABELS = {
  appointmentId: "Appointment",
  paymentId: "Payment",
  pharmacyOrderId: "Pharmacy order",
  homeTestBookingId: "Home test booking",
  ahsClaimId: "AHS claim",
} as const;
export type RefKey = keyof typeof REF_LABELS;

export type Person = { bparoUserId: Id | null; name: string | null; email: string | null; role?: string | null };

export type TicketSummary = {
  id: Id;
  number: string;
  subject: string;
  category: TicketCategory | string;
  priority: TicketPriority | string;
  status: TicketStatus | string;
  source: TicketSource | string;
  isConfidential: boolean;
  requester: Person | null;
  patient: Person | null;
  clinic: ClinicRef | null;
  assignee: SupportUserSummary | null;
  refs: Partial<Record<RefKey, Id | null>>;
  dueAt: string | null;
  overdue: boolean;
  firstResponseAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type TicketMessage = {
  id: Id;
  body: string;
  isInternal: boolean;
  attachments: string[];
  authorType: "requester" | "agent" | "system" | string;
  authorName: string | null;
  createdAt: string;
};

export type TicketEvent = {
  id: Id;
  type: string;
  from: string | null;
  to: string | null;
  note: string | null;
  actorType: string | null;
  actorName: string | null;
  createdAt: string;
};

export type TicketDetail = TicketSummary & {
  description: string;
  resolutionSummary: string | null;
  carebot: { lastBotReply: string | null; transcriptShared: boolean; transcript: string | null } | null;
  messages: TicketMessage[];
  history: TicketEvent[];
};

export type DashboardData = {
  myOpen: number;
  unassigned: number;
  overdue: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  createdLast7Days: number;
  resolvedLast7Days: number;
  recentUrgent: TicketSummary[];
};

export type TicketFilters = {
  status?: string;
  priority?: string;
  category?: string;
  source?: string;
  assignee?: string;
  clinicId?: string;
  overdue?: "true" | "false" | "";
  search?: string;
  sort?: "newest" | "oldest" | "due" | "updated";
};

export type TicketUpdate = {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assigneeId?: Id | null;
  clinicId?: Id | null;
  resolutionSummary?: string | null;
  note?: string;
};

// ─── Reports ───────────────────────────────────────────────────────────────

export type AgentReportRow = {
  id?: Id | null;
  name: string | null;
  assigned: number;
  resolved: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  slaBreaches: number;
};

export type ClinicReportRow = {
  id?: Id | null;
  name: string | null;
  created?: number;
  open?: number;
  resolved?: number;
  overdue?: number;
  slaBreaches?: number;
  avgResolutionHours?: number | null;
};

export type CategoryReportRow = {
  category: string;
  created?: number;
  open?: number;
  resolved?: number;
  slaBreaches?: number;
  avgResolutionHours?: number | null;
};

export type ReportsData = {
  agents: AgentReportRow[];
  clinics: ClinicReportRow[];
  categories: CategoryReportRow[];
};

// ─── Patient overview (proxied from BParo SupportInvestigationService) ─────

export type PatientOverview = {
  generatedAt?: string;
  profile?: Record<string, unknown> | null;
  relatives?: Record<string, unknown>[] | null;
  appointments?: Record<string, unknown>[] | null;
  payments?: Record<string, unknown>[] | null;
  activeSessions?: Record<string, unknown>[] | number | null;
  pharmacyOrders?: Record<string, unknown>[] | null;
  homeTestBookings?: Record<string, unknown>[] | null;
  notificationDeliveries?: Record<string, unknown>[] | null;
};
