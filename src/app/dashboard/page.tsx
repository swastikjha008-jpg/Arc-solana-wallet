import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { Dashboard } from "@/components/wallet/Dashboard";
import { SiteHeader } from "@/components/brand/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — arc" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <>
      <SiteHeader />
      <Dashboard username={user.username} cluster={getEnv().SOLANA_CLUSTER} />
    </>
  );
}
