import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/Form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const phone = ((await searchParams).phone || "").replace(/\D/g, "").slice(0, 15);
  const u = await getUser();
  if (u) redirect(u.platform_id ? "/" : "/super");
  return (
    <main className="page plain" style={{ minHeight: "100dvh", justifyContent: "center" }}>
      <div className="stack" style={{ alignItems: "center", marginBottom: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 20 }} />
        <h1 className="h1" style={{ marginBottom: 0 }}>Darsda</h1>
        <p className="sub" style={{ margin: 0 }}>{phone ? "Kerakli panel parolini kiriting" : "Kursingizga kiring"}</p>
      </div>
      <div className="card">
        <ActionForm action={login}>
          <label className="field">
            <span>Telefon raqam</span>
            <input className="input" name="phone" type="tel" inputMode="tel" placeholder="+998 90 123 45 67" autoComplete="tel" required defaultValue={phone ? `+${phone}` : undefined} />
          </label>
          <label className="field">
            <span>Parol</span>
            <input className="input" name="password" type="password" autoComplete="current-password" required autoFocus={!!phone} />
          </label>
          <Submit>Kirish</Submit>
        </ActionForm>
      </div>
      <p className="sub small" style={{ textAlign: "center" }}>
        Akkauntingiz yo&apos;qmi? Kurs administratoridan taklif havolasini so&apos;rang.
      </p>
    </main>
  );
}
