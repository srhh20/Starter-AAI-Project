// Password-guessing resistance (design §2 rule 3, AC-06): five consecutive
// failures for one email block that email for 15 minutes; a success resets
// it. In-memory on purpose — the demo runs on one laptop, and counters
// clearing on `npm run dev` restart is acceptable.
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type Attempts = { failures: number; lockedUntil: number };
const attempts = new Map<string, Attempts>();

export function isLockedOut(email: string): boolean {
  const entry = attempts.get(email);
  if (!entry) return false;
  if (entry.lockedUntil > 0 && Date.now() >= entry.lockedUntil) {
    attempts.delete(email); // lock expired — start fresh
    return false;
  }
  return entry.lockedUntil > 0 && Date.now() < entry.lockedUntil;
}

export function recordFailure(email: string): void {
  const entry = attempts.get(email) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.failures = 0; // after a lock expires, five new failures lock again
  }
  attempts.set(email, entry);
}

export function clearFailures(email: string): void {
  attempts.delete(email);
}
