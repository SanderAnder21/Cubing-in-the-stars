// Catalogo fijo: eventos, modalidades base, presets de boss rush y constantes.
// `cubingId` es el id que entiende cubing.js para generar la mezcla oficial.
// Si `cubingId` es null el evento usa MEZCLA LIBRE (cronometro sin scramble).

export const EVENTS = [
  { id: "222", name: "2x2", group: "nxn", cubingId: "222" },
  { id: "333", name: "3x3", group: "nxn", cubingId: "333" },
  { id: "444", name: "4x4", group: "nxn", cubingId: "444" },
  { id: "555", name: "5x5", group: "nxn", cubingId: "555" },
  { id: "666", name: "6x6", group: "nxn", cubingId: "666" },
  { id: "777", name: "7x7", group: "nxn", cubingId: "777" },
  { id: "pyram", name: "Pyraminx", group: "side", cubingId: "pyram" },
  { id: "skewb", name: "Skewb", group: "side", cubingId: "skewb" },
  { id: "sq1", name: "Square-1", group: "side", cubingId: "sq1" },
  { id: "minx", name: "Megaminx", group: "side", cubingId: "minx" },
  // Sin generador de mezclas confiable: mezcla libre.
  { id: "gear", name: "Gear Cube", group: "side", cubingId: null },
];

// Las modalidades son etiquetas libres. Estas dos vienen de fabrica.
// Cada combinacion evento + modalidad tiene su propio historial.
export const BUILTIN_MODES = [
  { id: "normal", name: "Normal", builtin: true },
  { id: "oh", name: "Una mano", builtin: true },
];

// Boss rush: `events` = un cubo de cada uno. `null` = todos los cubos activos del estante.
export const BOSS_PRESETS = [
  { id: "br-2-4", name: "2x2 a 4x4", events: ["222", "333", "444"] },
  { id: "br-2-5", name: "2x2 a 5x5", events: ["222", "333", "444", "555"] },
  { id: "br-2-6", name: "2x2 a 6x6", events: ["222", "333", "444", "555", "666"] },
  { id: "br-2-7", name: "2x2 a 7x7", events: ["222", "333", "444", "555", "666", "777"] },
  { id: "br-all", name: "Todo el estante", events: null },
];

// Penalizaciones en segundos. Se pueden acumular varios +2 (sobre todo en boss rush).
export const PENALTY_STEPS = [0, 2, 4, 6, 8, 10];

export const INSPECTION_MS = 15000;
