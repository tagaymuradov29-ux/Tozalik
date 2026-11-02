import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { currentCourse } from "@/lib/course";
import { Head } from "@/components/ui";
import { Chat } from "@/components/Chat";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const u = await requireUser();
  const course = await currentCourse(u);
  const groups = course
    ? await sql<{ id: number; name: string }[]>`
        select id, name from groups where course_id = ${course.id}
          and (${u.role === "admin"} or (${u.role === "curator"} and curator_id = ${u.id}) or id = ${u.role === "student" ? u.group_id ?? 0 : 0})
        order by name`
    : [];
  const want = Number((await searchParams).g || 0);
  const g = groups.find((x) => x.id === want) ?? groups[0];
  if (!g) return <main className="page"><Head title="Chat" /><div className="card empty">Guruh yo&apos;q</div></main>;
  return (
    <main className="page">
      <Head title="Chat" sub={`${g.name} · guruh chati`} />
      {groups.length > 1 && (
        <div className="row" style={{ gap: 6, overflowX: "auto" }}>
          {groups.map((x) => (
            <Link key={x.id} href={`/chat?g=${x.id}`} className={`pill ${x.id === g.id ? "ok" : ""}`} style={{ padding: "8px 14px" }}>{x.name}</Link>
          ))}
        </div>
      )}
      <Chat key={g.id} groupId={g.id} me={u.id} tz={u.tz} />
    </main>
  );
}
