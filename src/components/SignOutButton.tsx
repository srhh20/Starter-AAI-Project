"use client";

import { startTransition } from "react";

import { signOut } from "@/app/actions/auth";

// U5/AC-10: confirm first (rule 7); Cancel keeps the session.
export default function SignOutButton() {
  function handleClick() {
    if (window.confirm("Are you sure you want to sign out?")) {
      startTransition(() => {
        void signOut();
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="border border-white/50 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-white/15"
    >
      Sign out
    </button>
  );
}
