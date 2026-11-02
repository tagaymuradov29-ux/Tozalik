"use client";
import { useRef, useState, useTransition } from "react";
import { submitTask } from "@/app/actions/student";

/** Rasmni 1600px gacha kichraytirib JPEG qiladi — yuklash tez va 4 MB limitga sig'adi */
async function compress(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.type === "image/gif" || f.size < 600 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.82));
    return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return f;
  }
}

export function SubmitForm({ taskId, kind }: { taskId: number; kind: string }) {
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const wantFiles = kind === "file" || kind === "repeat";
  const wantLink = kind === "link" || kind === "repeat" || kind === "file";
  const wantText = kind === "text" || kind === "file";

  return (
    <form
      ref={formRef}
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.delete("files");
        start(async () => {
          setMsg(undefined);
          for (const f of files) fd.append("files", await compress(f));
          const r = await submitTask(undefined, fd);
          setMsg(r);
          if (r?.ok) { formRef.current?.reset(); setFiles([]); }
        });
      }}
    >
      <input type="hidden" name="task_id" value={taskId} />
      {wantFiles && (
        <label className="stack" style={{ gap: 8 }}>
          <span className="btn ghost full">📎 {files.length ? `${files.length} ta fayl tanlandi` : "Rasm yoki fayl tanlash"}</span>
          <input
            type="file"
            name="files"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            style={{ display: "none" }}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
          />
        </label>
      )}
      {files.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {files.map((f, i) =>
            f.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={URL.createObjectURL(f)} alt="" className="thumb" />
            ) : (
              <span key={i} className="pill">{f.name}</span>
            ),
          )}
        </div>
      )}
      {wantLink && (
        <label className="field">
          <span>{kind === "file" ? "Yoki havola (Google Drive, Docs…)" : "Havola"}</span>
          <input className="input" name="link" type="url" inputMode="url" placeholder="https://" required={kind === "link"} />
        </label>
      )}
      {wantText && (
        <label className="field">
          <span>{kind === "text" ? "Javobingiz" : "Izoh (ixtiyoriy)"}</span>
          <textarea className="input" name="text" rows={kind === "text" ? 6 : 3} required={kind === "text"} />
        </label>
      )}
      <button className="btn full" disabled={pending}>{pending ? "Yuborilmoqda…" : "Yuborish"}</button>
      {msg?.error && <div className="err">{msg.error}</div>}
      {msg?.ok && <div className="okmsg">{msg.ok}</div>}
    </form>
  );
}
