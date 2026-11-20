import { requireRole } from "@/lib/auth";

export default async function HrHome() {
  await requireRole("HR");

  return (
    <section className="rounded-lg bg-white p-8 shadow-xl">
      <h1 className="text-xl font-semibold text-[#4a6184]">
        Pending HR queue
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Requests waiting for an HR decision will appear here. Approval and
        rejection come with the next spec.
      </p>
    </section>
  );
}
