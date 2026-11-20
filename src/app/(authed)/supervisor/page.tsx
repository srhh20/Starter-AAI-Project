import { requireRole } from "@/lib/auth";
import { days } from "@/lib/leave-rules";
import { prisma } from "@/lib/prisma";
import { rejectSupervisorLeave, signLeave } from "@/app/actions/leave";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import RejectRequestForm from "@/components/RejectRequestForm";
import StatusBadge from "@/components/StatusBadge";

// FR-07: success banners after each write action (design §3 rule 8).
const BANNERS: Record<string, string> = {
  signed: "You signed the request. The employee can now send it to HR.",
  rejected: "You rejected the request with your remark. The employee is notified in their list.",
  failed: "That action is no longer available for this request.",
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

function DateLine({
  startDate,
  endDate,
}: {
  startDate: Date;
  endDate: Date;
}) {
  const n = days(startDate, endDate);
  return (
    <>
      {fmtDay(startDate)} → {fmtDay(endDate)} · {n} day{n === 1 ? "" : "s"}
    </>
  );
}

export default async function SupervisorHome({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireRole("Supervisor");
  const include = {
    leaveType: { select: { name: true } },
    employee: { select: { name: true } },
  } as const;
  const [{ msg }, queue, handled] = await Promise.all([
    searchParams,
    prisma.leaveRequest.findMany({
      where: { supervisorId: user.id, status: "Pending supervisor" },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      include,
    }),
    prisma.leaveRequest.findMany({
      where: { supervisorId: user.id, status: { not: "Pending supervisor" } },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      include,
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
        <h1 className="text-xl font-semibold text-[#4a6184]">For you to sign</h1>
        {queue.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Nothing is waiting for your signature.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {queue.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {r.employee.name} — {r.leaveType.name}
                    {r.otherLeaveType ? ` (${r.otherLeaveType})` : ""}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  <DateLine startDate={r.startDate} endDate={r.endDate} /> · submitted{" "}
                  {fmtDay(r.submittedAt)}
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  <ConfirmActionButton
                    label="Sign"
                    confirmText="Are you sure you want to sign this request?"
                    action={signLeave}
                    fields={{ id: String(r.id) }}
                  />
                  <RejectRequestForm
                    action={rejectSupervisorLeave}
                    id={r.id}
                    label="Reject"
                    confirmText="Are you sure you want to reject this request? The remark becomes the employee's reason."
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg bg-white p-8 shadow-xl">
        <h2 className="text-lg font-semibold text-[#4a6184]">Handled by you</h2>
        {handled.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            You have not handled any requests yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {handled.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {r.employee.name} — {r.leaveType.name}
                    {r.otherLeaveType ? ` (${r.otherLeaveType})` : ""}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  <DateLine startDate={r.startDate} endDate={r.endDate} />
                </p>
                <dl className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                  {r.signedAt && <div>You signed on {fmtDay(r.signedAt)}</div>}
                  {r.sentToHrAt && <div>Employee sent to HR on {fmtDay(r.sentToHrAt)}</div>}
                  {r.decidedAt && (
                    <div>
                      HR decided on {fmtDay(r.decidedAt)}
                      {r.hrRemark ? ` — ${r.hrRemark}` : ""}
                    </div>
                  )}
                  {r.supervisorRemark && (
                    <div>
                      <span className="font-semibold text-slate-600">Your remark:</span>{" "}
                      {r.supervisorRemark}
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
