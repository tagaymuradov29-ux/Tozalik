import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBrand, label, MODS, on } from "@/lib/platform";
import { Head } from "@/components/ui";
import { ActionForm, Submit } from "@/components/Form";
import { saveMods } from "@/app/actions/build";

export default async function Modullar() {
  const u = await requireUser(["admin"]);
  const b = await getBrand(u.platform_id);
  if (!b) redirect("/");
  return (
    <main className="page">
      <Head title="🧩 Modullar" back="/sozlash" sub="Kursingizga keraklisini yoqing. Nomini o'zingizga moslab o'zgartirishingiz mumkin." />
      <ActionForm action={saveMods}>
        {MODS.map((m) => (
          <div key={m.key} className="card tight">
            <label className="row between" style={{ cursor: "pointer" }}>
              <span className="row" style={{ gap: 10 }}>
                <span style={{ fontSize: 22 }}>{m.emoji}</span>
                <span className="stack" style={{ gap: 0 }}>
                  <b>{label(b, m.key)}</b>
                  <span className="tiny muted">{m.about}</span>
                  <span className="tiny" style={{ color: "var(--brand-ink)" }}>Yoqsangiz: {m.why}</span>
                </span>
              </span>
              <input type="checkbox" className="switch" name={`on_${m.key}`} defaultChecked={on(b, m.key)} />
            </label>
            <input className="input" name={`label_${m.key}`} defaultValue={label(b, m.key)} placeholder={m.label} maxLength={40} aria-label="Nomi" />
          </div>
        ))}
        <p className="tiny muted" style={{ margin: 0 }}>Darslar, vazifalar, davomat va yo&apos;l xaritasi — asosiy qism, ular doim yoqilgan. «Tanishuvlar osmoni» networking ma&apos;lumotidan chiziladi.</p>
        <Submit>Saqlash</Submit>
      </ActionForm>
    </main>
  );
}
