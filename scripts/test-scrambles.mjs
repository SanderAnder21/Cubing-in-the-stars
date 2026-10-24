import { randomScrambleForEvent } from "cubing/scramble";

const EVENTS = [
  ["222", "2x2"], ["333", "3x3"], ["444", "4x4"], ["555", "5x5"],
  ["666", "6x6"], ["777", "7x7"], ["333oh", "3x3 una mano"],
  ["pyram", "Pyraminx"], ["skewb", "Skewb"], ["sq1", "Square-1"],
  ["minx", "Megaminx"],
];

for (const [id, nombre] of EVENTS) {
  const t0 = performance.now();
  try {
    const alg = await randomScrambleForEvent(id);
    const t1 = performance.now();
    const text = alg.toString();
    const moves = text.trim().split(/\s+/).length;
    console.log(`OK   ${id.padEnd(6)} ${nombre.padEnd(13)} ${String(Math.round(t1 - t0)).padStart(5)} ms  ${String(moves).padStart(3)} tokens  ${text.slice(0, 60)}...`);
  } catch (e) {
    console.log(`FAIL ${id.padEnd(6)} ${nombre.padEnd(13)} ${e.message}`);
  }
}
process.exit(0);
