// Dibujos por defecto de cada tipo de cubo (SVG generado por codigo, viewBox 100x100).
//
// PARA PONER TUS PROPIOS SVG: agrega una entrada en CUSTOM_ART con el id del tipo
// (222, 333, 444, 555, 666, 777, pyram, skewb, sq1, minx, gear) y el texto completo
// de tu SVG. Tu dibujo reemplaza al de por defecto. Ejemplo:
//   CUSTOM_ART["333"] = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">...</svg>';
export const CUSTOM_ART = {};

const C = { w: "#f1f1f1", g: "#34c759", r: "#e5484d", b: "#3b82f6", o: "#ff9f1a", y: "#ffd60a", body: "#0e0b18", edge: "#3a2a5e" };
const NXN = { 222: 2, 333: 3, 444: 4, 555: 5, 666: 6, 777: 7 };

const f1 = (n) => n.toFixed(1);
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const poly = (pts, fill, extra = "") => `<polygon points="${pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" ")}" fill="${fill}" ${extra}/>`;
const shrink = (pts, k) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
};
const wrap = (inner) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;

// Cubo en vista isometrica: tres caras visibles (arriba, izquierda, derecha).
const L = 34, ux = L * Math.cos(Math.PI / 6), uy = L / 2;
const P0 = [50, 12], U = [ux, uy], V = [-ux, uy], W = [0, L];
const FACES = {
    top: { o: P0, a: U, b: V, c: C.w },
    left: { o: add(P0, V), a: U, b: W, c: C.g },
    right: { o: add(add(P0, U), V), a: [-V[0], -V[1]], b: W, c: C.r },
};
const at = (f, x, y) => add(add(f.o, f.a, x), f.b, y); // punto (x,y) de 0 a 1 sobre una cara
const hexBody = () => poly([P0, add(P0, U), add(add(P0, U), W), add(add(add(P0, U), V), W), add(add(P0, V), W), add(P0, V)], C.body, `stroke="${C.edge}" stroke-width="1.5" stroke-linejoin="round"`);

function nxn(n) {
    let s = hexBody();
    for (const f of Object.values(FACES))
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                s += poly(shrink([at(f, i / n, j / n), at(f, (i + 1) / n, j / n), at(f, (i + 1) / n, (j + 1) / n), at(f, i / n, (j + 1) / n)], 0.84), f.c);
    return s;
}

function skewb() {
    let s = hexBody();
    const corner = { top: C.b, left: C.o, right: C.y };
    for (const [k, f] of Object.entries(FACES)) {
        const m = [at(f, 0.5, 0), at(f, 1, 0.5), at(f, 0.5, 1), at(f, 0, 0.5)];
        s += poly(shrink(m, 0.9), f.c);
        const t = [[at(f, 0, 0), m[0], m[3]], [m[0], at(f, 1, 0), m[1]], [m[1], at(f, 1, 1), m[2]], [m[3], m[2], at(f, 0, 1)]];
        for (const tri of t) s += poly(shrink(tri, 0.86), corner[k]);
    }
    return s;
}

function gear() {
    let s = hexBody();
    for (const f of Object.values(FACES)) {
        s += poly(shrink([at(f, 0, 0), at(f, 1, 0), at(f, 1, 1), at(f, 0, 1)], 0.92), f.c);
        const g = [];
        for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, r = k % 2 ? 0.22 : 0.33; g.push(at(f, 0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a))); }
        s += poly(g, C.body, 'opacity="0.85"');
    }
    return s;
}

// Triangulo dividido en n*n triangulos pequenos.
function triFace(A, B, Cc, n, fill) {
    const p = (i, j) => [A[0] + ((B[0] - A[0]) * i) / n + ((Cc[0] - A[0]) * j) / n, A[1] + ((B[1] - A[1]) * i) / n + ((Cc[1] - A[1]) * j) / n];
    let s = "";
    for (let i = 0; i < n; i++)
        for (let j = 0; i + j < n; j++) {
            s += poly(shrink([p(i, j), p(i + 1, j), p(i, j + 1)], 0.88), fill);
            if (i + j < n - 1) s += poly(shrink([p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)], 0.88), fill);
        }
    return s;
}

function pyraminx() {
    const T = [50, 6], Lf = [10, 72], M = [52, 94], R = [92, 72];
    return poly([T, Lf, M, R], C.body, `stroke="${C.edge}" stroke-width="1.5" stroke-linejoin="round"`) +
        triFace(T, Lf, M, 3, C.g) + triFace(T, M, R, 3, C.y);
}

function megaminx() {
    const ring = [C.b, C.r, C.g, C.o, C.y];
    const pt = (r, k) => [50 + r * Math.cos(((-90 + 72 * k) * Math.PI) / 180), 50 + r * Math.sin(((-90 + 72 * k) * Math.PI) / 180)];
    let s = poly([0, 1, 2, 3, 4].map((k) => pt(47, k)), C.body, `stroke="${C.edge}" stroke-width="1.5" stroke-linejoin="round"`);
    for (let k = 0; k < 5; k++) s += poly(shrink([pt(23, k), pt(23, k + 1), pt(46, k + 1), pt(46, k)], 0.92), ring[k]);
    return s + poly(shrink([0, 1, 2, 3, 4].map((k) => pt(23, k)), 0.92), C.w);
}

function square1() {
    const R = 45, cx = 50, cy = 50, sides = [C.g, C.r, C.b, C.o];
    let s = `<circle cx="50" cy="50" r="47" fill="${C.body}" stroke="${C.edge}" stroke-width="1.5"/>`, a = -105;
    for (let k = 0; k < 8; k++) {
        const span = k % 2 ? 30 : 60, pts = [[cx, cy]];
        for (let d = 0; d <= span; d += 10) pts.push([cx + R * Math.cos(((a + d) * Math.PI) / 180), cy + R * Math.sin(((a + d) * Math.PI) / 180)]);
        s += poly(shrink(pts, 0.96), k % 2 ? sides[(k >> 1) % 4] : C.w, `stroke="${C.body}" stroke-width="1.2"`);
        a += span;
    }
    return s;
}

function unknown() { // tipos personalizados
    let s = hexBody();
    for (const f of Object.values(FACES)) s += poly(shrink([at(f, 0, 0), at(f, 1, 0), at(f, 1, 1), at(f, 0, 1)], 0.84), "#6b5a9a");
    return s + `<text x="50" y="56" text-anchor="middle" font-size="26" font-weight="700" fill="${C.w}">?</text>`;
}

// Devuelve el SVG como texto (sin tocar el DOM, asi se puede probar en Node).
export function cubeSvg(eventId) {
    if (CUSTOM_ART[eventId]) return CUSTOM_ART[eventId];
    if (NXN[eventId]) return wrap(nxn(NXN[eventId]));
    const by = { pyram: pyraminx, skewb, sq1: square1, minx: megaminx, gear };
    return wrap((by[eventId] ?? unknown)());
}

// Devuelve un elemento SVG listo para insertar.
export function cubeArt(eventId) {
    const el = new DOMParser().parseFromString(cubeSvg(eventId), "image/svg+xml").documentElement;
    el.setAttribute("class", "cube-art");
    el.setAttribute("aria-hidden", "true");
    return document.importNode(el, true);
}