"use client";
import { useEffect, useRef, useState } from "react";

function embed(url: string) {
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?rel=0&playsinline=1`;
  m = url.match(/kinescope\.io\/(?:embed\/)?([\w-]+)/);
  if (m) return `https://kinescope.io/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  if (/\/embed\//.test(url)) return url;
  return null;
}

/** Dars videosi. To'g'ridan-to'g'ri fayl (.mp4/.m3u8) bo'lsa — ko'rish progressi saqlanadi va davom ettiriladi. */
export function Video({ url, lessonId, start, done: done0, track }: { url: string; lessonId: number; start: number; done: boolean; track: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const last = useRef(0);
  const [done, setDone] = useState(done0);
  const src = embed(url);

  const send = (body: Record<string, unknown>) => {
    if (!track) return;
    fetch("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lesson_id: lessonId, ...body }), keepalive: true }).catch(() => {});
  };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onMeta = () => { if (start > 5 && start < v.duration - 10) v.currentTime = start; };
    const tick = () => {
      const now = Date.now();
      if (now - last.current < 15000) return;
      last.current = now;
      send({ position: Math.floor(v.currentTime), duration: Math.floor(v.duration || 0) });
      if (v.duration && v.currentTime / v.duration > 0.9) setDone(true);
    };
    const flush = () => send({ position: Math.floor(v.currentTime), duration: Math.floor(v.duration || 0) });
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", tick);
    v.addEventListener("pause", flush);
    v.addEventListener("ended", flush);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", tick);
      v.removeEventListener("pause", flush);
      v.removeEventListener("ended", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="video">
        {src ? (
          <iframe src={src} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
        ) : (
          <video ref={ref} src={url} controls playsInline preload="metadata" controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} />
        )}
      </div>
      {track && (
        <div className="row between">
          <span className="tiny muted">{done ? "✓ Dars ko'rilgan" : src ? "Ko'rib bo'lgach belgilang" : "Ko'rish progressi saqlanadi"}</span>
          {src && !done && (
            <button className="btn sm soft" onClick={() => { send({ done: true }); setDone(true); }}>Ko&apos;rdim ✓</button>
          )}
        </div>
      )}
    </div>
  );
}
