import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { brandBySlug, brandCss } from "@/lib/platform";
import { ActionForm, Submit } from "@/components/Form";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const b = await brandBySlug((await params).slug);
  return b ? { title: b.name, appleWebApp: { capable: true, title: b.name, statusBarStyle: "default" } } : {};
}

/** Har bir mijoz platformasining o'z kirish sahifasi: logo, nom, rang va salomlashuv matni */
export default async function BrandLogin({ params }: P) {
  const b = await brandBySlug((await params).slug);
  if (!b) notFound();
  const u = await getUser();
  if (u) redirect(u.platform_id ? "/" : "/super");
  return (
    <main className="page plain" style={{ minHeight: "100dvh", justifyContent: "center" }}>
      <style dangerouslySetInnerHTML={{ __html: brandCss(b.color) }} />
      <div className="stack" style={{ alignItems: "center", marginBottom: 12, textAlign: "center" }}>
        {b.settings.logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={b.settings.logo} alt="" width={80} height={80} style={{ borderRadius: 20, objectFit: "contain", background: "#fff" }} />
          : <span style={{ width: 80, height: 80, borderRadius: 20, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 32 }}>{b.name[0]?.toUpperCase()}</span>}
        <h1 className="h1" style={{ marginBottom: 0 }}>{b.name}</h1>
        <p className="sub" style={{ margin: 0 }}>{b.settings.welcome || "Kursingizga kiring"}</p>
      </div>
      <div className="card">
        <ActionForm action={login}>
          <input type="hidden" name="platform" value={b.id} />
          <label className="field">
            <span>Telefon raqam</span>
            <input className="input" name="phone" type="tel" inputMode="tel" placeholder="+998 90 123 45 67" autoComplete="tel" required />
          </label>
          <label className="field">
            <span>Parol</span>
            <input className="input" name="password" type="password" autoComplete="current-password" required />
          </label>
          <Submit>Kirish</Submit>
        </ActionForm>
      </div>
      <p className="sub small" style={{ textAlign: "center" }}>Akkauntingiz yo&apos;qmi? Kuratoringizdan taklif havolasini so&apos;rang.</p>
    </main>
  );
}
