// Dibujos por defecto: UNA SOLA CARA de cada tipo de cubo, en el color que escogiste al agregarlo.
// (viewBox 100x100, cuadrado para nxn/skewb/gear, triangulo para pyraminx, pentagono para megaminx).
//
// PARA PONER TUS PROPIOS SVG: agrega una entrada en CUSTOM_ART con el id del tipo
// (222, 333, 444, 555, 666, 777, pyram, skewb, sq1, minx, gear) y el texto completo
// de tu SVG. Tu dibujo reemplaza al de por defecto (y ya no usa el color del cubo). Ejemplo:
//   CUSTOM_ART["333"] = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">...</svg>';
export const CUSTOM_ART = {};

const NXN = { 222: 2, 333: 3, 444: 4, 555: 5, 666: 6, 777: 7 };
const DEFAULT = "#b388ff"; // color si el cubo no tiene uno
const BODY = "#0e0b18", EDGE = "#f2ecff";

const f1 = (n) => n.toFixed(1);
const poly = (pts, fill, extra = "") => `<polygon points="${pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" ")}" fill="${fill}" ${extra}/>`;
const shrink = (pts, k) => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
};
const wrap = (inner) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
const outline = `stroke="${EDGE}" stroke-opacity=".5" stroke-width="2" stroke-linejoin="round"`;

// Variante del color para dar relieve: aclara si el color es oscuro, oscurece si es claro.
function alt(hex) {
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
  const lum = (0.299 * ch[0] + 0.587 * ch[1] + 0.114 * ch[2]) / 255;
  const target = lum < 0.45 ? 255 : 0;
  return "#" + ch.map((v) => Math.round(v + (target - v) * 0.3).toString(16).padStart(2, "0")).join("");
}

const square = () => `<rect x="6" y="6" width="88" height="88" rx="9" fill="${BODY}" ${outline}/>`;

function nxn(n, c) {
  const g = 80 / n, gap = n >= 6 ? 1.2 : 2.6;
  let s = square();
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      s += `<rect x="${f1(10 + i * g + gap / 2)}" y="${f1(10 + j * g + gap / 2)}" width="${f1(g - gap)}" height="${f1(g - gap)}" rx="${n > 5 ? 1 : 3}" fill="${c}"/>`;
  return s;
}

function skewb(c) {
  const m = [[50, 10], [90, 50], [50, 90], [10, 50]], o = alt(c);
  return square() + poly(shrink(m, 0.93), c) +
    [[[10, 10], m[0], m[3]], [m[0], [90, 10], m[1]], [m[1], [90, 90], m[2]], [m[3], m[2], [10, 90]]].map((t) => poly(shrink(t, 0.88), o)).join("");
}

function gear(c) {
  const g = [];
  for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k % 2 ? 17 : 27; g.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]); }
  return `<rect x="6" y="6" width="88" height="88" rx="9" fill="${c}" ${outline}/>` + poly(g, BODY, 'opacity="0.85"');
}

function pyraminx(c) {
  const A = [50, 8], B = [6, 90], C = [94, 90], n = 3;
  const p = (i, j) => [A[0] + ((B[0] - A[0]) * i) / n + ((C[0] - A[0]) * j) / n, A[1] + ((B[1] - A[1]) * i) / n + ((C[1] - A[1]) * j) / n];
  let s = poly([A, B, C], BODY, outline);
  for (let i = 0; i < n; i++)
    for (let j = 0; i + j < n; j++) {
      s += poly(shrink([p(i, j), p(i + 1, j), p(i, j + 1)], 0.86), c);
      if (i + j < n - 1) s += poly(shrink([p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], 0.86), c);
    }
  return s;
}

const polar = (r, k, steps, cx = 50, cy = 52) => [cx + r * Math.cos(((-90 + (360 / steps) * k) * Math.PI) / 180), cy + r * Math.sin(((-90 + (360 / steps) * k) * Math.PI) / 180)];

function megaminx(c) {
  const o = alt(c), v = (k) => polar(47, k, 5);
  let s = poly([0, 1, 2, 3, 4].map(v), BODY, outline);
  for (let k = 0; k < 5; k++) s += poly(shrink([[50, 52], v(k), v(k + 1)], 0.93), k % 2 ? c : o);
  return s;
}

function square1(c) {
  const o = alt(c);
  let s = `<circle cx="50" cy="50" r="47" fill="${BODY}" ${outline}/>`, a = -105;
  for (let k = 0; k < 8; k++) {
    const span = k % 2 ? 30 : 60, pts = [[50, 50]];
    for (let d = 0; d <= span; d += 10) pts.push([50 + 44 * Math.cos(((a + d) * Math.PI) / 180), 50 + 44 * Math.sin(((a + d) * Math.PI) / 180)]);
    s += poly(shrink(pts, 0.95), k % 2 ? o : c);
    a += span;
  }
  return s;
}

function unknown(c) { // tipos personalizados
  return `<rect x="6" y="6" width="88" height="88" rx="9" fill="${c}" ${outline}/><text x="50" y="68" text-anchor="middle" font-size="56" font-weight="700" fill="${BODY}" opacity="0.8">?</text>`;
}

// Devuelve el SVG como texto (sin tocar el DOM, asi se puede probar en Node).
export function cubeSvg(eventId, color = null) {
  if (CUSTOM_ART[eventId]) return CUSTOM_ART[eventId];
  const c = color ?? DEFAULT;
  if (NXN[eventId]) return wrap(nxn(NXN[eventId], c));
  const by = { pyram: pyraminx, skewb, sq1: square1, minx: megaminx, gear };
  return wrap((by[eventId] ?? unknown)(c));
}

// Devuelve un elemento SVG listo para insertar.
export function cubeArt(eventId, color = null) {
  const el = new DOMParser().parseFromString(cubeSvg(eventId, color), "image/svg+xml").documentElement;
  el.setAttribute("class", "cube-art");
  el.setAttribute("aria-hidden", "true");
  return document.importNode(el, true);
}