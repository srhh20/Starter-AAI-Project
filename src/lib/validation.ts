// Server-side form checks (design §2 rule 1, §5). Hand-written — no
// validation package is added to the project.

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
