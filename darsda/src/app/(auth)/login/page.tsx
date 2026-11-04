import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const phone = ((await searchParams).phone || "").replace(/\D/g, "").slice(0, 15);
  const u = await getUser();
  if (u) redirect(u.platform_id ? "/" : "/super");
  return <LoginScreen name="Darsda" logo="/icon-192.png" phone={phone} welcome="O'quv platformasi. Kursingizga kiring." />;
}
