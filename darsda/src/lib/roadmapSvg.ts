/** Jonli yo'l xaritasi: tabiat manzarasida ilon yo'li va raqamli bekatlar.
 *  SVG matn qaytaradi (server ham, brauzer ham, rolik ham shu funksiyadan foydalanadi). Tashqi importsiz. */

export type RoadState = "locked" | "done" | "review" | "current" | "debt";
export type RoadLesson = { id: number | string; n: number; title: string; date: string };

type Theme = {
  key: string; name: string; dark?: boolean;
  sky: [string, string]; ground: [string, string]; hill: string;
  road: string; edge: string; center?: string; planks?: boolean; trail: string;
  tree: "round" | "pine" | "palm" | "cactus" | "autumn" | "snowpine" | "planet" | "lantern";
  treeColors: string[]; deco: "flowers" | "rocks" | "mushroom" | "snow" | "stars" | "shells" | "dunes" | "crystals";
  fx: "clouds" | "leaves" | "snow" | "fireflies" | "stars" | "waves" | "sand" | "comets";
  label: string; ink: string; sub: string; scene?: "mountains" | "dunes" | "sea" | "space";
  sun: string; island?: boolean;
};

export const ROAD_THEMES: Theme[] = [
  { key: "bahor", name: "Bahor o'tloqi", sky: ["#8FD3FF", "#DFF4FF"], ground: ["#9BE07A", "#6CC04A"], hill: "#5DB03C",
    road: "#F6E3B4", edge: "#E2C27F", center: "#FFF6DC", trail: "#FFB020", tree: "round", treeColors: ["#3FA34D", "#57C25E", "#2E8B3E"],
    deco: "flowers", fx: "clouds", label: "#FFFFFF", ink: "#1B2A1F", sub: "#5E7363", sun: "#FFD54A" },
  { key: "tog", name: "Tog' yo'li", sky: ["#A9D8F5", "#EAF5FB"], ground: ["#A8C686", "#7FA56B"], hill: "#6F9460",
    road: "#E6DCC8", edge: "#B9AA8D", center: "#F5EFE3", trail: "#FF7A45", tree: "pine", treeColors: ["#2F6B4F", "#3D7F5D", "#24573F"],
    deco: "rocks", fx: "clouds", label: "#FFFFFF", ink: "#1E2A24", sub: "#5A6B61", scene: "mountains", sun: "#FFE07A" },
  { key: "kuz", name: "Kuz o'rmoni", sky: ["#FFD3A5", "#FFF1E0"], ground: ["#D8B45A", "#B98F3E"], hill: "#A97C33",
    road: "#F3DDB7", edge: "#C9A26A", center: "#FFF3DE", trail: "#E5484D", tree: "autumn", treeColors: ["#E5672F", "#F2A33A", "#C8432B", "#F6C445"],
    deco: "mushroom", fx: "leaves", label: "#FFFBF3", ink: "#3A2414", sub: "#8A6A4E", sun: "#FFB347" },
  { key: "qish", name: "Qishki ertak", sky: ["#BFD9F2", "#EEF5FC"], ground: ["#F6FAFE", "#DCE9F6"], hill: "#CFE0F2",
    road: "#D7E8F7", edge: "#9CBFE0", center: "#F4F9FE", trail: "#3B82F6", tree: "snowpine", treeColors: ["#2F6B5A", "#3B7D69"],
    deco: "snow", fx: "snow", label: "#FFFFFF", ink: "#1B2B3C", sub: "#5C7189", sun: "#FFF2B3" },
  { key: "tun", name: "Yulduzli tun", dark: true, sky: ["#070B24", "#14204A"], ground: ["#12294A", "#0B1A33"], hill: "#183663",
    road: "#3C4E7A", edge: "#2A3A63", center: "#FFE9A8", trail: "#FFE08A", tree: "lantern", treeColors: ["#0F2240", "#16305A"],
    deco: "stars", fx: "fireflies", label: "#1A2547", ink: "#EEF2FF", sub: "#9DA9CF", sun: "#F4F1DE" },
  { key: "orol", name: "Orollar va dengiz", sky: ["#7FD4FF", "#BDEBFF"], ground: ["#38B6F0", "#0E86C9"], hill: "#5CC8F5",
    road: "#9B6B43", edge: "#6E4A2C", planks: true, trail: "#FFE14D", tree: "palm", treeColors: ["#2FA35B", "#45C06E"],
    deco: "shells", fx: "waves", label: "#FFFFFF", ink: "#0E2A3A", sub: "#4E6F82", scene: "sea", island: true, sun: "#FFE36B" },
  { key: "voha", name: "Sahro vohasi", sky: ["#FFB36B", "#FFE2B8"], ground: ["#F2CF8E", "#E5B567"], hill: "#E9C07A",
    road: "#FBE7C2", edge: "#D9A85C", center: "#FFF4DD", trail: "#E5484D", tree: "cactus", treeColors: ["#4F9A54", "#3E8445"],
    deco: "dunes", fx: "sand", label: "#FFF9EE", ink: "#3D2A12", sub: "#8B6E48", scene: "dunes", sun: "#FFF1B0" },
  { key: "koinot", name: "Koinot sayohati", dark: true, sky: ["#05040F", "#120B2E"], ground: ["#0C0822", "#1A1040"], hill: "#2A1B5E",
    road: "#2C2266", edge: "#1C1548", center: "#B79BFF", trail: "#7CF5FF", tree: "planet", treeColors: ["#FF6FB5", "#7C6CFF", "#FFC94A", "#3EE6C1"],
    deco: "crystals", fx: "comets", label: "#1E1645", ink: "#F1EDFF", sub: "#A99CD8", scene: "space", sun: "#C9B8FF" },
];
export const roadTheme = (k?: string | null) => ROAD_THEMES.find((t) => t.key === k) ?? ROAD_THEMES[0];
/** Platformada tanlash mumkin bo'lgan manzaralar */
export const ROAD_CHOICES = ["bahor", "tun", "koinot"];

