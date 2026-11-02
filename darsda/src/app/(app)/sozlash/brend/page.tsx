import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/platform";
import { Head } from "@/components/ui";
import { BrandForm } from "@/components/BrandForm";

export default async function Brend() {
  const u = await requireUser(["admin"]);
  const b = await getBrand(u.platform_id);
  if (!b) redirect("/");
  return (
    <main className="page">
      <Head title="🎨 Brend" back="/sozlash" sub="Platforma sizning nomingiz, logongiz va rangingiz bilan ko'rinadi" />
      <div className="card">
        <BrandForm name={b.name} slug={b.slug} color={b.color} welcome={b.settings.welcome ?? ""} logo={b.settings.logo} />
      </div>
    </main>
  );
}
