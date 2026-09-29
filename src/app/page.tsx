import { redirect } from "next/navigation";
import { getSession } from "@/lib/dal";
import { homeFor } from "@/lib/auth/roles";

// proxy.ts ya redirige "/" por rol; esto cubre el caso en que el proxy no corra.
export default async function Home() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/login");
}
