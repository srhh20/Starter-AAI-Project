import { redirect } from "next/navigation";

import { getServerUser, roleHome } from "@/lib/auth";
import SignInForm from "@/components/SignInForm";

// Look: design §8 — the mockup's blurred sky-blue backdrop with the form
// column directly on it. Behaviour unchanged (AC-09 redirect, AC-10 banner).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  // AC-09: a signed-in visitor never sits on a login form.
  const user = await getServerUser();
  if (user) redirect(roleHome(user.role));

  // AC-10: report success after sign-out (rule 7).
  const { msg } = await searchParams;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#5b82bd_0%,#7fa0d3_35%,#aec6e8_65%,#dfeaf7_100%)] px-6">
      {/* soft cloud washes (decorative) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-white/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-4 h-80 w-80 rounded-full bg-white/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-white/15 blur-3xl"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <h1 className="text-center text-4xl font-extralight tracking-[0.12em] text-white">
          Budiman HRMS
        </h1>
        <p className="mt-3 text-center text-sm text-white/80">
          Sign in with your Budiman work email.
        </p>
        <PeopleIcon className="mt-6 h-16 w-16 text-white" />
        {msg === "signedout" && (
          <p
            role="status"
            className="mt-6 w-full border border-white/40 bg-white/15 px-3 py-2 text-center text-sm text-white backdrop-blur"
          >
            You have been signed out.
          </p>
        )}
        <div className="mt-8 flex w-full justify-center">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}

// Decorative two-people glyph from the mockup (design §8).
function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.8 19c0-3.2 2.6-5.2 5.7-5.2s5.7 2 5.7 5.2" />
      <circle cx="16.2" cy="9" r="2.4" />
      <path d="M15.2 13.9c2.6.2 5 1.9 5 4.6" />
    </svg>
  );
}
