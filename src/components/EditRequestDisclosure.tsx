"use client";

// X2 (Task 20): keeps the employee list calm — the edit form for a
// Pending supervisor row appears only when its owner opens it.
import { useState } from "react";

export default function EditRequestDisclosure({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-100"
      >
        Edit
      </button>
    );
  }
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-4">{children}</div>
  );
}
