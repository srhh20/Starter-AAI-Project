import { requireUser } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

// Shared shell for the four role homes (design §4): anyone anonymous or
// tampered is bounced to /login before any page content renders.
export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#5b82bd_0%,#7fa0d3_35%,#aec6e8_65%,#dfeaf7_100%)]">
      <header className="bg-[#4a6184]/95 shadow-md backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span className="text-lg font-light tracking-[0.12em] text-white">
            Budiman HRMS
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/90">
              {user.name} <span className="text-white/60">· {user.role}</span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