const W = 340, GAP = 118, TOP = 170, BOT = 190;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const rnd = (i: number, k: string) => { let h = 2166136261; const t = i + ":" + k; for (let j = 0; j < t.length; j++) { h ^= t.charCodeAt(j); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const f = (n: number) => n.toFixed(1);

function tree(T: Theme, x: number, y: number, s: number, i: number) {
  const c = T.treeColors[i % T.treeColors.length], c2 = T.treeColors[(i + 1) % T.treeColors.length];
  const sway = `class="nr-sway" style="animation-delay:-${f(rnd(i, "d") * 4)}s"`;
  switch (T.tree) {
    case "round": case "autumn":
      return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g ${sway}><rect x="-3" y="-4" width="6" height="18" rx="2" fill="#8B5A2B"/><circle cx="0" cy="-16" r="15" fill="${c}"/><circle cx="-9" cy="-8" r="10" fill="${c2}"/><circle cx="9" cy="-9" r="10" fill="${c}"/><circle cx="-4" cy="-22" r="5" fill="#fff" opacity=".18"/></g></g>`;
    case "pine": case "snowpine": {
      const snow = T.tree === "snowpine" ? `<path d="M0 -40 L-8 -27 L8 -27Z" fill="#fff"/><path d="M-12 -20 L-5 -24 L0 -21 L5 -24 L12 -20" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>` : "";
      return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g ${sway}><rect x="-3" y="-2" width="6" height="14" fill="#6B4423"/><path d="M0 -42 L-17 -8 L17 -8Z" fill="${c}"/><path d="M0 -28 L-20 4 L20 4Z" fill="${c2}"/>${snow}</g></g>`;
    }
    case "palm":
      return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g ${sway}><path d="M0 12 C2 0 4 -14 2 -30" stroke="#9A6A3C" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M2 -30 C-12 -36 -22 -30 -26 -22 M2 -30 C14 -38 24 -32 28 -24 M2 -30 C-4 -44 -16 -46 -22 -42 M2 -30 C8 -44 20 -46 26 -40" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="2" cy="-28" r="3" fill="#7A4E2A"/></g></g>`;
    case "cactus":
      return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g ${sway}><rect x="-6" y="-34" width="12" height="46" rx="6" fill="${c}"/><path d="M-6 -10 H-14 V-22" stroke="${c2}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 -16 H14 V-28" stroke="${c2}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="0" cy="-36" r="3" fill="#FF6FA5"/></g></g>`;
    case "lantern":
      return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M0 -40 L-16 -6 L16 -6Z M0 -26 L-19 6 L19 6Z" fill="${c}"/><rect x="-2" y="6" width="4" height="8" fill="#0A1530"/><circle cx="${f(-8 + rnd(i, "l") * 16)}" cy="-14" r="2.4" fill="#FFE08A" class="nr-blink" style="animation-delay:-${f(rnd(i, "b") * 3)}s"/></g>`;
    case "planet": {
      const r = 8 + rnd(i, "pr") * 10;
      return `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(r)}" fill="${c}"/><circle r="${f(r)}" fill="url(#nrShade)"/>${rnd(i, "ring") > 0.5 ? `<ellipse rx="${f(r * 1.7)}" ry="${f(r * 0.45)}" fill="none" stroke="${c2}" stroke-width="2" transform="rotate(-18)"/>` : ""}</g>`;
    }
  }
}

function deco(T: Theme, x: number, y: number, i: number) {
  switch (T.deco) {
    case "flowers": return [0, 1, 2].map((k) => `<circle cx="${f(x + k * 7 - 7)}" cy="${f(y + (k % 2) * 4)}" r="3.2" fill="${["#FF6FA5", "#FFD54A", "#FFFFFF"][(i + k) % 3]}"/><circle cx="${f(x + k * 7 - 7)}" cy="${f(y + (k % 2) * 4)}" r="1.2" fill="#F59E0B"/>`).join("");
    case "rocks": return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="11" ry="7" fill="#9AA3AB"/><ellipse cx="${f(x + 9)}" cy="${f(y + 3)}" rx="7" ry="5" fill="#B7BEC5"/>`;
    case "mushroom": return `<rect x="${f(x - 2)}" y="${f(y - 2)}" width="4" height="8" rx="2" fill="#FFF3E0"/><path d="M${f(x - 8)} ${f(y - 1)} a8 7 0 0 1 16 0z" fill="#E5484D"/><circle cx="${f(x - 2)}" cy="${f(y - 5)}" r="1.4" fill="#fff"/>`;
    case "snow": return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="14" ry="6" fill="#FFFFFF"/><circle cx="${f(x + 12)}" cy="${f(y - 6)}" r="6" fill="#fff"/><circle cx="${f(x + 12)}" cy="${f(y - 15)}" r="4.5" fill="#fff"/><path d="M${f(x + 14)} ${f(y - 15)} l5 1" stroke="#F97316" stroke-width="2" stroke-linecap="round"/>`;
    case "stars": return `<path d="M${f(x)} ${f(y - 5)} l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#FFE08A" class="nr-blink" style="animation-delay:-${f(rnd(i, "s") * 3)}s"/>`;
    case "shells": return `<path d="M${f(x - 6)} ${f(y)} a6 6 0 0 1 12 0z" fill="#FFB4A2"/><path d="M${f(x)} ${f(y)} v-6 M${f(x - 3)} ${f(y)} l-2 -4 M${f(x + 3)} ${f(y)} l2 -4" stroke="#E07A6A" stroke-width="1"/>`;
    case "dunes": return `<path d="M${f(x - 18)} ${f(y + 4)} q18 -14 36 0z" fill="#E8B967" opacity=".8"/>`;
    case "crystals": return `<path d="M${f(x)} ${f(y - 12)} l5 8 -5 8 -5 -8z" fill="#7CF5FF" opacity=".85"/><path d="M${f(x + 9)} ${f(y - 6)} l3.5 5 -3.5 5 -3.5 -5z" fill="#B79BFF"/>`;
  }
}

/** Silliq yo'l: Catmull-Rom → kubik Bezye */
function smooth(p: [number, number][]) {
  if (!p.length) return "";
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const NODE: Record<RoadState, [string, string, string]> = {
  done: ["#4ADE80", "#16A34A", "#0E7A35"], current: ["#60A5FA", "#2563EB", "#1E40AF"], review: ["#FCD34D", "#F59E0B", "#B45309"],
  debt: ["#FCA5A5", "#EF4444", "#B91C1C"], locked: ["#E2E8F0", "#A3AEC2", "#7B879C"],
};

export function roadSvg(o: { lessons: RoadLesson[]; states: RoadState[]; here: number; theme?: string; hrefBase?: string; uid?: string; youLabel?: string; labels?: boolean; links?: boolean }) {
  const T = roadTheme(o.theme), id = o.uid ?? "nr", n = o.lessons.length;
  const H = TOP + GAP * Math.max(0, n - 1) + BOT;
  const pos = (i: number): [number, number] => [170 + 86 * Math.sin(0.95 * i + 0.5), TOP + GAP * i];
  const pts = o.lessons.map((_, i) => pos(i));
  const all = smooth([[pos(0)[0] - 40, TOP - 90], ...pts, [170, H - 70]]);
  const upto = Math.max(0, o.here);
  const done = smooth([[pos(0)[0] - 40, TOP - 90], ...pts.slice(0, upto + 1)]);
  const out: string[] = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" class="nroad" role="list" aria-label="Yo'l xaritasi">`);
  out.push(`<style>
    .nr-sway{transform-box:fill-box;transform-origin:50% 100%;animation:nrSway 3.6s ease-in-out infinite alternate}
    .nr-drift{animation:nrDrift 38s linear infinite}
    .nr-blink{animation:nrBlink 2.6s ease-in-out infinite}
    .nr-pulse{transform-box:fill-box;transform-origin:center;animation:nrPulse 1.8s ease-out infinite}
    .nr-bob{animation:nrBob 1.4s ease-in-out infinite alternate}
    .nr-march{animation:nrMarch 1.2s linear infinite}
    .nr-fall{animation:nrFall linear infinite}
    .nr-wave{animation:nrWave 4s ease-in-out infinite alternate}
    .nr-node{cursor:pointer}
    @keyframes nrSway{from{transform:rotate(-2.5deg)}to{transform:rotate(2.5deg)}}
    @keyframes nrDrift{from{transform:translateX(-120px)}to{transform:translateX(${W + 120}px)}}
    @keyframes nrBlink{0%,100%{opacity:.25}50%{opacity:1}}
    @keyframes nrPulse{0%{transform:scale(.85);opacity:.7}100%{transform:scale(1.6);opacity:0}}
    @keyframes nrBob{from{transform:translateY(0)}to{transform:translateY(-6px)}}
    @keyframes nrMarch{to{stroke-dashoffset:-16}}
    @keyframes nrFall{from{transform:translateY(-40px)}to{transform:translateY(${H + 40}px)}}
    @keyframes nrWave{from{transform:translateX(-6px)}to{transform:translateX(6px)}}
    @media (prefers-reduced-motion: reduce){.nr-sway,.nr-drift,.nr-blink,.nr-pulse,.nr-bob,.nr-march,.nr-fall,.nr-wave{animation:none}}
  </style>`);
  out.push(`<defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.sky[0]}"/><stop offset="${f(130 / H)}" stop-color="${T.sky[1]}"/><stop offset="${f(220 / H)}" stop-color="${T.ground[0]}"/><stop offset="1" stop-color="${T.ground[1]}"/></linearGradient>
    <radialGradient id="nrShade" cx=".3" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
    ${(Object.keys(NODE) as RoadState[]).map((k) => `<radialGradient id="${id}n${k}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="${NODE[k][0]}"/><stop offset="1" stop-color="${NODE[k][1]}"/></radialGradient>`).join("")}
  </defs>`);
  out.push(`<rect width="${W}" height="${H}" fill="url(#${id}bg)"/>`);
  // Quyosh / oy
  out.push(`<circle cx="292" cy="58" r="26" fill="${T.sun}" opacity=".95"/><circle cx="292" cy="58" r="40" fill="${T.sun}" opacity=".18"/>`);
  if (T.dark) for (let k = 0; k < 60; k++) out.push(`<circle cx="${f(rnd(k, "sx") * W)}" cy="${f(rnd(k, "sy") * H)}" r="${f(0.6 + rnd(k, "sr") * 1.3)}" fill="#fff" class="nr-blink" style="animation-delay:-${f(rnd(k, "sd") * 3)}s"/>`);
  // Fon manzarasi
  if (T.scene === "mountains") out.push(`<path d="M0 170 L50 95 L85 140 L140 60 L195 135 L240 80 L300 150 L340 110 L340 200 L0 200Z" fill="#8FA9C2"/><path d="M140 60 L126 82 L136 80 L146 88 L155 78 L140 60Z M240 80 L229 97 L240 95 L251 99Z" fill="#fff"/>`);
  if (T.scene === "dunes") out.push(`<path d="M0 175 Q60 140 120 170 T240 165 T340 160 V210 H0Z" fill="#EDC27A"/>`);
  if (T.scene === "space") out.push(`<circle cx="60" cy="90" r="34" fill="#7C6CFF"/><circle cx="60" cy="90" r="34" fill="url(#nrShade)"/><ellipse cx="60" cy="90" rx="58" ry="12" fill="none" stroke="#B79BFF" stroke-width="3" transform="rotate(-15 60 90)"/>`);
  // Tepaliklar
  for (let k = 0; k * 260 < H; k++) out.push(`<ellipse cx="${k % 2 ? 390 : -50}" cy="${TOP + 60 + k * 260}" rx="150" ry="95" fill="${T.hill}" opacity="${T.scene === "sea" ? 0.35 : 0.55}"/>`);
  // Dengiz to'lqinlari
  if (T.fx === "waves") for (let k = 0; k * 46 < H; k++) out.push(`<path class="nr-wave" style="animation-delay:-${f(rnd(k, "w") * 4)}s" d="M${f(10 + rnd(k, "wx") * 260)} ${200 + k * 46} q8 -6 16 0 t16 0" stroke="#fff" stroke-opacity=".5" stroke-width="2" fill="none"/>`);
  // Yo'l
  if (T.planks) {
    out.push(`<path d="${all}" fill="none" stroke="${T.edge}" stroke-width="18" stroke-linecap="round"/><path d="${all}" fill="none" stroke="${T.road}" stroke-width="14" stroke-dasharray="7 3"/>`);
  } else {
    out.push(`<path d="${all}" fill="none" stroke="${T.edge}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`);
    out.push(`<path d="${all}" fill="none" stroke="${T.road}" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (T.center) out.push(`<path d="${all}" fill="none" stroke="${T.center}" stroke-width="2.5" stroke-dasharray="6 9" opacity=".9"/>`);
  }
  if (o.here >= 0) out.push(`<path d="${done}" fill="none" stroke="${T.trail}" stroke-width="6" stroke-linecap="round" stroke-dasharray="10 6" class="nr-march"/>`);
  // Orollar (dengiz mavzusi)
  if (T.island) pts.forEach(([x, y], i) => out.push(`<ellipse cx="${f(x)}" cy="${f(y + 10)}" rx="44" ry="22" fill="#F7DCA8"/><ellipse cx="${f(x)}" cy="${f(y + 4)}" rx="36" ry="15" fill="#7FD07A"/>${tree(T, x + (x > 170 ? -34 : 34), y + 2, 0.75, i)}`));
  // Start belgisi
  const s0 = pos(0);
  out.push(`<g transform="translate(${f(s0[0] - 40 > 170 ? s0[0] - 110 : s0[0] + 30)} ${TOP - 112})"><rect x="0" y="0" width="56" height="22" rx="5" fill="#8B5A2B"/><text x="28" y="15.5" font-size="11" font-weight="800" fill="#FFF3DE" text-anchor="middle" font-family="Inter,system-ui,sans-serif">START</text><rect x="25" y="22" width="5" height="22" fill="#6B4423"/></g>`);
  // Daraxtlar va bezaklar — yo'ldan nariroqda
  for (let i = 0; i < n; i++) {
    const [x, y] = pos(i), nx = pos(i + 1)[0], mid = (x + nx) / 2, my = y + GAP / 2;
    const far = mid > 170 ? 16 + rnd(i, "tx") * 40 : 284 + rnd(i, "tx") * 40;
    if (!T.island) {
      out.push(tree(T, far, my + 18, 0.85 + rnd(i, "ts") * 0.35, i)!);
      out.push(tree(T, far + (mid > 170 ? 30 : -30), my + 46, 0.6 + rnd(i, "ts2") * 0.25, i + 3)!);
    }
    out.push(deco(T, x > 170 ? Math.min(x + 52, 326) : Math.max(x - 52, 14), y + 36, i)!);
  }
  // Effektlar: bulut, barg, qor, olovli qo'ng'iz, kometa, qum
  const fxn = Math.ceil(H / 220);
  for (let k = 0; k < fxn; k++) {
    const x = rnd(k, "fx") * W, y = rnd(k, "fy") * H, d = 8 + rnd(k, "fd") * 10, del = rnd(k, "fl") * d;
    switch (T.fx) {
      case "clouds": out.push(`<g class="nr-drift" style="animation-duration:${f(30 + rnd(k, "cd") * 25)}s;animation-delay:-${f(rnd(k, "cl") * 40)}s"><g transform="translate(0 ${f(40 + k * 260)})" opacity=".9"><ellipse cx="0" cy="0" rx="22" ry="11" fill="#fff"/><ellipse cx="16" cy="-6" rx="15" ry="11" fill="#fff"/><ellipse cx="-14" cy="-3" rx="11" ry="8" fill="#fff"/></g></g>`); break;
      case "leaves": out.push(`<g class="nr-fall" style="animation-duration:${f(d)}s;animation-delay:-${f(del)}s"><ellipse cx="${f(x)}" cy="0" rx="4" ry="2.2" fill="${T.treeColors[k % T.treeColors.length]}" transform="rotate(${f(rnd(k, "r") * 180)} ${f(x)} 0)"/></g>`); break;
      case "snow": for (let j = 0; j < 3; j++) out.push(`<g class="nr-fall" style="animation-duration:${f(d + j * 3)}s;animation-delay:-${f(del + j * 2)}s"><circle cx="${f((x + j * 97) % W)}" cy="0" r="${f(1.5 + j * 0.6)}" fill="#fff" stroke="#CFE0F2" stroke-width=".6"/></g>`); break;
      case "fireflies": out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2.2" fill="#FFF08A" class="nr-blink" style="animation-delay:-${f(del)}s;filter:drop-shadow(0 0 3px #FFE08A)"/>`); break;
      case "sand": out.push(`<g class="nr-drift" style="animation-duration:${f(14 + rnd(k, "sd") * 10)}s;animation-delay:-${f(del)}s"><path d="M0 ${f(y)} q10 -3 20 0" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" fill="none"/></g>`); break;
      case "comets": out.push(`<g class="nr-drift" style="animation-duration:${f(9 + rnd(k, "cd") * 8)}s;animation-delay:-${f(del)}s"><path d="M0 ${f(y)} l-26 8" stroke="#7CF5FF" stroke-width="2" stroke-linecap="round" opacity=".7"/><circle cx="0" cy="${f(y)}" r="2.4" fill="#fff"/></g>`); break;
      case "stars": case "waves": break;
    }
  }
  // Bekatlar
  o.lessons.forEach((l, i) => {
    const [x, y] = pos(i), st = o.states[i] ?? "locked", isHere = i === o.here;
    const side = x > 170 ? -1 : 1, tx = x + side * 36, anchor = side > 0 ? "start" : "end";
    const title = l.title.length > 22 ? l.title.slice(0, 21) + "…" : l.title;
    const lw = Math.max(title.length * 6.3, (l.date.length + 8) * 5.6) + 18, lx = side > 0 ? tx - 8 : tx - lw + 8;
    const glyph = st === "done" ? `<path d="M${f(x - 8)} ${f(y)} l5.5 5.5 l10 -11" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : st === "locked" ? `<path d="M${f(x - 6)} ${f(y - 1)}h12v9h-12z M${f(x - 4)} ${f(y - 1)}v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`
      : `<text x="${f(x)}" y="${f(y + 6.5)}" font-size="19" font-weight="800" fill="#fff" text-anchor="middle" font-family="Inter,system-ui,sans-serif">${st === "debt" ? "!" : l.n}</text>`;
    out.push(o.links === false ? `<g>` : `<a href="${esc((o.hrefBase ?? "/darslar/") + l.id)}" class="nr-node" role="listitem" aria-label="${esc(`${l.n}-dars, ${l.title}`)}"><g>`);
    if (o.labels !== false) out.push(`<rect x="${f(lx)}" y="${f(y - 22)}" width="${f(lw)}" height="40" rx="11" fill="${T.label}" opacity="${st === "locked" ? 0.82 : 0.96}" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.12))"/>`);
    if (o.labels !== false) out.push(`<text x="${f(tx)}" y="${f(y - 7)}" text-anchor="${anchor}" font-size="10" font-weight="700" fill="${T.sub}" font-family="Inter,system-ui,sans-serif">${l.n}-dars · ${esc(l.date)}</text>`);
    if (o.labels !== false) out.push(`<text x="${f(tx)}" y="${f(y + 9)}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="${T.ink}" font-family="Inter,system-ui,sans-serif">${esc(title)}</text>`);
    out.push(`<ellipse cx="${f(x)}" cy="${f(y + 24)}" rx="22" ry="5.5" fill="#000" opacity=".18"/>`);
    if (isHere) out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="27" fill="none" stroke="${NODE[st][1]}" stroke-width="4" class="nr-pulse"/>`);
    out.push(`<circle cx="${f(x)}" cy="${f(y + 3)}" r="25" fill="${NODE[st][2]}"/><circle cx="${f(x)}" cy="${f(y)}" r="25" fill="url(#${id}n${st})"/><ellipse cx="${f(x - 7)}" cy="${f(y - 11)}" rx="9" ry="5" fill="#fff" opacity=".35"/>${glyph}`);
    if (st === "done") out.push(`<g transform="translate(${f(x + 14)} ${f(y - 40)})"><rect x="0" y="0" width="2.5" height="22" fill="#6B4423"/><path d="M2.5 1 h14 l-4 5 4 5 h-14z" fill="${T.trail}"/></g>`);
    if (isHere) out.push(`<g class="nr-bob"><g transform="translate(${f(x)} ${f(y - 46)})"><path d="M0 18 C-12 4 -14 -2 -14 -6 a14 14 0 0 1 28 0 c0 4 -2 10 -14 24z" fill="#FF4D6D" stroke="#fff" stroke-width="2.5"/><circle cx="0" cy="-6" r="6" fill="#fff"/></g></g>
      <g transform="translate(${f(x)} ${f(y + 46)})"><rect x="-58" y="-12" width="116" height="22" rx="11" fill="#FF4D6D"/><text x="0" y="3.5" font-size="11" font-weight="800" fill="#fff" text-anchor="middle" font-family="Inter,system-ui,sans-serif">${esc(o.youLabel ?? "Siz shu yerdasiz")}</text></g>`);
    out.push(o.links === false ? `</g>` : `</g></a>`);
  });
  // Marra
  out.push(`<g transform="translate(170 ${H - 70})"><ellipse cx="0" cy="26" rx="46" ry="10" fill="#000" opacity=".15"/><rect x="-3" y="-44" width="6" height="70" fill="#5B3A1C"/><path d="M3 -44 h40 v26 h-40z" fill="#fff"/>${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => (r + c) % 2 ? `<rect x="${3 + c * 8}" y="${-44 + r * 6.5}" width="8" height="6.5" fill="#111"/>` : "").join("")).join("")}<text x="0" y="52" font-size="13" font-weight="800" fill="${T.ink}" text-anchor="middle" font-family="Inter,system-ui,sans-serif">MARRA</text></g>`);
  out.push(`</svg>`);
  return out.join("");
}
