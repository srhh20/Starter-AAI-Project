import { requireRole } from "@/lib/auth";
import { days } from "@/lib/leave-rules";
import { prisma } from "@/lib/prisma";
import { approveLeave, askInfoLeave, rejectHrLeave } from "@/app/actions/leave";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import RejectRequestForm from "@/components/RejectRequestForm";
import StatusBadge from "@/components/StatusBadge";

// FR-07: success banners after each write action (design §3 rule 8).
const BANNERS: Record<string, string> = {
  approved: "You approved the request. The employee sees it as Approved.",
  rejected: "You rejected the request with your remark. The employee sees it in their list.",
  noted: "You asked for more information. The request stays in your queue and the employee sees your note.",
  failed: "That action is no longer available for this request — another officer may have decided it.",
};

function fmtDay(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function HrHome({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireRole("HR");
  const rowInclude = {
    leaveType: { select: { name: true } },
    employee: { select: { name: true, division: true } },
    supervisor: { select: { name: true } },
  } as const;
  const [{ msg }, queue, decided] = await Promise.all([
    searchParams,
    // design §5: the shared queue — every Pending HR row, visible to both
    // HR officers; the first decision wins (design §2 guard).
    prisma.leaveRequest.findMany({
      where: { status: "Pending HR" },
      orderBy: [{ sentToHrAt: "asc" }, { id: "asc" }],
      include: rowInclude,
    }),
    // design §4: "Your decisions" history — the rows this officer decided
    // (FR-06, AC-22) with status, remark and timestamps.
    prisma.leaveRequest.findMany({
      where: { hrOfficerId: user.id, status: { in: ["Approved", "Rejected by HR"] } },
      orderBy: [{ decidedAt: "desc" }, { id: "desc" }],
      include: rowInclude,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {msg && BANNERS[msg] && (
        <p
          role="status"
          className="rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
        >
          {BANNERS[msg]}
        </p>
      )}

      <section className="rounded-lg bg-white p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-[#4a6184]">Pending HR queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed and sent requests await one HR decision — you are deciding
          as {user.name}.
        </p>
        {queue.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Nothing is waiting for an HR decision.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {queue.map((r) => {
              const n = days(r.startDate, r.endDate);
              return (
                <li key={r.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">
                      {r.employee.name} ({r.employee.division}) — {r.leaveType.name}
                      {r.otherLeaveType ? ` (${r.otherLeaveType})` : ""}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {fmtDay(r.startDate)} → {fmtDay(r.endDate)} · {n} day
                    {n === 1 ? "" : "s"} · signed by {r.supervisor.name} · sent{" "}
                    {fmtDay(r.sentToHrAt)}
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    <ConfirmActionButton
                      label="Approve"
                      confirmText="Are you sure you want to approve this request?"
                      action={approveLeave}
                      fields={{ id: String(r.id) }}
                    />
                    <RejectRequestForm
                      action={rejectHrLeave}
                      id={r.id}
                      label="Reject"
                      confirmText="Are you sure you want to reject this request? The remark becomes the employee's reason."
                    />
                    {/* X3/AC-28: mandatory note, the row stays Pending HR */}
                    <RejectRequestForm
                      action={askInfoLeave}
                      id={r.id}
                      label="Ask for info"
                      confirmText="Are you sure you want to ask for more information on this request? The request stays in your queue."
                      remarkPlaceholder="Note to the employee (required)"
                      remarkLabel="Note to the employee"
                      pendingLabel="Sending…"
                      tone="neutral"
                      idSuffix="ask"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg bg-white p-8 shadow-xl">
        <h2 className="text-lg font-semibold text-[#4a6184]">Your decisions</h2>
        {decided.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">You have not decided any requests yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {decided.map((r) => {
              const n = days(r.startDate, r.endDate);
              return (
                <li key={r.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-800">
                      {r.employee.name} ({r.employee.division}) — {r.leaveType.name}
                      {r.otherLeaveType ? ` (${r.otherLeaveType})` : ""}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {fmtDay(r.startDate)} → {fmtDay(r.endDate)} · {n} day
                    {n === 1 ? "" : "s"}
                  </p>
                  <dl className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                    <div>
                      You decided on {fmtDay(r.decidedAt)}
                      {r.sentToHrAt ? ` · sent to HR ${fmtDay(r.sentToHrAt)}` : ""}
                    </div>
                    {r.hrRemark && (
                      <div>
                        <span className="font-semibold text-slate-600">Your remark:</span>{" "}
                        {r.hrRemark}
                      </div>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
