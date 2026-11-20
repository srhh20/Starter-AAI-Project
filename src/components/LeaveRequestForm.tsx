"use client";

// New-request card (leave design §4): five types from the database, the
// conditional Other-purpose textarea (brief §7.2), dates, and a dropdown of
// the employee's same-division supervisors. Server action + useActionState,
// inline errors, disabled while pending — the SignInForm pattern.
// X2 (Task 20): reused for editing a Pending supervisor row — pass the
// editLeave action, the row's values as `initial`, its id as `requestId`,
// and a unique `idPrefix` so several forms can share a page.
import { useActionState, useState } from "react";

import type { LeaveFormState } from "@/app/actions/leave";

export type LeaveFormInitial = {
  leaveTypeId: number;
  supervisorId: number;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  otherLeaveType: string | null;
};

type Props = {
  leaveTypes: { id: number; name: string; description: string | null }[];
  supervisors: { id: number; name: string }[];
  action: (
    prev: LeaveFormState | undefined,
    formData: FormData
  ) => Promise<LeaveFormState | undefined>;
  idPrefix?: string;
  initial?: LeaveFormInitial;
  requestId?: number;
  submitLabel?: string;
  pendingLabel?: string;
  confirmText?: string;
};

function todayInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

const FIELD =
  "h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#4a6184] focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export default function LeaveRequestForm({
  leaveTypes,
  supervisors,
  action,
  idPrefix = "new",
  initial,
  requestId,
  submitLabel = "Submit request",
  confirmText = "Are you sure you want to submit this leave request?",
  pendingLabel = "Submitting…",
}: Props) {
  const [state, formAction, pending] = useActionState<LeaveFormState | undefined, FormData>(
    action,
    undefined
  );
  const [typeId, setTypeId] = useState<number | null>(
    initial?.leaveTypeId ?? (leaveTypes.length > 0 ? leaveTypes[0].id : null)
  );
  const [otherValue, setOtherValue] = useState(initial?.otherLeaveType ?? "");
  const selected = leaveTypes.find((t) => t.id === typeId) ?? null;
  const otherSelected = selected?.name === "Other";
  const today = todayInputValue();

  // FR-07: confirm before the write reaches the server.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmText)) {
      event.preventDefault();
    }
  }

  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {requestId !== undefined && <input type="hidden" name="id" value={requestId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("leaveTypeId")} className={LABEL}>
            Leave type
          </label>
          <select
            id={id("leaveTypeId")}
            name="leaveTypeId"
            className={FIELD}
            value={typeId ?? ""}
            onChange={(e) => setTypeId(Number(e.target.value))}
          >
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selected?.description && (
            <p className="mt-1 text-xs text-slate-500">{selected.description}</p>
          )}
        </div>
        <div>
          <label htmlFor={id("supervisorId")} className={LABEL}>
            Supervisor (your division)
          </label>
          {supervisors.length === 0 ? (
            <p className="text-sm text-red-600">
              No supervisor exists in your division — ask HR.
            </p>
          ) : (
            <select
              id={id("supervisorId")}
              name="supervisorId"
              className={FIELD}
              defaultValue={initial?.supervisorId ?? supervisors[0].id}
            >
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {otherSelected && (
        <div>
          <label htmlFor={id("otherLeaveType")} className={LABEL}>
            What is the leave for? (required for &quot;Other&quot;)
          </label>
          <textarea
            id={id("otherLeaveType")}
            name="otherLeaveType"
            rows={2}
            maxLength={500}
            placeholder="What is the leave for?"
            className={`${FIELD} h-auto py-2`}
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("startDate")} className={LABEL}>
            Start date
          </label>
          <input
            id={id("startDate")}
            name="startDate"
            type="date"
            min={today}
            className={FIELD}
            defaultValue={initial?.startDate}
            required
          />
        </div>
        <div>
          <label htmlFor={id("endDate")} className={LABEL}>
            End date
          </label>
          <input
            id={id("endDate")}
            name="endDate"
            type="date"
            min={today}
            className={FIELD}
            defaultValue={initial?.endDate}
            required
          />
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {state.error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#4a6184] px-6 py-2.5 text-sm font-medium uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#3e5375] disabled:opacity-50"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
