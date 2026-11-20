// The leave rules library (leave design §6): the fixed status/type lists,
// the §2 transition table, supervisor candidates and day maths. Every
// server action re-checks its move through canApply before writing; pages
// use candidateSupervisors/days for display. Server-side only — it talks
// to Prisma, so client components must not import it.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { FieldResult } from "@/lib/validation";

// Design Reference C — verbatim, nothing else is ever valid.
export const LEAVE_TYPE_NAMES = [
  "Annual leave",
  "Maternity leave",
  "Unpaid leave",
  "Compassionate leave",
  "Other",
] as const;

export const LEAVE_STATUSES = [
  "Pending supervisor",
  "Signed",
  "Pending HR",
  "Approved",
  "Rejected by supervisor",
  "Rejected by HR",
] as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

// §5.2: these three are Final — no server path leads out of them.
const FINAL_STATUSES: readonly string[] = [
  "Approved",
  "Rejected by supervisor",
  "Rejected by HR",
];

export function isLeaveStatus(value: unknown): value is LeaveStatus {
  return (
    typeof value === "string" &&
    (LEAVE_STATUSES as readonly string[]).includes(value)
  );
}

export function isFinalStatus(value: string): boolean {
  return FINAL_STATUSES.includes(value);
}

// Brief Reference B keeps the organisation's divisions fixed; the admin
// filter accepts only these (anything else is ignored, never trusted).
export const DIVISIONS = ["Finance", "Human Resources", "Admin"] as const;

// X1 (Task 19, AC-26): the three statuses that count as "open" — an
// employee holding one of these cannot submit another request.
export const OPEN_STATUSES: readonly LeaveStatus[] = [
  "Pending supervisor",
  "Signed",
  "Pending HR",
];

// Returns the owner's oldest open row (the blocker, named in the error —
// it is their own data, design §3 rule 10) or null when free to submit.
export async function checkDuplicateBlock(
  employeeId: number
): Promise<{
  id: number;
  status: string;
  startDate: Date;
  endDate: Date;
  leaveType: { name: string };
} | null> {
  return prisma.leaveRequest.findFirst({
    where: { employeeId, status: { in: [...OPEN_STATUSES] } },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      leaveType: { select: { name: true } },
    },
  });
}

// X2 (Task 20, AC-27): owner-only edit of a still-unsigned request. The
// row is re-read from the database and the write is a guarded updateMany
// (design §2) — Signed and Final rows have no edit path at all.
export type EditResult =
  | { ok: true }
  | { ok: false; code: "not-editable" | "bad-supervisor" };

export async function applyEdit(
  actor: { id: number; role: string; division: string },
  requestId: unknown,
  values: {
    leaveTypeId: number;
    otherLeaveType: string | null;
    startDate: Date;
    endDate: Date;
    supervisorId: unknown;
  }
): Promise<EditResult> {
  const id =
    typeof requestId === "number"
      ? requestId
      : typeof requestId === "string" && /^\d+$/.test(requestId)
        ? Number(requestId)
        : NaN;
  if (!Number.isInteger(id) || id <= 0) return { ok: false, code: "not-editable" };

  const row = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { id: true, employeeId: true, status: true },
  });
  if (!row || row.employeeId !== actor.id || row.status !== "Pending supervisor") {
    return { ok: false, code: "not-editable" };
  }

  // the new supervisor must exist, be a Supervisor and share the owner's
  // division (same rule as submitting, design §3 rule 2)
  const supervisorId =
    typeof values.supervisorId === "number"
      ? values.supervisorId
      : typeof values.supervisorId === "string" && /^\d+$/.test(values.supervisorId)
        ? Number(values.supervisorId)
        : NaN;
  const supervisor = Number.isInteger(supervisorId) && supervisorId > 0
    ? await prisma.user.findFirst({
        where: { id: supervisorId, role: "Supervisor", division: actor.division },
        select: { id: true },
      })
    : null;
  if (!supervisor) return { ok: false, code: "bad-supervisor" };

  const updated = await prisma.leaveRequest.updateMany({
    where: { id, employeeId: actor.id, status: "Pending supervisor" },
    data: {
      leaveTypeId: values.leaveTypeId,
      otherLeaveType: values.otherLeaveType,
      startDate: values.startDate,
      endDate: values.endDate,
      supervisorId: supervisor.id,
    },
  });
  if (updated.count === 0) return { ok: false, code: "not-editable" };
  return { ok: true };
}

