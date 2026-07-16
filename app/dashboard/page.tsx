import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return <Dashboard adminEmail={session.email} />;
}
