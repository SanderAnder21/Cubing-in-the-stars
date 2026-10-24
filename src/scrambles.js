// Mezclas oficiales con cubing.js, cargado solo cuando se necesita (pesa ~1.3 MB).
// Siempre deja la SIGUIENTE mezcla generandose mientras resuelves (el 4x4 tarda ~3 s en frio).
let mod;
const cache = new Map(); // cubingId -> Promise<string>

const generate = (id) =>
  (mod ??= import("cubing/scramble")).then((m) => m.randomScrambleForEvent(id)).then((a) => a.toString());

export function prefetch(cubingId) {
  if (cubingId && !cache.has(cubingId)) cache.set(cubingId, generate(cubingId));
}

// null = evento de mezcla libre (sin scramble).
export async function takeScramble(cubingId) {
  if (!cubingId) return null;
  prefetch(cubingId);
  const p = cache.get(cubingId);
  cache.delete(cubingId);
  try {
    return await p;
  } finally {
    prefetch(cubingId);
  }
}