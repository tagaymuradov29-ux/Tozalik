import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse } from "@/lib/course";
import { langOf } from "@/lib/lang";
import { Head } from "@/components/ui";
import { Suhbat } from "@/components/Suhbat";

export default async function SuhbatPage() {
  const u = await requireUser();
  const c = await currentCourse(u);
  if (!c || c.category !== "til") redirect("/");
  const L = langOf(c.lang);
  return (
    <main className="page">
      <Head title="🤖 AI bilan suhbat" back="/til" sub={`${L?.flag ?? ""} ${L?.name ?? ""} · robot gapiradi, siz javob berasiz`} />
      <Suhbat lang={c.lang} speech={L?.speech ?? "en-US"} rtl={L?.rtl} />
    </main>
  );
}
