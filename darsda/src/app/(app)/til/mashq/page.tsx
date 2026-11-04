import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse } from "@/lib/course";
import { wordsFor } from "@/lib/til";
import { langOf } from "@/lib/lang";
import { Head } from "@/components/ui";
import { Flashcards } from "@/components/Til";

export default async function Mashq({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const lid = Number((await searchParams).l || 0);
  const u = await requireUser(["student"]);
  const c = await currentCourse(u);
  if (!c || c.category !== "til") redirect("/");
  const L = langOf(c.lang);
  const ws = await wordsFor(c.id, u.id, lid);
  const now = Date.now();
  // Avval vaqti kelgan takrorlashlar, keyin 10 tagacha yangi so'z (dars bo'yicha mashqda — hammasi)
  const due = ws.filter((w) => (w.box ?? 0) >= 1 && new Date(w.due_at!).getTime() <= now);
  const fresh = ws.filter((w) => !w.box);
  const cards = lid ? ws : [...due, ...fresh.slice(0, 10)];
  return (
    <main className="page">
      <Head title="🃏 So'z kartochkalari" back={lid ? `/darslar/${lid}` : "/til"} sub={lid ? "Shu dars so'zlari" : "Takrorlash va yangi so'zlar"} />
      <Flashcards cards={cards.map((w) => ({ id: w.id, word: w.word, tr: w.tr, translit: w.translit, example: w.example }))} lang={L?.speech ?? "en-US"} rtl={L?.rtl} back={lid ? `/darslar/${lid}` : "/til"} />
    </main>
  );
}
