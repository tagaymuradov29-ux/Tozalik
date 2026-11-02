import { brandCss, fontOf, type Brand } from "@/lib/platform";
import { fontUrl } from "@/lib/journeys";

/** Platforma rangi, foni va shriftini sahifaga qo'llaydi */
export function BrandStyle({ b }: { b: Brand | null }) {
  if (!b) return null;
  const font = fontOf(b);
  return (
    <>
      {font && font !== "Inter" && font !== "Onest" && <link rel="stylesheet" href={fontUrl([font])} />}
      <style dangerouslySetInnerHTML={{ __html: brandCss(b.color, font, !!b.settings?.tint) }} />
    </>
  );
}
