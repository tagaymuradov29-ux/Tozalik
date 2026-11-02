import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AttCode } from "@/components/AttCode";

/** Proyektor uchun: katta QR va kod */
export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser(["admin", "curator"]);
  const [l] = await sql<{ id: number; n: number; title: string }[]>`
    select l.id, l.n, l.title from lessons l join courses c on c.id = l.course_id where l.id = ${Number(id) || 0} and c.platform_id = ${u.platform_id}`;
  if (!l) notFound();
  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
      <div style={{ fontSize: "min(4vw, 32px)", fontWeight: 700, textAlign: "center" }}>{l.n}-dars · {l.title}</div>
      <div className="sub" style={{ fontSize: "min(3vw, 20px)" }}>Davomat: telefon kamerasi bilan skanerlang yoki kodni ilovaga kiriting</div>
      <AttCode lessonId={l.id} big />
    </main>
  );
}
