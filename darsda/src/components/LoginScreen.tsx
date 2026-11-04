import { login } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/Form";

/** Kirish ekrani (dizayn: brend rangidagi yuqori qism + telefon). Kod orqali kirish bot ulangach yoqiladi. */
export function LoginScreen({
  name, logo, welcome, platformId, phone,
}: { name: string; logo?: string; welcome?: string; platformId?: number; phone?: string }) {
  const local = phone?.startsWith("998") ? phone.slice(3) : phone;
  return (
    <main className="login">
      <div className="login-hero">
        <svg className="login-deco" viewBox="0 0 390 330" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
          <circle cx="330" cy="70" r="120" fill="rgba(255,255,255,0.08)" />
          <circle cx="340" cy="60" r="60" fill="rgba(255,255,255,0.08)" />
          <path d="M300 120 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#FFE14D" />
          <path d="M250 60 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#FFFFFF" />
        </svg>
        <div className="login-logo">
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt="" width={56} height={56} />
            : <span>{abbr(name)}</span>}
        </div>
        <h1>{/\p{L}$/u.test(name) ? `${name}ga` : `${name} ga`} xush kelibsiz</h1>
        <p>{welcome || "Darslar, vazifalar va natijalaringiz — bitta joyda."}</p>
      </div>
      <div className="login-body">
        <ActionForm action={login}>
          {platformId ? <input type="hidden" name="platform" value={platformId} /> : null}
          <label className="field">
            <span>Telefon raqamingiz</span>
            <div className="row" style={{ gap: 8 }}>
              <span className="login-cc">+998</span>
              <input className="input login-phone" name="phone" type="tel" inputMode="tel" placeholder="90 123 45 67"
                autoComplete="tel-national" required defaultValue={local || undefined} />
            </div>
          </label>
          <label className="field">
            <span>Parol</span>
            <input className="input" name="password" type="password" autoComplete="current-password" required autoFocus={!!phone} />
          </label>
          <Submit>Kirish</Submit>
        </ActionForm>
        <div className="login-soon">
          <b>Tez kunda: parolsiz kirish</b>
          <span>Kod Telegram&apos;dagi «Darsda» botiga yoki SMS orqali keladi.</span>
        </div>
        <p className="sub small" style={{ textAlign: "center", margin: 0 }}>
          Akkauntingiz yo&apos;qmi? Kuratoringizdan taklif havolasini so&apos;rang.
        </p>
      </div>
    </main>
  );
}

export function abbr(name: string) {
  const w = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "D";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  const num = w.find((x) => /^\d/.test(x));
  return (w[0][0] + (num ? num[0] : w[1][0])).toUpperCase();
}
