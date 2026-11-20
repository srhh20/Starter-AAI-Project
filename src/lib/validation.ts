// Server-side form checks (design §2 rule 1, §5) and leave-form checks
// (leave design §3 rule 2). Hand-written — no validation package is added
// to the project.
import { LEAVE_TYPE_NAMES } from "@/lib/leave-rules";

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

// U7/AC-04: only Budiman work emails are accepted at login.
const EMAIL_RE = /^[a-z0-9._%+-]+@budiman\.com$/;

// Brief 7.2: identity card numbers are two digits, hyphen, six digits.
const IC_RE = /^\d{2}-\d{6}$/;

export function validateEmail(raw: unknown): FieldResult<string> {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, error: "Enter your work email address." };
  }
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return {
      ok: false,
      error: "Please use your Budiman work email address (ending @budiman.com).",
    };
  }
  return { ok: true, value: email };
}

export function validatePassword(raw: unknown): FieldResult<string> {
  if (typeof raw !== "string" || raw === "") {
    return { ok: false, error: "Enter your password." };
  }
  return { ok: true, value: raw };
}

export function validateIcNo(raw: unknown): FieldResult<string> {
  if (typeof raw !== "string" || !IC_RE.test(raw)) {
    return { ok: false, error: "IC number must be formatted xx-xxxxxx." };
  }
  return { ok: true, value: raw };
}

// --- Leave form (leave design §3 rule 2, brief §7.2, assumptions A1/A2) ---

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 500;

// Parses yyyy-mm-dd as a calendar day stored at midnight UTC; rejects
// impossible days like 2026-02-30.
function parseDateOnly(raw: unknown): Date | null {
  if (typeof raw !== "string" || !DATE_RE.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

// A1: leave starts today or later — "today" is the server's own date.
function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export type LeaveFormValue = {
  leaveTypeName: string;
  otherLeaveType: string | null;
  startDate: Date;
  endDate: Date;
};

export function validateLeaveForm(input: {
  leaveType: unknown;
  otherLeaveType: unknown;
  startDate: unknown;
  endDate: unknown;
}): FieldResult<LeaveFormValue> {
  const leaveTypeName =
    typeof input.leaveType === "string" ? input.leaveType : "";
  if (!(LEAVE_TYPE_NAMES as readonly string[]).includes(leaveTypeName)) {
    return { ok: false, error: "Choose one of the five leave types." };
  }

  const startDate = parseDateOnly(input.startDate);
  if (!startDate) {
    return { ok: false, error: "Enter a valid start date (yyyy-mm-dd)." };
  }
  const endDate = parseDateOnly(input.endDate);
  if (!endDate) {
    return { ok: false, error: "Enter a valid end date (yyyy-mm-dd)." };
  }
  if (endDate < startDate) {
    // brief §7.2: end date is not before start date
    return { ok: false, error: "The end date cannot be before the start date." };
  }
  if (startDate < todayUtcMidnight()) {
    return { ok: false, error: "The start date cannot be in the past." };
  }

  const otherLeaveType =
    typeof input.otherLeaveType === "string" ? input.otherLeaveType.trim() : "";
  if (leaveTypeName === "Other") {
    if (otherLeaveType === "") {
      // brief §7.2: required "what the leave is for" when the type is Other
      return { ok: false, error: "Tell us what the leave is for." };
    }
    if (otherLeaveType.length > MAX_TEXT) {
      return { ok: false, error: "The purpose must be 500 characters or fewer." };
    }
  }

  return {
    ok: true,
    value: {
      leaveTypeName,
      otherLeaveType: leaveTypeName === "Other" ? otherLeaveType : null,
      startDate,
      endDate,
    },
  };
}

// §7.2 + A2: remarks are mandatory on rejections and capped at 500 chars.
export function validateRequiredRemark(raw: unknown): FieldResult<string> {
  const remark = typeof raw === "string" ? raw.trim() : "";
  if (remark === "") {
    return { ok: false, error: "A remark is required when rejecting." };
  }
  if (remark.length > MAX_TEXT) {
    return { ok: false, error: "The remark must be 500 characters or fewer." };
  }
  return { ok: true, value: remark };
}

// X3 (Task 21, AC-28): the HR "ask for info" note is mandatory too and
// capped at 500 chars, same shape as the rejection remark.
export function validateRequiredNote(raw: unknown): FieldResult<string> {
  const note = typeof raw === "string" ? raw.trim() : "";
  if (note === "") {
    return { ok: false, error: "A note is required." };
  }
  if (note.length > MAX_TEXT) {
    return { ok: false, error: "The note must be 500 characters or fewer." };
  }
  return { ok: true, value: note };
}
