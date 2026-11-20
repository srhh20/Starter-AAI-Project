"use client";

import { useActionState } from "react";

import { signIn, type SignInState } from "@/app/actions/auth";

// Look: design §8 — icon box + white input rows, slate-blue uppercase button.
// Behaviour is unchanged: same field names, accessible labels (sr-only),
// role="alert" error and disabled-while-pending submit.
export default function SignInForm() {
  const [state, formAction, pending] = useActionState<SignInState | undefined, FormData>(
    signIn,
    undefined
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-stretch shadow-md">
        <span
          aria-hidden
          className="flex w-12 shrink-0 items-center justify-center bg-[#4a6184] text-white"
        >
          <UserIcon />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor="email" className="sr-only">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@budiman.com"
            className="h-12 w-full bg-white px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-stretch shadow-md">
        <span
          aria-hidden
          className="flex w-12 shrink-0 items-center justify-center bg-[#4a6184] text-white"
        >
          <LockIcon />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            className="h-12 w-full bg-white px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="text-center text-sm font-semibold text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-12 bg-[#4a6184] text-sm font-medium uppercase tracking-[0.25em] text-white transition-colors hover:bg-[#3e5375] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-7 2-7 4.5V20h14v-1.5c0-2.5-3-4.5-7-4.5Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm3 8H9V7a3 3 0 1 1 6 0Z" />
    </svg>
  );
}
