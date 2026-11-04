import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { brandBySlug } from "@/lib/platform";
import { BrandStyle } from "@/components/BrandStyle";
import { LoginScreen } from "@/components/LoginScreen";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const b = await brandBySlug((await params).slug);
  return b ? { title: b.name, appleWebApp: { capable: true, title: b.name, statusBarStyle: "default" } } : {};
}

/** Har bir mijoz platformasining o'z kirish sahifasi: logo, nom, rang va salomlashuv matni */
export default async function BrandLogin({ params }: P) {
  const b = await brandBySlug((await params).slug);
  if (!b) notFound();
  const u = await getUser();
  if (u) redirect(u.platform_id ? "/" : "/super");
  return (
    <>
      <BrandStyle b={b} />
      <LoginScreen name={b.name} logo={b.settings.logo} welcome={b.settings.welcome} platformId={b.id} />
    </>
  );
}
