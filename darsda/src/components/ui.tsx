import Link from "next/link";
import { IBack, IChevron } from "./icons";
import { initials } from "@/lib/util";
import { Submit } from "./Form";
import type { TaskState } from "@/lib/course";

export function Head({ title, back, right, sub }: { title: string; back?: string; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      {back ? (
        <div className="topbar">
          <Link href={back} className="back" aria-label="Orqaga"><IBack size={18} /></Link>
          <div className="grow h2 trunc">{title}</div>
          {right}
        </div>
      ) : (
        <div className="row between">
          <h1 className="h1 trunc">{title}</h1>
          {right}
        </div>
      )}
      {sub && <div className="sub" style={{ marginTop: back ? 4 : -6 }}>{sub}</div>}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>;
}

export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="li">
      {children}
      <span className="muted"><IChevron /></span>
    </Link>
  );
}

const ST: Record<TaskState, [string, string]> = {
  locked: ["", "Hali ochilmagan"],
  todo: ["info", "Bajarish kerak"],
  late: ["bad", "Muddati o'tgan"],
  pending: ["warn", "Tekshirilmoqda"],
  done: ["ok", "Qabul qilindi"],
  rejected: ["bad", "Qaytarildi"],
};
export function StateBadge({ s }: { s: TaskState }) {
  const [c, t] = ST[s];
  return <span className={`pill ${c}`}>{t}</span>;
}

export function Progress({ value }: { value: number }) {
  return <div className="progress"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

/** Bitta tugmali forma: qiymatlar yashirin maydonlarda (tugmaning name/value'siga bog'liq emas) */
export function ActBtn({
  action, fields, className, style, children, confirm,
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string | number>;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  confirm?: string;
}) {
  return (
    <form action={action} style={{ display: "contents" }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Submit className={className} style={style} confirm={confirm}>{children}</Submit>
    </form>
  );
}

const TILE = ["var(--brand)", "#0F766E", "#B45309", "#DB2777", "#2563EB", "#7C3AED"];
/** Kurs tanlash kartasi: rangli kvadrat (qisqartma), nom, izoh va rol belgisi */
export function CourseTile({ title, sub, code, i, current, role }: { title: string; sub?: string; code: string; i: number; current?: boolean; role?: string }) {
  return (
    <span className={`pick${current ? " on" : ""}`}>
      <span className="pick-ic" style={{ background: current ? "var(--brand)" : TILE[i % TILE.length] }}>{code}</span>
      <span className="grow stack" style={{ gap: 3, minWidth: 0 }}>
        <b className="trunc" style={{ fontSize: 16 }}>{title}</b>
        {sub && <span className="small muted trunc">{sub}</span>}
      </span>
      {role && <span className={`pill ${role === "Kurator" ? "teal" : role === "O'quvchi" ? "info" : role === "Hozir" ? "ok" : "warn"}`}>{role}</span>}
    </span>
  );
}
