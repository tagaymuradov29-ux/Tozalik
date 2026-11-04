/** AI o'qituvchi — yoqimli robotchalar. SVG matn; holati: idle (kutmoqda), speak (gapirmoqda), listen (tinglamoqda). */
export type RobotState = "idle" | "speak" | "listen";

export const ROBOTS = [
  { key: "robi", name: "Robi", about: "Oq kapsula, ko'k ko'zlar" },
  { key: "pushti", name: "Pushti", about: "Yumaloq, pushti yonoqli" },
  { key: "kosmo", name: "Kosmo", about: "Shisha dubulg'ali kosmonavt" },
  { key: "mushuk", name: "Mushuk", about: "Quloqchali, yalpiz rang" },
  { key: "bulut", name: "Bulutcha", about: "Yumshoq bulut, yulduzchalar" },
  { key: "sova", name: "Sova", about: "Bilim ramzi, shapkali" },
] as const;
export type RobotKey = (typeof ROBOTS)[number]["key"];

const STYLE = `<style>
  .rb-float{animation:rbFloat 3s ease-in-out infinite alternate}
  .rb-eye{transform-box:fill-box;transform-origin:center;animation:rbBlink 4.2s infinite}
  .rb-bar{transform-box:fill-box;transform-origin:center bottom}
  .speak .rb-bar{animation:rbTalk .38s ease-in-out infinite alternate}
  .speak .rb-glow{animation:rbGlow 1s ease-in-out infinite alternate}
  .listen .rb-ring{animation:rbRing 1.4s ease-out infinite}
  .rb-ring{opacity:0;transform-box:fill-box;transform-origin:center}
  .rb-tw{animation:rbTw 2s ease-in-out infinite}
  @keyframes rbFloat{from{transform:translateY(0)}to{transform:translateY(-8px)}}
  @keyframes rbBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}
  @keyframes rbTalk{from{transform:scaleY(.35)}to{transform:scaleY(1.15)}}
  @keyframes rbGlow{from{opacity:.35}to{opacity:.9}}
  @keyframes rbRing{0%{opacity:.6;transform:scale(.8)}100%{opacity:0;transform:scale(1.35)}}
  @keyframes rbTw{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
  @media (prefers-reduced-motion: reduce){.rb-float,.rb-eye,.speak .rb-bar,.rb-tw{animation:none}}
</style>`;

/** Og'iz: gapirganda tebranadigan tovush ustunchalari */
const mouth = (cx: number, cy: number, col: string, w = 5, gap = 3, n = 5) =>
  Array.from({ length: n }, (_, i) => {
    const h = [6, 10, 13, 10, 6][i % 5];
    return `<rect class="rb-bar" style="animation-delay:-${(i * 0.09).toFixed(2)}s" x="${cx - (n * (w + gap) - gap) / 2 + i * (w + gap)}" y="${cy - h}" width="${w}" height="${h}" rx="${w / 2}" fill="${col}"/>`;
  }).join("");

const ring = (cx: number, cy: number, r: number, col: string) => `<circle class="rb-ring" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="4"/>`;

