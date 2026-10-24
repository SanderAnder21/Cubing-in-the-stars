// Capa de datos. Toda la logica de cubos, solves, modalidades y boss rush vive aqui,
// sin tocar el DOM, para poder probarla en Node.
//
// Modelo:
//   cube  { id, name, eventId, notes, lubedAt|null, active, createdAt, retiredAt|null }
//   mode  { id, name, builtin, archived, createdAt }              (etiquetas libres)
//   solve { id, cubeId, eventId, modeId, timeMs, plus, dnf, scramble|null, createdAt }
//   run   { id, presetId, cubes:[{id,name,eventId}], totalMs, plus, dnf, modeId, createdAt }
//   event { id:"custom:...", name, group:"custom", cubingId:null, custom:true }
//
// Tiempo final de un solve o run: DNF = Infinity, si no tiempo + plus*1000.

import { EVENTS, BUILTIN_MODES, BOSS_PRESETS, PENALTY_STEPS } from "./events.js";
import { createMemoryAdapter } from "./db.js";

export const APP_ID = "cubing-in-the-stars";
export const SCHEMA_VERSION = 1;

export function finalTime(rec) {
  if (rec.dnf) return Infinity;
  const base = rec.timeMs ?? rec.totalMs;
  return base + rec.plus * 1000;
}

