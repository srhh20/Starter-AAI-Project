// Task 8 — defence in depth (design §2 rule 6, §6): before any page
// renders, requests with no — or an unverifiable — session cookie on the
// protected routes get an early redirect to /login. Only the cookie
// signature and expiry are checked here (no database); the page-level
// requireUser/requireRole checks remain the real enforcement, so deleting
// this file must not open any page to the wrong user.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/session";

// /login itself must always be reachable, including the anonymous POST that
// carries the sign-in server action.
const PROTECTED_PATHS = ["/employee", "/supervisor", "/hr", "/admin", "/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PROTECTED_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verdict = raw
    ? verifySessionCookieValue(raw)
    : { status: "invalid" as const };
  if (verdict.status !== "valid") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/employee", "/supervisor", "/hr", "/admin", "/", "/login"],
};
