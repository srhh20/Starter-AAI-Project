import { requireRole } from "@/lib/auth";

export default async function AdminHome() {
  await requireRole("Admin");

  return (
    <section className="rounded-lg bg-white p-8 shadow-xl">
      <h1 className="text-xl font-semibold text-[#4a6184]">
        All leave records (view only)
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Every leave record will appear here, read-only. The record view comes
        with the next spec.
      </p>
    </section>
  );
}
