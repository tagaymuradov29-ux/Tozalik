import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";

/** Yuborilgan faylni ko'rsatadi: egasi yoki shu platformadagi xodim */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getUser();
  if (!u || !/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [f] = await sql<{ name: string; type: string; data: Buffer; user_id: number }[]>`
    select name, type, data, user_id from files where id = ${id} and platform_id = ${u.platform_id ?? 0}`;
  if (!f || (u.role === "student" && f.user_id !== u.id)) return new Response("Not found", { status: 404 });
  const inline = /^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf|video\/)/.test(f.type);
  return new Response(new Uint8Array(f.data), {
    headers: {
      "content-type": inline ? f.type : "application/octet-stream",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