// X3 (Task 21, AC-28): an HR officer can ask for more information on a row
// that is still in the queue. The note is stored on the row and the status
// is untouched — the row stays `Pending HR`. Guarded updateMany (design §2)
// so a decision made while the officer was typing wins the race.
export type InfoNoteResult = { ok: true } | { ok: false; code: "not-allowed" };

export async function applyInfoNote(
  actor: { id: number; role: string },
  requestId: unknown,
  note: string
): Promise<InfoNoteResult> {
  const id =
    typeof requestId === "string" || typeof requestId === "number"
      ? Number(requestId)
      : NaN;
  if (!Number.isInteger(id) || id <= 0) return { ok: false, code: "not-allowed" };
  if (actor.role !== "HR") return { ok: false, code: "not-allowed" };

  const row = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!row || row.status !== "Pending HR") {
    return { ok: false, code: "not-allowed" };
  }
  const updated = await prisma.leaveRequest.updateMany({
    where: { id, status: "Pending HR" },
    data: { infoNote: note.trim(), infoNoteAt: new Date() },
  });
  if (updated.count === 0) return { ok: false, code: "not-allowed" }; // decided mid-edit
  return { ok: true };
}

// Admin table filters (Task 18, AC-25): query params are only honoured
// when they match the fixed lists — junk values mean "no filter".
export function adminFilterWhere(sp: {
  status?: string | null;
  type?: string | null;
  division?: string | null;
}): Prisma.LeaveRequestWhereInput {
  const where: Prisma.LeaveRequestWhereInput = {};
  if (sp.status && isLeaveStatus(sp.status)) where.status = sp.status;
  if (sp.type && (LEAVE_TYPE_NAMES as readonly string[]).includes(sp.type)) {
    where.leaveType = { name: sp.type };
  }
  if (sp.division && (DIVISIONS as readonly string[]).includes(sp.division)) {
    where.employee = { division: sp.division };
  }
  return where;
}

export type LeaveAction =
  | "sign"
  | "reject_supervisor"
  | "send_to_hr"
  | "approve"
  | "reject_hr";

type Actor = { id: number; role: string };
type RowRef = { status: string; employeeId: number; supervisorId: number };

type Transition = {
  from: LeaveStatus;
  to: LeaveStatus;
  role: string;
  // actor-vs-row relationship (§5.3.4, FR-04): named supervisor / owner /
  // any HR officer
  belongs: (row: RowRef, actor: Actor) => boolean;
  remarkRequired: boolean;
};

// Design §2: only these moves exist, each re-checked right before writing.
const TRANSITIONS: Record<LeaveAction, Transition> = {
  sign: {
    from: "Pending supervisor",
    to: "Signed",
    role: "Supervisor",
    belongs: (row, actor) => row.supervisorId === actor.id,
    remarkRequired: false,
  },
  reject_supervisor: {
    from: "Pending supervisor",
    to: "Rejected by supervisor",
    role: "Supervisor",
    belongs: (row, actor) => row.supervisorId === actor.id,
    remarkRequired: true,
  },
  send_to_hr: {
    from: "Signed",
    to: "Pending HR",
    role: "Employee",
    belongs: (row, actor) => row.employeeId === actor.id,
    remarkRequired: false,
  },
  approve: {
    from: "Pending HR",
    to: "Approved",
    role: "HR",
    belongs: () => true, // either HR officer (FR-05)
    remarkRequired: false,
  },
  reject_hr: {
    from: "Pending HR",
    to: "Rejected by HR",
    role: "HR",
    belongs: () => true,
    remarkRequired: true,
  },
};

export type ApplyResult =
  | { ok: true; to: LeaveStatus }
  // codes carry no other-person data; actions show one generic message (rule 10)
  | { ok: false; code: "not-allowed" | "remark-required" };

