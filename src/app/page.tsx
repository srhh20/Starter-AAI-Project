import { redirect } from "next/navigation";

import { getServerUser, roleHome } from "@/lib/auth";

// U8/AC-09: the root never renders — signed in goes to your home,
// anonymous goes to the login page.
export default async function Home() {
  const user = await getServerUser();
  redirect(user ? roleHome(user.role) : "/login");
}
