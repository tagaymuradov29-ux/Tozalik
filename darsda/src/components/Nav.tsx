"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IBook, IChart, IChat, IHome, IPlus, IQr, IReview, IUser, IUsers } from "./icons";

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number; fab?: boolean };

export function Nav({ role, review, unread, chat = true }: { role: string; review: number; unread: number; chat?: boolean }) {
  const path = usePathname();
  const items: Item[] =
    role === "student"
      ? [
          { href: "/", label: "Bugun", icon: <IHome />, badge: unread },
          { href: "/darslar", label: "Darslar", icon: <IBook /> },
          { href: "/yuborish", label: "", icon: <IPlus size={24} />, fab: true },
          { href: "/chat", label: "Chat", icon: <IChat /> },
          { href: "/natijalar", label: "Natijalar", icon: <IChart /> },
        ]
      : role === "curator"
        ? [
            { href: "/", label: "Bugun", icon: <IHome />, badge: unread },
            { href: "/tekshirish", label: "Tekshirish", icon: <IReview />, badge: review },
            { href: "/davomat", label: "", icon: <IQr size={23} />, fab: true },
            { href: "/chat", label: "Chat", icon: <IChat /> },
            { href: "/guruh", label: "Guruh", icon: <IUsers /> },
          ]
        : [
            { href: "/", label: "Bugun", icon: <IHome />, badge: unread },
            { href: "/darslar", label: "Darslar", icon: <IBook /> },
            { href: "/davomat", label: "", icon: <IQr size={23} />, fab: true },
            { href: "/tekshirish", label: "Tekshirish", icon: <IReview />, badge: review },
            { href: "/guruh", label: "Odamlar", icon: <IUsers /> },
          ];
  // Chat o'chirilgan bo'lsa, uning o'rnida Profil turadi
  const me: Item = { href: "/profil", label: "Profil", icon: <IUser /> };
  if (!chat) items.forEach((it, i) => { if (it.href === "/chat") items[i] = me; });
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <nav className="nav">
      {items.map((it) =>
        it.fab ? (
          <Link key={it.href} href={it.href} aria-label="Qo'shish">
            <span className="fab">{it.icon}</span>
          </Link>
        ) : (
          <Link key={it.href} href={it.href} className={active(it.href) ? "on" : ""}>
            {it.icon}
            <span>{it.label}</span>
            {!!it.badge && <span className="badge">{it.badge > 99 ? "99+" : it.badge}</span>}
          </Link>
        ),
      )}
    </nav>
  );
}
