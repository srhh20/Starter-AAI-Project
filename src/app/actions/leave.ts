"use server";

// Leave-module server actions (leave design §6). Every action re-runs the
// gatekeepers — requireRole → re-read → leave-rules → guarded write — and
// reports success through a ?msg= banner (FR-07, design §3 rule 8).
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { checkSubmissionCap, recordSubmission, submitLimitPerHour } from "@/lib/action-throttle";
import {
  applyEdit,
  applyInfoNote,
  applyTransition,
  checkDuplicateBlock,
  checkSubmitEligibility,
} from "@/lib/leave-rules";
import { prisma } from "@/lib/prisma";
import {
  validateLeaveForm,
  validateRequiredNote,
  validateRequiredRemark,
} from "@/lib/validation";

export type LeaveFormState = { error?: string };

// submitLeave — U9/AC-15/AC-16/AC-17 (design §3 rules 1–2): the Employee
// role only, validated form, chosen supervisor must be a same-division
// Supervisor; the new row waits as `Pending supervisor`.
export async function submitLeave(
  _prevState: LeaveFormState | undefined,
  formData: FormData
): Promise<LeaveFormState | undefined> {
  const user = await requireRole("Employee");

  // X4 submission throttle (AC-29): rolling-hour cap, in-memory per user.
  const cap = checkSubmissionCap(user.id);
  if (!cap.allowed) {
    return {
      error: `You have reached the limit of ${submitLimitPerHour()} leave requests per hour. Try again in about ${cap.retryAfterMinutes} minute${cap.retryAfterMinutes === 1 ? "" : "s"}.`,
    };
  }

  const typeIdRaw = formData.get("leaveTypeId");
  const typeId =
    typeof typeIdRaw === "string" || typeof typeIdRaw === "number"
      ? Number(typeIdRaw)
      : NaN;
  const leaveType =
    Number.isInteger(typeId) && typeId > 0
      ? await prisma.leaveType.findUnique({
          where: { id: typeId },
          select: { id: true, name: true },
        })
      : null;
  if (!leaveType) {
    // forged dropdown value (AC-16) — same message as a missing type
    return { error: "Choose one of the five leave types." };
  }

  const form = validateLeaveForm({
    leaveType: leaveType.name,
    otherLeaveType: formData.get("otherLeaveType"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!form.ok) {
    return { error: form.error };
  }

  const supervisor = await checkSubmitEligibility(user, formData.get("supervisorId"));
  if (!supervisor.ok) {
    return { error: supervisor.error };
  }

  // X1 duplicate block (AC-26): refuse while the owner holds an open row,
  // naming it — it is the actor's own request, so the message may show it
  // (design §3 rule 10).
  const blocker = await checkDuplicateBlock(user.id);
  if (blocker) {
    const day = (d: Date) =>
      d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
    return {
      error: `You already have an open request (${blocker.leaveType.name}, ${day(
        blocker.startDate
      )} → ${day(blocker.endDate)}, ${blocker.status}). Finish it before submitting another.`,
    };
  }

  await prisma.leaveRequest.create({
    data: {
      employeeId: user.id,
      supervisorId: supervisor.value.supervisorId,
      leaveTypeId: leaveType.id,
      otherLeaveType: form.value.otherLeaveType,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      status: "Pending supervisor",
      submittedAt: new Date(),
    },
  });
  recordSubmission(user.id);

  revalidatePath("/employee");
  redirect("/employee?msg=submitted", RedirectType.replace);
}

// signLeave — U10/AC-18/AC-19 (design §3 rule 4, FR-03): the named
// supervisor only, only from `Pending supervisor`; guarded update (§2).
export async function signLeave(formData: FormData): Promise<void> {
  const user = await requireRole("Supervisor");
  const result = await applyTransition(user, "sign", formData.get("id"));
  revalidatePath("/supervisor");
  revalidatePath("/employee");
  redirect(
    result.ok ? "/supervisor?msg=signed" : "/supervisor?msg=failed",
    RedirectType.replace
  );
}

// rejectSupervisorLeave — U10/AC-19 (FR-03): remark mandatory (§7.2),
// guarded update to `Rejected by supervisor` (Final, never reaches HR).
export async function rejectSupervisorLeave(
  _prevState: LeaveFormState | undefined,
  formData: FormData
): Promise<LeaveFormState | undefined> {
  const user = await requireRole("Supervisor");
  const remark = validateRequiredRemark(formData.get("remark"));
  if (!remark.ok) {
    return { error: remark.error };
  }
  const result = await applyTransition(user, "reject_supervisor", formData.get("id"), {
    remark: remark.value,
  });
  revalidatePath("/supervisor");
  revalidatePath("/employee");
  redirect(
    result.ok ? "/supervisor?msg=rejected" : "/supervisor?msg=failed",
    RedirectType.replace
  );
}

// sendToHrLeave — U11/AC-20 (design §3 rule 5, FR-04): the owner only,
// only from `Signed`; guarded update to `Pending HR`, joining the shared
// HR queue (design §5).
export async function sendToHrLeave(formData: FormData): Promise<void> {
  const user = await requireRole("Employee");
  const result = await applyTransition(user, "send_to_hr", formData.get("id"));
  revalidatePath("/employee");
  revalidatePath("/hr");
  redirect(
    result.ok ? "/employee?msg=sent" : "/employee?msg=failed",
    RedirectType.replace
  );
}

// approveLeave — U12/AC-21 (design §3 rule 6, FR-05): either HR officer
// may decide the shared queue, only from `Pending HR`; the guarded update
// (§2) makes it `Approved` and records the deciding officer.
export async function approveLeave(formData: FormData): Promise<void> {
  const user = await requireRole("HR");
  const result = await applyTransition(user, "approve", formData.get("id"));
  revalidatePath("/hr");
  revalidatePath("/employee");
  revalidatePath("/supervisor");
  redirect(result.ok ? "/hr?msg=approved" : "/hr?msg=failed", RedirectType.replace);
}

// editLeave — U18/X2 (AC-27, design §3 rule 11): the owner edits their own
// still-`Pending supervisor` row (type, purpose, dates, supervisor). The
// form rules match submitLeave; the write itself is applyEdit's guarded
// update — no edit path exists for Signed or Final rows (forged ids get
// the generic message, §3 rule 10).
export async function editLeave(
  _prevState: LeaveFormState | undefined,
  formData: FormData
): Promise<LeaveFormState | undefined> {
  const user = await requireRole("Employee");

  const typeIdRaw = formData.get("leaveTypeId");
  const typeId =
    typeof typeIdRaw === "string" || typeof typeIdRaw === "number"
      ? Number(typeIdRaw)
      : NaN;
  const leaveType =
    Number.isInteger(typeId) && typeId > 0
      ? await prisma.leaveType.findUnique({
          where: { id: typeId },
          select: { id: true, name: true },
        })
      : null;
  if (!leaveType) {
    return { error: "Choose one of the five leave types." };
  }

  const form = validateLeaveForm({
    leaveType: leaveType.name,
    otherLeaveType: formData.get("otherLeaveType"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!form.ok) {
    return { error: form.error };
  }

  const result = await applyEdit(user, formData.get("id"), {
    leaveTypeId: leaveType.id,
    otherLeaveType: form.value.otherLeaveType,
    startDate: form.value.startDate,
    endDate: form.value.endDate,
    supervisorId: formData.get("supervisorId"),
  });
  if (!result.ok) {
    return {
      error:
        result.code === "bad-supervisor"
          ? "Choose a supervisor from your own division."
          : "That request can no longer be edited.",
    };
  }

  revalidatePath("/employee");
  revalidatePath("/supervisor");
  redirect("/employee?msg=edited", RedirectType.replace);
}

// rejectHrLeave — U12/AC-21 (design §3 rule 6, FR-05): remark mandatory
// (§7.2); guarded update to `Rejected by HR` (Final), deciding officer
// recorded.
export async function rejectHrLeave(
  _prevState: LeaveFormState | undefined,
  formData: FormData
): Promise<LeaveFormState | undefined> {
  const user = await requireRole("HR");
  const remark = validateRequiredRemark(formData.get("remark"));
  if (!remark.ok) {
    return { error: remark.error };
  }
  const result = await applyTransition(user, "reject_hr", formData.get("id"), {
    remark: remark.value,
  });
  revalidatePath("/hr");
  revalidatePath("/employee");
  revalidatePath("/supervisor");
  redirect(result.ok ? "/hr?msg=rejected" : "/hr?msg=failed", RedirectType.replace);
}

// askInfoLeave — U19/X3 (AC-28): an HR officer adds a mandatory note to a
// `Pending HR` row. The status is untouched — the row stays queued — and
// the employee sees the note on their own list.
export async function askInfoLeave(
  _prevState: LeaveFormState | undefined,
  formData: FormData
): Promise<LeaveFormState | undefined> {
  const user = await requireRole("HR");
  const note = validateRequiredNote(formData.get("remark"));
  if (!note.ok) {
    return { error: note.error };
  }
  const result = await applyInfoNote(user, formData.get("id"), note.value);
  revalidatePath("/hr");
  revalidatePath("/employee");
  redirect(result.ok ? "/hr?msg=noted" : "/hr?msg=failed", RedirectType.replace);
}
