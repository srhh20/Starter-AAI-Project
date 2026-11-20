// One badge per §5.2 status (leave design §4): Pending* amber, Signed blue,
// Approved green, Rejected red. Pure presentation — the status text itself
// always comes from the database row.
const BADGE_CLASSES: Record<string, string> = {
  "Pending supervisor": "bg-amber-100 text-amber-900 ring-amber-300",
  "Pending HR": "bg-amber-100 text-amber-900 ring-amber-300",
  Signed: "bg-blue-100 text-blue-900 ring-blue-300",
  Approved: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  "Rejected by supervisor": "bg-red-100 text-red-800 ring-red-300",
  "Rejected by HR": "bg-red-100 text-red-800 ring-red-300",
};

export default function StatusBadge({ status }: { status: string }) {
  const tone = BADGE_CLASSES[status] ?? "bg-slate-100 text-slate-700 ring-slate-300";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {status}
    </span>
  );
}
