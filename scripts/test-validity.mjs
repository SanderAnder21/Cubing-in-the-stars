import { randomScrambleForEvent } from "cubing/scramble";
import { puzzles } from "cubing/puzzles";

// 1) 4x4: primera vs siguientes (calentamiento) y unicidad
const times = [], seen = new Set();
for (let i = 0; i < 6; i++) {
  const t0 = performance.now();
  const a = (await randomScrambleForEvent("444")).toString();
  times.push(Math.round(performance.now() - t0));
  seen.add(a);
}
console.log("4x4 tiempos (ms):", times.join(", "), "| distintas:", seen.size, "/ 6");

// 2) Validez: aplicar la mezcla a un puzzle resuelto y comprobar que ya NO esta resuelto
const checks = [["222","2x2x2"],["333","3x3x3"],["444","4x4x4"],["555","5x5x5"],["666","6x6x6"],["777","7x7x7"],["pyram","pyraminx"],["skewb","skewb"],["sq1","square1"],["minx","megaminx"]];
for (const [ev, pid] of checks) {
  const kp = await puzzles[pid].kpuzzle();
  const alg = await randomScrambleForEvent(ev);
  const solved = kp.defaultPattern();
  const after = solved.applyAlg(alg);
  const same = JSON.stringify(after.patternData) === JSON.stringify(solved.patternData);
  console.log(`${same ? "FALLA" : "ok   "} ${ev.padEnd(6)} la mezcla ${same ? "NO cambia" : "si cambia"} el puzzle`);
}
process.exit(0);
