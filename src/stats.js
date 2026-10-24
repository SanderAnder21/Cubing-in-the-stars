// Promedios al estilo WCA. Recibe solves del MAS NUEVO al mas viejo.
import { finalTime } from "./store.js";

const times = (solves, n) => solves.slice(0, n).map(finalTime);

export function bestTime(solves) {
  const t = solves.map(finalTime).filter(Number.isFinite);
  return t.length ? Math.min(...t) : null;
}

// ao5 / ao12: se quitan el mejor y el peor. Mas de un DNF = DNF.
export function ao(solves, n) {
  if (solves.length < n) return null;
  const t = times(solves, n).sort((a, b) => a - b);
  if (t.filter((x) => x === Infinity).length > 1) return Infinity;
  const mid = t.slice(1, -1);
  return mid.reduce((a, b) => a + b, 0) / mid.length;
}

// mo3: media de 3 sin quitar nada (formato oficial de 6x6 y 7x7).
export function mo3(solves) {
  if (solves.length < 3) return null;
  const t = times(solves, 3);
  return t.includes(Infinity) ? Infinity : t.reduce((a, b) => a + b, 0) / 3;
}

export function summary(solves, eventId) {
  const big = eventId === "666" || eventId === "777";
  return { count: solves.length, best: bestTime(solves), ao5: ao(solves, 5), ao12: ao(solves, 12), mo3: big ? mo3(solves) : null };
}