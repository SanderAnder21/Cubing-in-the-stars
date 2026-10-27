// Estadisticas al estilo WCA. Recibe solves en orden CRONOLOGICO (del mas viejo al mas nuevo).
import { finalTime } from "./store.js";

const KINDS = { mo3: 3, ao5: 5, ao12: 12, ao100: 100 };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// mo3: media de 3 sin quitar nada. aoN: se quitan los mejores y peores (1 en ao5/ao12, 5 en ao100).
function windowValue(kind, w) {
  if (kind === "mo3") return w.includes(Infinity) ? Infinity : mean(w);
  const trim = w.length >= 100 ? 5 : 1;
  const mid = [...w].sort((a, b) => a - b).slice(trim, w.length - trim);
  return mid.includes(Infinity) ? Infinity : mean(mid);
}

// Valor del promedio terminando en cada solve (null donde todavia no hay suficientes).
export function series(chrono, kind) {
  const n = KINDS[kind], t = chrono.map(finalTime);
  return t.map((_, i) => (i + 1 < n ? null : windowValue(kind, t.slice(i + 1 - n, i + 1))));
}

// best = mejor marca historica, current = el promedio actual (puede ser DNF).
export function rolling(chrono, kind) {
  const s = series(chrono, kind);
  let best = null;
  for (const v of s) if (v !== null && Number.isFinite(v) && (best === null || v < best)) best = v;
  return { best, current: s.length ? s[s.length - 1] : null };
}

export function cubeStats(chrono) {
  const t = chrono.map(finalTime);
  const best = t.reduce((m, v) => (Number.isFinite(v) && (m === null || v < m) ? v : m), null);
  return {
    count: chrono.length,
    time: { best, current: t.length ? t[t.length - 1] : null },
    mo3: rolling(chrono, "mo3"),
    ao5: rolling(chrono, "ao5"),
    ao12: rolling(chrono, "ao12"),
    ao100: rolling(chrono, "ao100"),
  };
}

// Ids de los solves que fueron un record personal en el momento en que se hicieron.
export function flagPBs(chrono) {
  const pb = new Set();
  let best = Infinity;
  for (const s of chrono) {
    const v = finalTime(s);
    if (Number.isFinite(v) && v < best) { pb.add(s.id); best = v; }
  }
  return pb;
}