import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { sql } from "./db";

export type Role = "super" | "admin" | "curator" | "student";

export type User = {
  id: number;
  platform_id: number | null;
  phone: string;
  name: string;
  role: Role;
  group_id: number | null;
  platform_name: string | null;
  platform_slug: string | null;
  color: string;
  tz: string;
};

const COOKIE = "sess";
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export async function startSession(uid: number) {
  const token = await new SignJWT({ uid })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let uid: number;
  try {
    const { payload } = await jwtVerify(token, key());
    uid = Number(payload.uid);
  } catch {
    return null;
  }
  const [u] = await sql<User[]>`
    select u.id, u.platform_id, u.phone, u.name, u.role, u.group_id,
      p.name as platform_name, p.slug as platform_slug,
      coalesce(p.color, '#0B5D46') as color, coalesce(p.tz, 'Asia/Tashkent') as tz
    from users u left join platforms p on p.id = u.platform_id
    where u.id = ${uid} and u.active`;
  return u ?? null;
});

export async function requireUser(roles?: Role[]): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.role)) redirect("/");
  return u;
}

export const isStaff = (u: User) => u.role === "admin" || u.role === "curator";

export function normPhone(p: string) {
  const d = p.replace(/\D/g, "");
  return d.length === 9 ? "998" + d : d;
}
