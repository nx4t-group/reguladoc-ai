import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/tenant";

export default async function RootPage() {
  const session = await getCurrentSession();
  redirect(session?.user ? "/painel" : "/login");
}
