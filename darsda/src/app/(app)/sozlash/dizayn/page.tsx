import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBrand } from "@/lib/platform";
import { FONTS, fontUrl, journey } from "@/lib/journeys";
import { Head } from "@/components/ui";
import { DesignForm } from "@/components/DesignForm";

export default async function Dizayn() {
  const u = await requireUser(["admin"]);
  const b = await getBrand(u.platform_id);
  if (!b) redirect("/");
  return (
    <main className="page">
      {/* Shriftlarni ko'rsatish uchun hammasi shu sahifada yuklanadi */}
      <link rel="stylesheet" href={fontUrl(FONTS.map((f) => f.family).filter((f) => f && f !== "Inter" && f !== "Onest"))} />
      <Head title="🎨 Dizayn" back="/sozlash" sub="Rang, shrift va ballar animatsiyasini tanlang — o'quvchilar ilovasi shunday ko'rinadi" />
      <div className="card">
        <DesignForm color={b.color} font={b.settings.font ?? ""} journey={journey(b.settings.journey).key} tint={!!b.settings.tint} road={b.settings.road ?? "bahor"} />
      </div>
    </main>
  );
}
