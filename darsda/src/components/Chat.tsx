"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ISend } from "./icons";

type Msg = { id: number; text: string; created_at: string; user_id: number; name: string; role: string };
const ROLE: Record<string, string> = { admin: "admin", curator: "kurator" };

export function Chat({ groupId, me, tz }: { groupId: number; me: number; tz: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/chat?g=${groupId}&after=${last.current}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const { msgs: m } = (await r.json()) as { msgs: Msg[] };
    if (m.length) {
      last.current = m[m.length - 1].id;
      setMsgs((x) => [...x, ...m]);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [groupId]);

  useEffect(() => {
    last.current = 0;
    setMsgs([]);
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 3000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ g: groupId, text: v }) });
    setText("");
    setBusy(false);
    load();
  };

  const time = (s: string) => new Intl.DateTimeFormat("uz", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(s));

  return (
    <>
      <div className="chat" style={{ paddingBottom: 70 }}>
        {!msgs.length && <div className="empty">Hali xabar yo&apos;q. Birinchi bo&apos;lib yozing!</div>}
        {msgs.map((m, i) => {
          const mine = m.user_id === me;
          const showName = !mine && msgs[i - 1]?.user_id !== m.user_id;
          return (
            <div key={m.id} className={`msg ${mine ? "me" : ""}`}>
              {showName && <div className="who">{m.name}{ROLE[m.role] ? ` · ${ROLE[m.role]}` : ""}</div>}
              {m.text}
              <div className="at">{time(m.created_at)}</div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Xabar yozing…" enterKeyHint="send" />
        <button className="btn" disabled={busy || !text.trim()} aria-label="Yuborish"><ISend size={20} /></button>
      </form>
    </>
  );
}
