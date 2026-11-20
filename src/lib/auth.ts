// The login check and (from Task 6) the gatekeeper helpers.
// Design §2 rules 1-3: failures never reveal which part was wrong, unknown
// emails still burn a bcrypt comparison, and the lockout covers even a
// correct password.
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { clearFailures, isLockedOut, recordFailure } from "@/lib/login-throttle";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/session";

// A real bcrypt hash of a password nobody has; compared when the email is
// unknown so the two failure paths take a similar time (AC-03).
const DUMMY_HASH = "$2b$10$d7CFQtXoOez7xIT62AIFmeZTkdjGc9X7RJmRdlflpHihDVKRy9gm6";

export type LoginResult =
  | { status: "ok"; user: User }
  | { status: "invalid-credentials" }
  | { status: "locked" };

// U1/AC-01: one home page per role (design §4).
const ROLE_HOME: Record<string, string> = {
  Employee: "/employee",
  Supervisor: "/supervisor",
  HR: "/hr",
  Admin: "/admin",
};

// Throws for a role outside the four — data can only come from the seed.
export function roleHome(role: string): string {
  const home = ROLE_HOME[role];
  if (!home) {
    throw new Error(`Unknown role "${role}" in the Users table.`);
  }
  return home;
}

// email must already be validated and lowercased by validateEmail.
export async function checkLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  if (isLockedOut(email)) {
    return { status: "locked" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const matches = bcrypt.compareSync(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !matches) {
    recordFailure(email);
    return { status: "invalid-credentials" };
  }

  clearFailures(email);
  return { status: "ok", user };
}

// --- Gatekeepers (design §2 rule 6): every page and server action calls
// these. The cookie is signature-verified first, then the user and role are
// read from the database — never believed from the browser (AC-07/AC-08/AC-13).

export async function getServerUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  const result = verifySessionCookieValue(raw);
  if (result.status !== "valid") return null;
  return prisma.user.findUnique({ where: { id: result.uid } });
}

// Anonymous (or tampered/expired) visitor → back to /login, silently.
export async function requireUser(): Promise<User> {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return user;
}

// Right cookie, wrong role → back to your own home, silently.
export async function requireRole(role: string): Promise<User> {
  const user = await requireUser();
  if (user.role !== role) redirect(roleHome(user.role));
  return user;
}
