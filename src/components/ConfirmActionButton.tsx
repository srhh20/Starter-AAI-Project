"use client";

// FR-07 (§5.3.7): every write button confirms first, then the server
// action reports success through its ?msg= banner — the SignOutButton
// pattern, generalised (leave design §3 rule 8). Cancelling sends nothing.
import { useTransition } from "react";

type Props = {
  label: string;
  confirmText: string;
  action: (formData: FormData) => Promise<void>;
  // hidden fields the action needs (request id, remark where asked)
  fields: Record<string, string>;
  tone?: "primary" | "danger";
};

const TONES: Record<"primary" | "danger", string> = {
  primary:
    "bg-[#4a6184] text-white hover:bg-[#3e5375]",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export default function ConfirmActionButton({
  label,
  confirmText,
  action,
  fields,
  tone = "primary",
}: Props) {
  const [pending, start] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmText)) return;
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }
    start(() => {
      void action(formData);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`rounded px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors disabled:opacity-50 ${TONES[tone]}`}
    >
      {label}
    </button>
  );
}