const uid = (prefix) => {
  const raw = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${raw.replace(/-/g, "").slice(0, 16)}`;
};

const need = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const nameKey = (s) => s.trim().toLocaleLowerCase("es");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Validadores (para crear y para importar) ----------

const isStr = (v, max = 200) => typeof v === "string" && v.length > 0 && v.length <= max;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isMs = (v) => isNum(v) && v >= 0;
const isPlus = (v) => PENALTY_STEPS.includes(v);

function cleanCube(r) {
  if (!isStr(r?.id) || !isStr(r.name?.trim?.(), 60) || !isStr(r.eventId)) return null;
  return {
    id: r.id,
    name: r.name.trim(),
    eventId: r.eventId,
    notes: typeof r.notes === "string" ? r.notes.slice(0, 500) : "",
    lubedAt: typeof r.lubedAt === "string" && DATE_RE.test(r.lubedAt) ? r.lubedAt : null,
    active: r.active !== false,
    createdAt: isNum(r.createdAt) ? r.createdAt : 0,
    retiredAt: isNum(r.retiredAt) ? r.retiredAt : null,
  };
}

function cleanMode(r) {
  if (!isStr(r?.id) || !isStr(r.name?.trim?.(), 40)) return null;
  return {
    id: r.id,
    name: r.name.trim(),
    builtin: BUILTIN_MODES.some((m) => m.id === r.id),
    archived: r.archived === true,
    createdAt: isNum(r.createdAt) ? r.createdAt : 0,
  };
}

function cleanEvent(r) {
  if (!isStr(r?.id) || !r.id.startsWith("custom:") || !isStr(r.name?.trim?.(), 40)) return null;
  return { id: r.id, name: r.name.trim(), group: "custom", cubingId: null, custom: true };
}

function cleanSolve(r) {
  if (!isStr(r?.id) || !isStr(r.cubeId) || !isStr(r.eventId) || !isStr(r.modeId)) return null;
  if (!isMs(r.timeMs) || !isPlus(r.plus) || typeof r.dnf !== "boolean") return null;
  return {
    id: r.id,
    cubeId: r.cubeId,
    eventId: r.eventId,
    modeId: r.modeId,
    timeMs: Math.round(r.timeMs),
    plus: r.plus,
    dnf: r.dnf,
    scramble: typeof r.scramble === "string" ? r.scramble.slice(0, 3000) : null,
    createdAt: isNum(r.createdAt) ? r.createdAt : 0,
  };
}

function cleanRun(r) {
  if (!isStr(r?.id) || !BOSS_PRESETS.some((p) => p.id === r.presetId)) return null;
  if (!Array.isArray(r.cubes) || !r.cubes.length) return null;
  if (!isMs(r.totalMs) || !isPlus(r.plus) || typeof r.dnf !== "boolean" || !isStr(r.modeId)) return null;
  const cubes = r.cubes.map((c) =>
    isStr(c?.id) && isStr(c.name, 60) && isStr(c.eventId) ? { id: c.id, name: c.name, eventId: c.eventId } : null
  );
  if (cubes.includes(null)) return null;
  return {
    id: r.id,
    presetId: r.presetId,
    cubes,
    totalMs: Math.round(r.totalMs),
    plus: r.plus,
    dnf: r.dnf,
    modeId: r.modeId,
    createdAt: isNum(r.createdAt) ? r.createdAt : 0,
  };
}

// ---------- Store ----------

export async function createStore(adapter = createMemoryAdapter(), { now = () => Date.now() } = {}) {
  const data = {
    cubes: new Map(),
    solves: new Map(),
    modes: new Map(),
    runs: new Map(),
    events: new Map(),
  };
  let lastAt = 0;
  // Marca de tiempo estrictamente creciente: dos solves nunca empatan en orden.
  const stamp = () => (lastAt = Math.max(now(), lastAt + 1));

  const copy = (o) => structuredClone(o);

  async function save(coll, rec) {
    await adapter.put(coll, rec);
    data[coll].set(rec.id, rec);
    return copy(rec);
  }

  async function drop(coll, id) {
    await adapter.remove(coll, id);
    data[coll].delete(id);
  }

  async function seedBuiltinModes() {
    for (const m of BUILTIN_MODES) {
      if (!data.modes.has(m.id)) {
        await save("modes", { ...m, archived: false, createdAt: 0 });
      }
    }
  }

  // Carga inicial
  const loaded = await adapter.loadAll();
  for (const coll of Object.keys(data)) {
    for (const r of loaded[coll] ?? []) {
      data[coll].set(r.id, r);
      if (isNum(r.createdAt)) lastAt = Math.max(lastAt, r.createdAt);
    }
  }
  await seedBuiltinModes();

  // ----- Eventos -----

  const allEvents = () => [...EVENTS, ...data.events.values()];
  const getEvent = (id) => allEvents().find((e) => e.id === id) ?? null;
  const eventOrder = (id) => allEvents().findIndex((e) => e.id === id);

  async function addCustomEvent(name) {
    name = String(name ?? "").trim();
    need(name, "El tipo de cubo necesita un nombre");
    need(name.length <= 40, "Nombre demasiado largo (max. 40)");
    need(
      !allEvents().some((e) => nameKey(e.name) === nameKey(name)),
      `Ya existe un tipo de cubo llamado "${name}"`
    );
    return save("events", cleanEvent({ id: uid("custom:ev"), name }));
  }

  // ----- Cubos -----

  const cubeNameTaken = (name, exceptId = null) =>
    [...data.cubes.values()].some((c) => c.active && c.id !== exceptId && nameKey(c.name) === nameKey(name));

  function checkLubed(v) {
    need(v === null || (typeof v === "string" && DATE_RE.test(v)), "Fecha de lubricante invalida (AAAA-MM-DD)");
  }

  async function addCube({ name, eventId, notes = "", lubedAt = null }) {
    name = String(name ?? "").trim();
    need(name, "El cubo necesita un nombre");
    need(name.length <= 60, "Nombre demasiado largo (max. 60)");
    need(getEvent(eventId), "Tipo de cubo desconocido");
    need(!cubeNameTaken(name), `Ya tienes un cubo activo llamado "${name}"`);
    checkLubed(lubedAt);
    const rec = cleanCube({
      id: uid("cube"),
      name,
      eventId,
      notes,
      lubedAt,
      active: true,
      createdAt: stamp(),
      retiredAt: null,
    });
    return save("cubes", rec);
  }

  async function updateCube(id, patch) {
    const cube = data.cubes.get(id);
    need(cube, "Ese cubo no existe");
    need(!("eventId" in patch), "No se puede cambiar el tipo de un cubo (sus solves quedarian mezclados)");
    const next = { ...cube };
    if ("name" in patch) {
      const name = String(patch.name ?? "").trim();
      need(name && name.length <= 60, "Nombre invalido");
      need(!cube.active || !cubeNameTaken(name, id), `Ya tienes un cubo activo llamado "${name}"`);
      next.name = name;
    }
    if ("notes" in patch) next.notes = String(patch.notes ?? "").slice(0, 500);
    if ("lubedAt" in patch) {
      checkLubed(patch.lubedAt);
      next.lubedAt = patch.lubedAt;
    }
    return save("cubes", next);
  }

  async function retireCube(id) {
    const cube = data.cubes.get(id);
    need(cube, "Ese cubo no existe");
    if (!cube.active) return copy(cube);
    return save("cubes", { ...cube, active: false, retiredAt: stamp() });
  }

  async function restoreCube(id) {
    const cube = data.cubes.get(id);
    need(cube, "Ese cubo no existe");
    if (cube.active) return copy(cube);
    need(!cubeNameTaken(cube.name, id), `Ya hay un cubo activo llamado "${cube.name}"; renombra uno primero`);
    return save("cubes", { ...cube, active: true, retiredAt: null });
  }

  async function deleteCube(id) {
    need(data.cubes.has(id), "Ese cubo no existe");
    const hasSolves = [...data.solves.values()].some((s) => s.cubeId === id);
    need(!hasSolves, "Ese cubo tiene solves guardados: mejor retiralo para conservar su historial");
    await drop("cubes", id);
  }

  const getCube = (id) => (data.cubes.has(id) ? copy(data.cubes.get(id)) : null);

  function listCubes({ eventId = null, includeRetired = false } = {}) {
    return [...data.cubes.values()]
      .filter((c) => (includeRetired || c.active) && (!eventId || c.eventId === eventId))
      .sort((a, b) => eventOrder(a.eventId) - eventOrder(b.eventId) || a.name.localeCompare(b.name, "es"))
      .map(copy);
  }

  // ----- Modalidades -----

  const modeNameTaken = (name, exceptId = null) =>
    [...data.modes.values()].some((m) => m.id !== exceptId && !m.archived && nameKey(m.name) === nameKey(name));

  async function addMode(name) {
    name = String(name ?? "").trim();
    need(name && name.length <= 40, "La modalidad necesita un nombre (max. 40)");
    need(!modeNameTaken(name), `Ya existe la modalidad "${name}"`);
    return save("modes", cleanMode({ id: uid("mode"), name, archived: false, createdAt: stamp() }));
  }

  async function archiveMode(id) {
    const mode = data.modes.get(id);
    need(mode, "Esa modalidad no existe");
    need(!mode.builtin, "Las modalidades base no se pueden archivar");
    return save("modes", { ...mode, archived: true });
  }

  async function restoreMode(id) {
    const mode = data.modes.get(id);
    need(mode, "Esa modalidad no existe");
    need(!modeNameTaken(mode.name, id), `Ya existe la modalidad "${mode.name}"`);
    return save("modes", { ...mode, archived: false });
  }

  function listModes({ includeArchived = false } = {}) {
    return [...data.modes.values()]
      .filter((m) => includeArchived || !m.archived)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(copy);
  }

  // ----- Solves -----

  async function addSolve({ cubeId, modeId = "normal", timeMs, scramble = null, plus = 0, dnf = false }) {
    const cube = data.cubes.get(cubeId);
    need(cube, "Ese cubo no existe");
    need(cube.active, "Ese cubo esta retirado");
    const mode = data.modes.get(modeId);
    need(mode && !mode.archived, "Esa modalidad no existe o esta archivada");
    need(isMs(timeMs), "Tiempo invalido");
    need(isPlus(plus), `Penalizacion invalida (usa ${PENALTY_STEPS.join(", ")})`);
    const rec = cleanSolve({
      id: uid("solve"),
      cubeId,
      eventId: cube.eventId,
      modeId,
      timeMs,
      plus,
      dnf: !!dnf,
      scramble,
      createdAt: stamp(),
    });
    return save("solves", rec);
  }

  async function setPenalty(solveId, { plus, dnf } = {}) {
    const solve = data.solves.get(solveId);
    need(solve, "Ese solve no existe");
    const next = { ...solve };
    if (plus !== undefined) {
      need(isPlus(plus), `Penalizacion invalida (usa ${PENALTY_STEPS.join(", ")})`);
      next.plus = plus;
    }
    if (dnf !== undefined) next.dnf = !!dnf;
    return save("solves", next);
  }

  async function deleteSolve(solveId) {
    need(data.solves.has(solveId), "Ese solve no existe");
    await drop("solves", solveId);
  }

  function querySolves({ cubeId, eventId, modeId, since, until, limit, newestFirst = true } = {}) {
    let out = [...data.solves.values()].filter(
      (s) =>
        (!cubeId || s.cubeId === cubeId) &&
        (!eventId || s.eventId === eventId) &&
        (!modeId || s.modeId === modeId) &&
        (since === undefined || s.createdAt >= since) &&
        (until === undefined || s.createdAt <= until)
    );
    out.sort((a, b) => (newestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
    if (limit !== undefined) out = out.slice(0, limit);
    return out.map(copy);
  }

  const lastSolve = (filter = {}) => querySolves({ ...filter, limit: 1 })[0] ?? null;

  // ----- Boss rush -----

  const getPreset = (id) => BOSS_PRESETS.find((p) => p.id === id) ?? null;
  const activeCubes = () => [...data.cubes.values()].filter((c) => c.active);

  // Que necesita este preset y que cubos tienes para cubrirlo.
  function presetRequirements(presetId) {
    const preset = getPreset(presetId);
    need(preset, "Ese preset no existe");
    if (!preset.events) {
      return { kind: "all", preset, cubes: listCubes() };
    }
    const slots = preset.events.map((eid) => ({
      event: getEvent(eid),
      candidates: listCubes({ eventId: eid }),
    }));
    return {
      kind: "oneOfEach",
      preset,
      slots,
      ready: slots.every((s) => s.candidates.length > 0),
      missing: slots.filter((s) => !s.candidates.length).map((s) => s.event.name),
    };
  }

  // Revisa la seleccion de cubos para una carrera. Devuelve los cubos o lanza error.
  // En "todo el estante" la interfaz arranca con todos los activos seleccionados.
  function validateRunSelection(presetId, cubeIds) {
    const preset = getPreset(presetId);
    need(preset, "Ese preset no existe");
    need(Array.isArray(cubeIds) && cubeIds.length > 0, "Elige al menos un cubo");
    need(new Set(cubeIds).size === cubeIds.length, "Hay un cubo repetido");
    const cubes = cubeIds.map((id) => data.cubes.get(id));
    need(!cubes.includes(undefined), "Alguno de los cubos no existe");
    need(cubes.every((c) => c.active), "Alguno de los cubos esta retirado");
    if (preset.events) {
      need(
        cubes.length === preset.events.length,
        `"${preset.name}" necesita exactamente ${preset.events.length} cubos (uno de cada tipo)`
      );
      for (const eid of preset.events) {
        const n = cubes.filter((c) => c.eventId === eid).length;
        need(n === 1, `Falta o sobra un cubo de ${getEvent(eid)?.name ?? eid}`);
      }
    }
    return cubes.map(copy);
  }

  async function addRun({ presetId, cubeIds, totalMs, plus = 0, dnf = false, modeId = "normal" }) {
    const cubes = validateRunSelection(presetId, cubeIds);
    const mode = data.modes.get(modeId);
    need(mode && !mode.archived, "Esa modalidad no existe o esta archivada");
    need(isMs(totalMs), "Tiempo invalido");
    need(isPlus(plus), `Penalizacion invalida (usa ${PENALTY_STEPS.join(", ")})`);
    const rec = cleanRun({
      id: uid("run"),
      presetId,
      cubes: cubes.map((c) => ({ id: c.id, name: c.name, eventId: c.eventId })), // foto: sobrevive si retiras el cubo
      totalMs,
      plus,
      dnf: !!dnf,
      modeId,
      createdAt: stamp(),
    });
    return save("runs", rec);
  }

  async function setRunPenalty(runId, { plus, dnf } = {}) {
    const run = data.runs.get(runId);
    need(run, "Esa carrera no existe");
    const next = { ...run };
    if (plus !== undefined) {
      need(isPlus(plus), `Penalizacion invalida (usa ${PENALTY_STEPS.join(", ")})`);
      next.plus = plus;
    }
    if (dnf !== undefined) next.dnf = !!dnf;
    return save("runs", next);
  }

  async function deleteRun(runId) {
    need(data.runs.has(runId), "Esa carrera no existe");
    await drop("runs", runId);
  }

  function listRuns({ presetId, newestFirst = true } = {}) {
    return [...data.runs.values()]
      .filter((r) => !presetId || r.presetId === presetId)
      .sort((a, b) => (newestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt))
      .map(copy);
  }

  // ----- Exportar / importar -----

  function exportData() {
    return {
      app: APP_ID,
      schema: SCHEMA_VERSION,
      exportedAt: new Date(now()).toISOString(),
      data: {
        events: [...data.events.values()].map(copy),
        modes: [...data.modes.values()].map(copy),
        cubes: [...data.cubes.values()].map(copy),
        solves: [...data.solves.values()].map(copy),
        runs: [...data.runs.values()].map(copy),
      },
    };
  }

  // strategy "merge": agrega lo nuevo y no toca lo que ya existe (mismo id = se omite).
  // strategy "replace": borra todo y deja solo lo importado.
  // Registros mal formados o huerfanos se omiten y se cuentan en el resumen.
  async function importData(payload, { strategy = "merge" } = {}) {
    need(strategy === "merge" || strategy === "replace", "Estrategia de importacion invalida");
    need(payload && payload.app === APP_ID, "Este archivo no es de Cubing in the Stars");
    need(
      Number.isInteger(payload.schema) && payload.schema >= 1 && payload.schema <= SCHEMA_VERSION,
      "Este archivo viene de una version mas nueva de la app"
    );
    const src = payload.data ?? {};
    const arr = (k) => (Array.isArray(src[k]) ? src[k] : []);

    const summary = { added: {}, existing: {}, invalid: {}, orphans: {} };
    for (const k of Object.keys(data)) {
      summary.added[k] = 0;
      summary.existing[k] = 0;
      summary.invalid[k] = 0;
      summary.orphans[k] = 0;
    }

    // 1) Limpiar y validar TODO antes de tocar nada.
    const cleaners = { events: cleanEvent, modes: cleanMode, cubes: cleanCube, solves: cleanSolve, runs: cleanRun };
    const cleaned = {};
    for (const [coll, fn] of Object.entries(cleaners)) {
      cleaned[coll] = [];
      for (const raw of arr(coll)) {
        const rec = fn(raw);
        if (rec) cleaned[coll].push(rec);
        else summary.invalid[coll]++;
      }
    }

    // 2) Si es "replace", vaciar y volver a sembrar lo base.
    if (strategy === "replace") {
      await adapter.clear();
      for (const m of Object.values(data)) m.clear();
      await seedBuiltinModes();
    }

    // 3) Agregar en orden de dependencias.
    const eventKnown = (id) => !!getEvent(id);
    const batches = {};
    for (const coll of ["events", "modes", "cubes", "solves", "runs"]) {
      batches[coll] = [];
      for (const rec of cleaned[coll]) {
        if (data[coll].has(rec.id)) {
          // Las modalidades base siempre existen: no cuentan como "omitidas".
          if (!(coll === "modes" && rec.builtin)) summary.existing[coll]++;
          continue;
        }
        if (coll === "cubes" && !eventKnown(rec.eventId)) {
          summary.orphans[coll]++;
          continue;
        }
        if (coll === "solves") {
          const cube = data.cubes.get(rec.cubeId);
          if (!cube || cube.eventId !== rec.eventId || !data.modes.has(rec.modeId)) {
            summary.orphans[coll]++;
            continue;
          }
        }
        if (coll === "runs" && !data.modes.has(rec.modeId)) {
          summary.orphans[coll]++;
          continue;
        }
        batches[coll].push(rec);
        data[coll].set(rec.id, rec);
        summary.added[coll]++;
        if (rec.createdAt) lastAt = Math.max(lastAt, rec.createdAt);
      }
      await adapter.putMany(coll, batches[coll]);
    }
    return summary;
  }

  function counts() {
    return {
      cubes: listCubes().length,
      retiredCubes: listCubes({ includeRetired: true }).length - listCubes().length,
      solves: data.solves.size,
      runs: data.runs.size,
      modes: listModes().length,
    };
  }

  return {
    // eventos
    listEvents: () => allEvents().map(copy),
    getEvent: (id) => (getEvent(id) ? copy(getEvent(id)) : null),
    addCustomEvent,
    // cubos
    addCube,
    updateCube,
    retireCube,
    restoreCube,
    deleteCube,
    getCube,
    listCubes,
    // modalidades
    addMode,
    archiveMode,
    restoreMode,
    listModes,
    // solves
    addSolve,
    setPenalty,
    deleteSolve,
    querySolves,
    lastSolve,
    // boss rush
    presetRequirements,
    validateRunSelection,
    addRun,
    setRunPenalty,
    deleteRun,
    listRuns,
    // datos
    exportData,
    importData,
    counts,
  };
}
