// X4 (Task 22, AC-29, design §3 rule 11): a generic in-memory per-user
// counter for write actions — the login-throttle.ts pattern. Today only
// submitLeave uses it: at most 10 submissions per user per rolling hour,
// and `npm run dev` restarting clears the counters on purpose (the demo
// runs on one laptop). `SUBMIT_LIMIT_PER_HOUR` overrides the cap outside
// production so the AC-29 walkthrough can set it to 2.
const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;

type Submissions = { at: number[] };
const byUser = new Map<string, Submissions>();

export function submitLimitPerHour(): number {
  if (process.env.NODE_ENV !== "production") {
    const raw = process.env.SUBMIT_LIMIT_PER_HOUR;
    if (raw && /^\d+$/.test(raw) && Number(raw) > 0) return Number(raw);
  }
  return DEFAULT_LIMIT;
}

export type SubmitCapResult =
  | { allowed: true }
  | { allowed: false; retryAfterMinutes: number };

// Counts the submissions already made inside the rolling hour; records
// nothing — the caller records only once the row really exists, so
// refused or invalid attempts never eat the user's allowance.
export function checkSubmissionCap(userId: number): SubmitCapResult {
  const entry = byUser.get(String(userId));
  if (!entry) return { allowed: true };
  const now = Date.now();
  const recent = entry.at.filter((t) => now - t < WINDOW_MS);
  if (recent.length === 0) {
    byUser.delete(String(userId)); // whole window has aged out
    return { allowed: true };
  }
  byUser.set(String(userId), { at: recent });
  if (recent.length >= submitLimitPerHour()) {
    const retryAfterMinutes = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - recent[0])) / 60_000)
    );
    return { allowed: false, retryAfterMinutes };
  }
  return { allowed: true };
}

export function recordSubmission(userId: number): void {
  const key = String(userId);
  const entry = byUser.get(key) ?? { at: [] };
  entry.at.push(Date.now());
  byUser.set(key, entry);
}
