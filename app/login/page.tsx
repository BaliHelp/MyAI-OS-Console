import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";

export default async function LoginPage() {
  // If already logged in, go to dashboard
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  return <LoginScreen />;
}
