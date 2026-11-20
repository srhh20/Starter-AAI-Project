"use client";

// Reject with a mandatory remark (FR-03/FR-05 + FR-07): the form confirms
// first; a missing/over-long remark bounces back as an inline error from
// the server action, nothing changes. Used by the supervisor and HR pages —
// also by HR's "Ask for info" (X3), which reads the same `remark` field
// with neutral styling via the optional props.
import { useActionState } from "react";

type Props = {
  action: (
    prev: { error?: string } | undefined,
    formData: FormData
  ) => Promise<{ error?: string } | undefined>;
  id: number;
  label: string;
  confirmText: string;
  remarkPlaceholder?: string;
  remarkLabel?: string;
  pendingLabel?: string;
  tone?: "danger" | "neutral";
  // two forms can share one row (Reject + Ask for info) — keep the input
  // ids unique so labels and locators hit the right field
  idSuffix?: string;
};

export default function RejectRequestForm({
  action,
  id,
  label,
  confirmText,
  remarkPlaceholder = "Remark (required)",
  remarkLabel = "Rejection remark",
  pendingLabel = "Rejecting…",
  tone = "danger",
  idSuffix,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmText)) {
      event.preventDefault();
    }
  }

  const remarkId = idSuffix ? `remark-${id}-${idSuffix}` : `remark-${id}`;
  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={String(id)} />
      <div className="min-w-0 flex-1">
        <label htmlFor={remarkId} className="sr-only">
          {remarkLabel}
        </label>
        <input
          id={remarkId}
          name="remark"
          maxLength={500}
          placeholder={remarkPlaceholder}
          className={`h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none ${
            tone === "danger" ? "focus:border-red-500" : "focus:border-[#4a6184]"
          }`}
        />
        {state?.error && (
          <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`rounded px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white transition-colors disabled:opacity-50 ${
          tone === "danger"
            ? "bg-red-600 hover:bg-red-700"
            : "bg-[#4a6184] hover:bg-[#3c4f6d]"
        }`}
      >
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
