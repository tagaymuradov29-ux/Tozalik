import { IFile } from "./icons";

export function Files({ files }: { files: { id: string; name: string; type: string; size: number }[] }) {
  if (!files?.length) return null;
  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
      {files.map((f) =>
        f.type?.startsWith("image/") ? (
          <a key={f.id} href={`/api/f/${f.id}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/f/${f.id}`} alt={f.name} className="thumb" loading="lazy" />
          </a>
        ) : (
          <a key={f.id} href={`/api/f/${f.id}`} target="_blank" rel="noreferrer" className="pill info" style={{ padding: "8px 12px" }}>
            <IFile size={14} /> {f.name.length > 24 ? f.name.slice(0, 22) + "…" : f.name}
          </a>
        ),
      )}
    </div>
  );
}
