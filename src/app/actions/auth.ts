"use server";

// Sign-in action (design §5): validate → lockout check → bcrypt compare →
// set the signed session cookie → redirect to the role's home page.
import { cookies, headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";

import { checkLogin, roleHome } from "@/lib/auth";
import {
  createSessionCookieValue,
  sessionMaxAgeSeconds,
  SESSION_COOKIE_NAME,
} from "@/lib/session";
import { validateEmail, validatePassword } from "@/lib/validation";

export type SignInState = { error?: string };

export async function signIn(
  _prevState: SignInState | undefined,
  formData: FormData
): Promise<SignInState | undefined> {
  const emailResult = validateEmail(formData.get("email"));
  if (!emailResult.ok) {
    return { error: emailResult.error };
  }
  const passwordResult = validatePassword(formData.get("password"));
  if (!passwordResult.ok) {
    return { error: passwordResult.error };
  }

  const result = await checkLogin(emailResult.value, passwordResult.value);
  if (result.status === "locked") {
    // AC-06: five failures block the email, correct password included.
    return { error: "Too many attempts — try again later." };
  }
  if (result.status === "invalid-credentials") {
    // AC-02/AC-03: one generic message for every credential failure.
    return { error: "Invalid email or password" };
  }

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(result.user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // AC-12: sent only over HTTPS; stays off on http://localhost.
    secure: requestHeaders.get("x-forwarded-proto") === "https",
    maxAge: sessionMaxAgeSeconds(),
  });

  redirect(roleHome(result.user.role));
}

// Sign-out action (design §2 rule 9, U5/AC-10): delete the cookie and show
// the signed-out banner on /login. Harmless when no session exists — the
// deletion is a no-op. replace keeps the Back button off the signed-in page.
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login?msg=signedout", RedirectType.replace);
}
