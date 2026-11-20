import { requireRole } from "@/lib/auth";

export default async function EmployeeHome() {
  await requireRole("Employee");

  return (
    <section className="rounded-lg bg-white p-8 shadow-xl">
      <h1 className="text-xl font-semibold text-[#4a6184]">
        My leave requests
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Your leave requests will appear here. The request form and status
        tracking come with the next spec.
      </p>
    </section>
  );
}