// The single gate for every mutation: right role, right relationship to
// the row, row still in the expected status, remark present where the
// brief demands one.
export function canApply(
  actor: Actor,
  action: LeaveAction,
  row: RowRef,
  remark?: string | null
): ApplyResult {
  const t = TRANSITIONS[action];
  if (!t) return { ok: false, code: "not-allowed" };
  if (actor.role !== t.role) return { ok: false, code: "not-allowed" };
  if (!isLeaveStatus(row.status) || row.status !== t.from) {
    return { ok: false, code: "not-allowed" };
  }
  if (!t.belongs(row, actor)) return { ok: false, code: "not-allowed" };
  if (t.remarkRequired && (typeof remark !== "string" || remark.trim() === "")) {
    return { ok: false, code: "remark-required" };
  }
  return { ok: true, to: t.to };
}

export type TransitionResult = { ok: true } | { ok: false; code: "not-allowed" | "remark-required" };

// The one write path for every decision (design §2): re-read the row, run
// canApply, then a guarded update — update … where id AND status = the
// expected value — so two people acting at once cannot double-decide; the
// loser's click becomes a no-op.
export async function applyTransition(
  actor: { id: number; role: string },
  action: LeaveAction,
  requestId: unknown,
  extra: { remark?: string } = {}
): Promise<TransitionResult> {
  const id =
    typeof requestId === "string" || typeof requestId === "number"
      ? Number(requestId)
      : NaN;
  if (!Number.isInteger(id) || id <= 0) return { ok: false, code: "not-allowed" };
  const row = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { id: true, status: true, employeeId: true, supervisorId: true },
  });
  if (!row) return { ok: false, code: "not-allowed" };
  const decision = canApply(actor, action, row, extra.remark ?? null);
  if (!decision.ok) return decision;

  const now = new Date();
  // Unchecked: the actions set scalar FKs (hrOfficerId) directly.
  let data: Prisma.LeaveRequestUncheckedUpdateInput;
  switch (action) {
    case "sign":
      data = { status: decision.to, signedAt: now };
      break;
    case "reject_supervisor":
      data = { status: decision.to, supervisorRemark: extra.remark!.trim() };
      break;
    case "send_to_hr":
      data = { status: decision.to, sentToHrAt: now };
      break;
    case "approve":
      data = { status: decision.to, hrOfficerId: actor.id, decidedAt: now };
      break;
    case "reject_hr":
      data = {
        status: decision.to,
        hrOfficerId: actor.id,
        hrRemark: extra.remark!.trim(),
        decidedAt: now,
      };
      break;
  }
  const updated = await prisma.leaveRequest.updateMany({
    where: { id, status: TRANSITIONS[action].from },
    data,
  });
  if (updated.count === 0) return { ok: false, code: "not-allowed" }; // lost the race
  return { ok: true };
}

// §5.3.3 / FR-02: the dropdown and the server-side check share this query.
export async function candidateSupervisors(
  user: { division: string },
): Promise<{ id: number; name: string; email: string }[]> {
  return prisma.user.findMany({
    where: { role: "Supervisor", division: user.division },
    orderBy: { id: "asc" },
    select: { id: true, name: true, email: true },
  });
}

// Whole days inclusive (never stored, design §1): 10th→12th = 3 days.
export function days(start: Date, end: Date): number {
  const ms =
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.floor(ms / 86_400_000) + 1;
}

// Submit-time server check (design §3 rule 1): only the Employee role
// applies (§5.3.2), and the chosen supervisor must be a Supervisor in the
// owner's division (§5.3.3, FR-02) — never believed from the dropdown.
export async function checkSubmitEligibility(
  actor: { id: number; role: string; division: string },
  supervisorIdRaw: unknown
): Promise<FieldResult<{ supervisorId: number }>> {
  if (actor.role !== "Employee") {
    return { ok: false, error: "Only employees can apply for leave." };
  }
  const supervisorId =
    typeof supervisorIdRaw === "string" || typeof supervisorIdRaw === "number"
      ? Number(supervisorIdRaw)
      : NaN;
  const supervisor = Number.isInteger(supervisorId) && supervisorId > 0
    ? await prisma.user.findUnique({
        where: { id: supervisorId },
        select: { id: true, role: true, division: true },
      })
    : null;
  if (
    !supervisor ||
    supervisor.role !== "Supervisor" ||
    supervisor.division !== actor.division
  ) {
    return { ok: false, error: "Choose a supervisor from your own division." };
  }
  return { ok: true, value: { supervisorId: supervisor.id } };
}
