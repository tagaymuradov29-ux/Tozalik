"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Panellar bir-biri bilan sinxron turishi uchun: ilovaga qaytganda va har 30 soniyada ma'lumotni yangilaydi
 *  (yangi yuborilgan vazifa, baho, xabarlar soni). Yozayotgan bo'lsangiz — kutadi. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const typing = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
    };
    const tick = (force = false) => {
      if (document.visibilityState !== "visible" || typing()) return;
      if (!force && Date.now() - last < 25000) return;
      last = Date.now();
      router.refresh();
    };
    const onVis = () => tick(true);
    const id = setInterval(() => tick(), 30000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [router]);
  return null;
}
