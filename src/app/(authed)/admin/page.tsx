import { requireRole } from "@/lib/auth";
import {
  adminFilterWhere,
  days,
  DIVISIONS,
  LEAVE_STATUSES,
  LEAVE_TYPE_NAMES,
} from "@/lib/leave-rules";
import { prisma } from "@/lib/prisma";
import StatusBadge from "@/components/StatusBadge";

// FR-08 / design §4: the admin view is read-only — a plain table plus
// query-param filter links. No buttons, no forms, no server actions
// (AC-25: "No buttons anywhere").

function fmtDay(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Keep the other active facets when one link changes a single filter.
function filterHref(
  current: Record<string, string | undefined>,
  key: "status" | "type" | "division",
  value: string | null
): string {
  const params = new URLSearchParams();
  for (const k of ["status", "type", "division"] as const) {
    const v = k === key ? value : current[k];
    if (v) params.set(k, v);
  }
  const q = params.toString();
  return q ? `/admin?${q}` : "/admin";
}

function FilterGroup({
  label,
  paramKey,
  options,
  current,
}: {
  label: string;
  paramKey: "status" | "type" | "division";
  options: readonly string[];
  current: Record<string, string | undefined>;
}) {
  const active = current[paramKey];
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <a
        href={filterHref(current, paramKey, null)}
        className={!active ? "rounded bg-[#4a6184] px-2 py-1 font-medium text-white" : "rounded px-2 py-1 text-slate-600 hover:bg-slate-100"}
      >
        All
      </a>
      {options.map((opt) => (
        <a
          key={opt}
          href={filterHref(current, paramKey, opt)}
          className={active === opt ? "rounded bg-[#4a6184] px-2 py-1 font-medium text-white" : "rounded px-2 py-1 text-slate-600 hover:bg-slate-100"}
        >
          {opt}
        </a>
      ))}
    </div>
  );
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; division?: string }>;
}) {
  await requireRole("Admin");
  const sp = await searchParams;
  // Junk values never reach the query — only the fixed lists are honoured.
  const where = adminFilterWhere(sp);
  const rows = await prisma.leaveRequest.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    include: {
      leaveType: { select: { name: true } },
      employee: { select: { name: true, division: true } },
      supervisor: { select: { name: true } },
      hrOfficer: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg bg-white p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-[#4a6184]">
          All leave records (view only)
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {rows.length} record{rows.length === 1 ? "" : "s"} — read-only, admin
          cannot change any row (brief §5.3.6).
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <FilterGroup label="Status" paramKey="status" options={LEAVE_STATUSES} current={sp} />
          <FilterGroup label="Type" paramKey="type" options={LEAVE_TYPE_NAMES} current={sp} />
          <FilterGroup label="Division" paramKey="division" options={DIVISIONS} current={sp} />
        </div>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No records match these filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Requester</th>
                  <th className="py-2 pr-4 font-semibold">Division</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 pr-4 font-semibold">Dates</th>
                  <th className="py-2 pr-4 font-semibold">Days</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Remarks</th>
                  <th className="py-2 font-semibold">Decided by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-4 text-slate-800">{r.employee.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.employee.division}</td>
                    <td className="py-2 pr-4 text-slate-800">
                      {r.leaveType.name}
                      {r.otherLeaveType ? ` (${r.otherLeaveType})` : ""}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {fmtDay(r.startDate)} → {fmtDay(r.endDate)}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {days(r.startDate, r.endDate)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="max-w-64 py-2 pr-4 text-xs text-slate-600">
                      {r.supervisorRemark && (
                        <div>
                          <span className="font-semibold text-slate-500">Supervisor:</span>{" "}
                          {r.supervisorRemark}
                        </div>
                      )}
                      {r.hrRemark && (
                        <div>
                          <span className="font-semibold text-slate-500">HR:</span>{" "}
                          {r.hrRemark}
                        </div>
                      )}
                      {!r.supervisorRemark && !r.hrRemark && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 text-slate-600">
                      {r.hrOfficer?.name ?? (r.decidedAt ? "HR" : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
