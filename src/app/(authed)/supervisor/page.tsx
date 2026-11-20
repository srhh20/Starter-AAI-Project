import { requireRole } from "@/lib/auth";

export default async function SupervisorHome() {
  await requireRole("Supervisor");

  return (
    <section className="rounded-lg bg-white p-8 shadow-xl">
      <h1 className="text-xl font-semibold text-[#4a6184]">
        Requests awaiting your signature
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Leave requests sent to you will appear here. Signing and rejecting
        come with the next spec.
      </p>
    </section>
  );
}
