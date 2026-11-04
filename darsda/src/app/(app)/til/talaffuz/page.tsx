import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse } from "@/lib/course";
import { wordsFor } from "@/lib/til";
import { langOf } from "@/lib/lang";
import { Head } from "@/components/ui";
import { Pronounce } from "@/components/Til";

export default async function Talaffuz({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const lid = Number((await searchParams).l || 0);
  const u = await requireUser();
  const c = await currentCourse(u);
  if (!c || c.category !== "til") redirect("/");
  const L = langOf(c.lang);
  const ws = await wordsFor(c.id, u.role === "student" ? u.id : 0, lid, u.role === "student");
  return (
    <main className="page">
      <Head title="🎙 Talaffuz" back={lid ? `/darslar/${lid}` : "/til"} sub="🔊 — eshiting, 🎙 — o'zingiz ayting. 85+ — a'lo, 60+ — yaxshi." />
      <Pronounce words={ws.map((w) => ({ id: w.id, word: w.word, tr: w.tr, translit: w.translit, example: w.example, pron: w.pron }))} lang={L?.speech ?? "en-US"} rtl={L?.rtl} />
    </main>
  );
}
