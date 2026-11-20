import { requireRole } from "@/lib/auth";
import { candidateSupervisors, days } from "@/lib/leave-rules";
import { prisma } from "@/lib/prisma";
import { editLeave, sendToHrLeave, submitLeave } from "@/app/actions/leave";
import ConfirmActionButton from "@/components/ConfirmActionButton";
import EditRequestDisclosure from "@/components/EditRequestDisclosure";
import LeaveRequestForm from "@/components/LeaveRequestForm";
import StatusBadge from "@/components/StatusBadge";

// FR-07: the success banner after each write action (?msg= redirect,
// design §3 rule 8). Keys grow as later tasks land their actions.
const BANNERS: Record<string, string> = {
  submitted:
    "Your leave request was submitted. It now waits for your supervisor's signature.",
  sent: "Your request was sent to HR. The decision is now with the HR officers.",
  edited: "Your changes were saved. The request still waits for your supervisor's signature.",
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

export default async function EmployeeHome({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireRole("Employee");
  const [{ msg }, leaveTypes, requests, supervisors] = await Promise.all([
    searchParams,
    prisma.leaveType.findMany({ orderBy: { id: "asc" } }),
    prisma.leaveRequest.findMany({
      where: { employeeId: user.id },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      include: {
        leaveType: { select: { name: true } },
        supervisor: { select: { name: true } },
        hrOfficer: { select: { name: true } },
      },
    }),
    candidateSupervisors(user),
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
        <h1 className="text-xl font-semibold text-[#4a6184]">My leave requests</h1>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            You have no leave requests yet — submit your first one below.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-slate-200 p-4"
                data-testid={`request-${r.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {r.leaveType.name}
                    {r.otherLeaveType ? ` — ${r.otherLeaveType}` : ""}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {fmtDay(r.startDate)} → {fmtDay(r.endDate)} ·{" "}
                  {days(r.startDate, r.endDate)} day
                  {days(r.startDate, r.endDate) === 1 ? "" : "s"} · supervisor{" "}
                  {r.supervisor.name}
                </p>
                <dl className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                  <div>Submitted {fmtDay(r.submittedAt)}</div>
                  {r.signedAt && (
                    <div>
                      Signed by {r.supervisor.name} on {fmtDay(r.signedAt)}
                    </div>
                  )}
                  {r.sentToHrAt && <div>Sent to HR on {fmtDay(r.sentToHrAt)}</div>}
                  {r.decidedAt && (
                    <div>
                      Decided by {r.hrOfficer?.name ?? "HR"} on {fmtDay(r.decidedAt)}
                    </div>
                  )}
                  {r.supervisorRemark && (
                    <div>
                      <span className="font-semibold text-slate-600">Supervisor remark:</span>{" "}
                      {r.supervisorRemark}
                    </div>
                  )}
                  {r.hrRemark && (
                    <div>
                      <span className="font-semibold text-slate-600">HR remark:</span>{" "}
                      {r.hrRemark}
                    </div>
                  )}
                  {/* X3/AC-28: a queue note from HR, status untouched */}
                  {r.infoNote && (
                    <div>
                      <span className="font-semibold text-slate-600">HR asked:</span>{" "}
                      {r.infoNote}{" "}
                      <span className="text-slate-400">({fmtDay(r.infoNoteAt)})</span>
                    </div>
                  )}
                </dl>
                {/* AC-20: Send to HR shows only on my own Signed rows */}
                {r.status === "Signed" && (
                  <div className="mt-3">
                    <ConfirmActionButton
                      label="Send to HR"
                      confirmText="Are you sure you want to send this request to HR?"
                      action={sendToHrLeave}
                      fields={{ id: String(r.id) }}
                    />
                  </div>
                )}
                {/* X2/AC-27: edit exists only on my own Pending supervisor rows */}
                {r.status === "Pending supervisor" && (
                  <div className="mt-3">
                    <EditRequestDisclosure>
                      <LeaveRequestForm
                        action={editLeave}
                        leaveTypes={leaveTypes}
                        supervisors={supervisors.map((s) => ({ id: s.id, name: s.name }))}
                        idPrefix={`edit-${r.id}`}
                        requestId={r.id}
                        submitLabel="Save changes"
                        pendingLabel="Saving…"
                        confirmText="Are you sure you want to save your changes to this request?"
                        initial={{
                          leaveTypeId: r.leaveTypeId,
                          supervisorId: r.supervisorId,
                          startDate: r.startDate.toISOString().slice(0, 10),
                          endDate: r.endDate.toISOString().slice(0, 10),
                          otherLeaveType: r.otherLeaveType,
                        }}
                      />
                    </EditRequestDisclosure>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg bg-white p-8 shadow-xl">
        <h2 className="text-lg font-semibold text-[#4a6184]">New request</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick a type, the dates, and a supervisor from your own division
          (brief §5.3.3). You will confirm before it is submitted.
        </p>
        <div className="mt-4">
          <LeaveRequestForm
            action={submitLeave}
            leaveTypes={leaveTypes}
            supervisors={supervisors.map((s) => ({ id: s.id, name: s.name }))}
          />
        </div>
      </section>
    </div>
  );
}
