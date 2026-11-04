import "server-only";
import type { User } from "./auth";

/** Sinov akkauntlari — super adminning o'z raqamidagi akkauntlar (admin / kurator / o'quvchi).
 *  Ularga hamma kurslar o'rtasida bir bosishda o'tish imkoni beriladi. */
export function isTester(u: Pick<User, "phone">) {
  const p = (process.env.SUPER_PHONE || "").replace(/\D/g, "");
  return !!p && u.phone === p;
}