const BODY: Record<RobotKey, string> = {
  robi: `
    <defs><linearGradient id="rbW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE6F5"/></linearGradient>
    <linearGradient id="rbV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2547"/><stop offset="1" stop-color="#0B1230"/></linearGradient></defs>
    ${ring(100, 92, 78, "#5CC8FF")}
    <ellipse cx="100" cy="206" rx="46" ry="8" fill="#000" opacity=".12"/>
    <g class="rb-float">
      <line x1="100" y1="22" x2="100" y2="40" stroke="#B8C6DD" stroke-width="4"/><circle cx="100" cy="18" r="8" fill="#5CC8FF" class="rb-glow"/><circle cx="100" cy="18" r="4" fill="#fff"/>
      <rect x="34" y="38" width="132" height="104" rx="48" fill="url(#rbW)"/>
      <rect x="46" y="58" width="108" height="62" rx="30" fill="url(#rbV)"/>
      <rect class="rb-eye" x="70" y="74" width="16" height="22" rx="8" fill="#5CF2FF"/><rect class="rb-eye" x="114" y="74" width="16" height="22" rx="8" fill="#5CF2FF"/>
      ${mouth(100, 114, "#5CF2FF", 4, 3)}
      <circle cx="56" cy="104" r="6" fill="#FFB3C7" opacity=".7"/><circle cx="144" cy="104" r="6" fill="#FFB3C7" opacity=".7"/>
      <rect x="22" y="80" width="14" height="30" rx="7" fill="#C9D6EA"/><rect x="164" y="80" width="14" height="30" rx="7" fill="#C9D6EA"/>
      <rect x="62" y="146" width="76" height="50" rx="24" fill="url(#rbW)"/>
      <path d="M100 176 l-8-8 a5 5 0 0 1 8-6 a5 5 0 0 1 8 6z" fill="#FF6B8A" class="rb-glow"/>
    </g>`,
  pushti: `
    <defs><radialGradient id="rbP" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFE3EE"/><stop offset="1" stop-color="#FF9EC0"/></radialGradient></defs>
    ${ring(100, 100, 82, "#FF7FAF")}
    <ellipse cx="100" cy="204" rx="44" ry="8" fill="#000" opacity=".12"/>
    <g class="rb-float">
      <path d="M38 96 q-26 -10 -26 14 q16 2 30 -2z" fill="#FFC2D8"/><path d="M162 96 q26 -10 26 14 q-16 2 -30 -2z" fill="#FFC2D8"/>
      <circle cx="100" cy="104" r="72" fill="url(#rbP)"/>
      <ellipse cx="78" cy="96" rx="17" ry="20" fill="#fff"/><ellipse cx="122" cy="96" rx="17" ry="20" fill="#fff"/>
      <circle class="rb-eye" cx="80" cy="98" r="10" fill="#3A1F3D"/><circle class="rb-eye" cx="124" cy="98" r="10" fill="#3A1F3D"/>
      <circle cx="84" cy="93" r="3.5" fill="#fff"/><circle cx="128" cy="93" r="3.5" fill="#fff"/>
      <ellipse cx="62" cy="122" rx="10" ry="6" fill="#FF6FA5" opacity=".55"/><ellipse cx="138" cy="122" rx="10" ry="6" fill="#FF6FA5" opacity=".55"/>
      ${mouth(100, 138, "#C2185B", 4, 3)}
      <circle cx="100" cy="30" r="7" fill="#FF4F8B" class="rb-glow"/><path d="M100 37 v10" stroke="#FF8DB5" stroke-width="4"/>
    </g>`,
  kosmo: `
    <defs><radialGradient id="rbG" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/><stop offset=".55" stop-color="#C9E6FF" stop-opacity=".35"/><stop offset="1" stop-color="#7C6CFF" stop-opacity=".35"/></radialGradient></defs>
    ${ring(100, 92, 84, "#9B8CFF")}
    <ellipse cx="100" cy="206" rx="48" ry="8" fill="#000" opacity=".12"/>
    <g class="rb-float">
      <rect x="56" y="140" width="88" height="58" rx="26" fill="#F2F0FF"/><rect x="82" y="156" width="36" height="20" rx="6" fill="#7C6CFF"/><circle cx="92" cy="166" r="3" fill="#7CF5FF" class="rb-glow"/><circle cx="108" cy="166" r="3" fill="#FFC94A"/>
      <circle cx="100" cy="88" r="70" fill="#EDEAFF"/><circle cx="100" cy="88" r="58" fill="#1C1548"/>
      <rect class="rb-eye" x="72" y="72" width="18" height="18" rx="9" fill="#7CF5FF"/><rect class="rb-eye" x="110" y="72" width="18" height="18" rx="9" fill="#7CF5FF"/>
      ${mouth(100, 116, "#7CF5FF", 4, 3)}
      <circle cx="100" cy="88" r="58" fill="url(#rbG)"/><path d="M62 62 a50 50 0 0 1 32 -22" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity=".8"/>
      <circle cx="30" cy="40" r="3" fill="#FFC94A" class="rb-tw"/><circle cx="172" cy="56" r="2.5" fill="#7CF5FF" class="rb-tw" style="animation-delay:-1s"/>
    </g>`,
  mushuk: `
    <defs><linearGradient id="rbM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E4FFF4"/><stop offset="1" stop-color="#9BEBCB"/></linearGradient></defs>
    ${ring(100, 100, 80, "#3DD9A0")}
    <ellipse cx="100" cy="206" rx="44" ry="8" fill="#000" opacity=".12"/>
    <g class="rb-float">
      <path d="M40 70 L48 18 L86 52Z" fill="#7FE3BD"/><path d="M160 70 L152 18 L114 52Z" fill="#7FE3BD"/><path d="M50 58 L54 32 L72 50Z M150 58 L146 32 L128 50Z" fill="#FFB3C7"/>
      <rect x="30" y="44" width="140" height="116" rx="54" fill="url(#rbM)"/>
      <rect x="48" y="70" width="104" height="60" rx="28" fill="#123B33"/>
      <path class="rb-eye" d="M66 98 q12 -16 24 0" stroke="#7CFFC8" stroke-width="7" fill="none" stroke-linecap="round"/><path class="rb-eye" d="M110 98 q12 -16 24 0" stroke="#7CFFC8" stroke-width="7" fill="none" stroke-linecap="round"/>
      ${mouth(100, 124, "#7CFFC8", 4, 3)}
      <path d="M38 112 h-20 M38 120 h-18 M162 112 h20 M162 120 h18" stroke="#5FCFA6" stroke-width="3" stroke-linecap="round"/>
      <rect x="66" y="160" width="68" height="40" rx="20" fill="url(#rbM)"/><circle cx="100" cy="178" r="7" fill="#FFC94A" class="rb-glow"/>
    </g>`,
  bulut: `
    <defs><linearGradient id="rbB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D6ECFF"/></linearGradient></defs>
    ${ring(100, 104, 84, "#7CC4FF")}
    <ellipse cx="100" cy="204" rx="56" ry="8" fill="#000" opacity=".1"/>
    <g class="rb-float">
      <path transform="translate(14 8) scale(.86)" d="M48 168 a34 34 0 0 1 -6 -66 a44 44 0 0 1 80 -30 a36 36 0 0 1 60 30 a32 32 0 0 1 -10 66z" fill="url(#rbB)" stroke="#BFE0FF" stroke-width="3"/>
      <ellipse class="rb-eye" cx="80" cy="116" rx="9" ry="12" fill="#2B4A7A"/><ellipse class="rb-eye" cx="122" cy="116" rx="9" ry="12" fill="#2B4A7A"/>
      <circle cx="83" cy="111" r="3" fill="#fff"/><circle cx="125" cy="111" r="3" fill="#fff"/>
      <ellipse cx="64" cy="134" rx="9" ry="5" fill="#FFB3C7" opacity=".7"/><ellipse cx="138" cy="134" rx="9" ry="5" fill="#FFB3C7" opacity=".7"/>
      ${mouth(101, 150, "#4F8FE8", 4, 3)}
      <path d="M160 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#FFD54A" class="rb-tw"/><path d="M34 56 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#7CC4FF" class="rb-tw" style="animation-delay:-1s"/>
    </g>`,
  sova: `
    <defs><linearGradient id="rbS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7B8"/><stop offset="1" stop-color="#E9B66A"/></linearGradient></defs>
    ${ring(100, 104, 82, "#FFB547")}
    <ellipse cx="100" cy="206" rx="46" ry="8" fill="#000" opacity=".12"/>
    <g class="rb-float">
      <path d="M100 6 L156 26 L100 46 L44 26Z" fill="#2A2F45"/><rect x="74" y="30" width="52" height="16" rx="3" fill="#2A2F45"/><path d="M152 28 v22" stroke="#FFC94A" stroke-width="3"/><circle cx="152" cy="52" r="4" fill="#FFC94A"/>
      <path d="M44 60 L52 40 L70 56Z M156 60 L148 40 L130 56Z" fill="#D69A4A"/>
      <ellipse cx="100" cy="116" rx="68" ry="78" fill="url(#rbS)"/><ellipse cx="100" cy="148" rx="38" ry="40" fill="#FFF4DD"/>
      <circle cx="74" cy="96" r="26" fill="#fff" stroke="#C88B3E" stroke-width="5"/><circle cx="126" cy="96" r="26" fill="#fff" stroke="#C88B3E" stroke-width="5"/>
      <circle class="rb-eye" cx="76" cy="98" r="11" fill="#2A2F45"/><circle class="rb-eye" cx="124" cy="98" r="11" fill="#2A2F45"/>
      <circle cx="80" cy="93" r="3.5" fill="#fff"/><circle cx="128" cy="93" r="3.5" fill="#fff"/>
      <path d="M92 118 l8 10 8 -10z" fill="#F08C00"/>
      ${mouth(100, 156, "#C88B3E", 4, 3)}
    </g>`,
};

export function robotSvg(key: string = "robi", state: RobotState = "idle", size = 200) {
  const k = (key in BODY ? key : "robi") as RobotKey;
  return `<svg viewBox="0 0 200 220" width="${size}" height="${size * 1.1}" class="${state}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${STYLE}${BODY[k]}</svg>`;
}
