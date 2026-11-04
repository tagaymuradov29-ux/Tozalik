import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentCourse } from "@/lib/course";
import { Head } from "@/components/ui";
import { Alphabet } from "@/components/Til";

export default async function Alifbo() {
  const u = await requireUser();
  const c = await currentCourse(u);
  if (!c || c.category !== "til" || c.lang !== "ar") redirect("/");
  return (
    <main className="page">
      <Head title="🔤 Arab alifbosi" back="/til" sub="Harfni bosing — eshitasiz. O'ngdan chapga o'qiladi." />
      <Alphabet />
    </main>
  );
}
