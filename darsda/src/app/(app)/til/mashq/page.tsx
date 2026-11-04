import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse } from "@/lib/course";
import { wordsFor } from "@/lib/til";
import { langOf } from "@/lib/lang";
import { Head } from "@/components/ui";
import { Flashcards } from "@/components/Til";

export default async function Mashq({ searchParams }: { searchParams: Promise<{ l?: string; dir?: string; m?: string }> }) {
  const sp = await searchParams;
  const lid = Number(sp.l || 0), dir = sp.dir === "rev" ? "rev" : "fwd", unk = sp.m === "bilmagan";
  const u = await requireUser(["student"]);
  const c = await currentCourse(u);
  if (!c || c.category !== "til") redirect("/");
  const L = langOf(c.lang);
  const ws = await wordsFor(c.id, u.id, lid);
  const now = Date.now();
  // Avval vaqti kelgan takrorlashlar, keyin 10 tagacha yangi so'z (dars bo'yicha mashqda — hammasi)
  const due = ws.filter((w) => (w.box ?? 0) >= 1 && new Date(w.due_at!).getTime() <= now);
  const fresh = ws.filter((w) => !w.box);
  const cards = unk ? ws.filter((w) => w.unknown) : lid ? ws : [...due, ...fresh.slice(0, 10)];
  return (
    <main className="page">
      <Head title={unk ? "🔁 Bilmagan so'zlarim" : "🃏 So'z kartochkalari"} back={lid ? `/darslar/${lid}` : "/til"} sub={unk ? "Bilmagan so'zlarni qayta takrorlang" : lid ? "Shu dars so'zlari" : "Takrorlash va yangi so'zlar"} />
      <div className="seg">
        <Link href={`/til/mashq?${new URLSearchParams({ ...(lid ? { l: String(lid) } : {}), ...(unk ? { m: "bilmagan" } : {}) })}`} className={dir === "fwd" ? "on" : ""}>{L?.flag ?? ""} → 🇺🇿</Link>
        <Link href={`/til/mashq?${new URLSearchParams({ ...(lid ? { l: String(lid) } : {}), ...(unk ? { m: "bilmagan" } : {}), dir: "rev" })}`} className={dir === "rev" ? "on" : ""}>🇺🇿 → {L?.flag ?? ""}</Link>
      </div>
      <Flashcards cards={cards.map((w) => ({ id: w.id, word: w.word, tr: w.tr, translit: w.translit, example: w.example, image: w.image }))} dir={dir} lang={L?.speech ?? "en-US"} rtl={L?.rtl} back={lid ? `/darslar/${lid}` : "/til"} />
    </main>
  );
}
