// Signed session cookie (design §2 rules 5-7): the cookie carries a user id
// and an expiry only — never a role, name or email. The signature is
// HMAC-SHA256 over the payload with SESSION_SECRET, so a browser-edited
// cookie fails verification (AC-13) instead of being believed.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "hrms_session";

const DEFAULT_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours (AC-11)

export type SessionResult =
  | { status: "valid"; uid: number }
  | { status: "invalid" }
  | { status: "expired" };

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters — refusing to use sessions (design §2 rule 10)."
    );
  }
  return secret;
}

function sessionMaxAgeSeconds(): number {
  const override = Number(process.env.SESSION_MAX_AGE_SECONDS);
  return Number.isFinite(override) && override > 0
    ? override
    : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

// Cookie lifetime and payload expiry must agree (AC-11/AC-12).
export { sessionMaxAgeSeconds };

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

export function createSessionCookieValue(uid: number): string {
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error("Session uid must be a positive integer.");
  }
  const payload = { uid, exp: Date.now() + sessionMaxAgeSeconds() * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionCookieValue(value: string): SessionResult {
  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) {
    return { status: "invalid" };
  }
  const body = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return { status: "invalid" };
  }

  let payload: { uid?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { status: "invalid" };
  }
  if (
    !Number.isInteger(payload.uid) ||
    (payload.uid as number) <= 0 ||
    typeof payload.exp !== "number"
  ) {
    return { status: "invalid" };
  }
  if (payload.exp <= Date.now()) {
    return { status: "expired" };
  }
  return { status: "valid", uid: payload.uid as number };
}
