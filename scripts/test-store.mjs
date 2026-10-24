import "fake-indexeddb/auto";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createStore, finalTime } from "../src/store.js";
import { createMemoryAdapter, createIndexedDBAdapter } from "../src/db.js";
import { exportToJSON, importFromText, describeImport, exportFilename } from "../src/io.js";

let dbCounter = 0;

// Cada "backend" devuelve una funcion que abre un store NUEVO sobre el MISMO almacenamiento
// (asi se simula cerrar y volver a abrir la app).
const BACKENDS = {
  memoria: () => {
    const adapter = createMemoryAdapter();
    return (opts) => createStore(adapter, opts);
  },
  indexeddb: () => {
    const name = `test-db-${++dbCounter}`;
    return (opts) => createStore(createIndexedDBAdapter({ name }), opts);
  },
};

const rejects = (promise, re) => assert.rejects(promise, re);

for (const [backendName, makeBackend] of Object.entries(BACKENDS)) {
  describe(`[${backendName}]`, () => {
    describe("cubos", () => {
      test("agregar, listar y ordenar por tipo", async () => {
        const open = makeBackend();
        const s = await open();
        await s.addCube({ name: "Valk", eventId: "333" });
        await s.addCube({ name: "Tornado", eventId: "222" });
        await s.addCube({ name: "AoLong", eventId: "333" });
        const names = s.listCubes().map((c) => c.name);
        assert.deepEqual(names, ["Tornado", "AoLong", "Valk"]); // 2x2 primero, luego 3x3 por nombre
      });

      test("rechaza nombre repetido, vacio y tipo desconocido", async () => {
        const s = await makeBackend()();
        await s.addCube({ name: "Valk", eventId: "333" });
        await rejects(s.addCube({ name: "valk ", eventId: "333" }), /Ya tienes un cubo/);
        await rejects(s.addCube({ name: "  ", eventId: "333" }), /nombre/);
        await rejects(s.addCube({ name: "X", eventId: "nope" }), /desconocido/);
        await rejects(s.addCube({ name: "Y", eventId: "333", lubedAt: "ayer" }), /lubricante/);
      });

      test("retirar, restaurar y que no se pueda cambiar el tipo", async () => {
        const s = await makeBackend()();
        const c = await s.addCube({ name: "Valk", eventId: "333" });
        await s.retireCube(c.id);
        assert.equal(s.listCubes().length, 0);
        assert.equal(s.listCubes({ includeRetired: true }).length, 1);
        await s.restoreCube(c.id);
        assert.equal(s.listCubes().length, 1);
        await rejects(s.updateCube(c.id, { eventId: "444" }), /No se puede cambiar el tipo/);
        const u = await s.updateCube(c.id, { notes: "se traba en U'", lubedAt: "2026-10-20" });
        assert.equal(u.notes, "se traba en U'");
        assert.equal(u.lubedAt, "2026-10-20");
      });

      test("borrar solo si no tiene solves", async () => {
        const s = await makeBackend()();
        const a = await s.addCube({ name: "A", eventId: "333" });
        const b = await s.addCube({ name: "B", eventId: "333" });
        await s.addSolve({ cubeId: a.id, timeMs: 12000 });
        await rejects(s.deleteCube(a.id), /tiene solves/);
        await s.deleteCube(b.id);
        assert.equal(s.getCube(b.id), null);
      });

      test("un retirado libera su nombre para uno nuevo", async () => {
        const s = await makeBackend()();
        const a = await s.addCube({ name: "Valk", eventId: "333" });
        await s.retireCube(a.id);
        const b = await s.addCube({ name: "Valk", eventId: "333" });
        assert.notEqual(a.id, b.id);
        await rejects(s.restoreCube(a.id), /ya hay un cubo activo|Ya hay un cubo activo/i);
      });

      test("tipos de cubo personalizados (mezcla libre)", async () => {
        const s = await makeBackend()();
        const ev = await s.addCustomEvent("Mirror Cube");
        assert.equal(ev.cubingId, null);
        await rejects(s.addCustomEvent("mirror cube"), /Ya existe/);
        await rejects(s.addCustomEvent("3x3"), /Ya existe/);
        const c = await s.addCube({ name: "Espejo", eventId: ev.id });
        assert.equal(c.eventId, ev.id);
        assert.ok(s.listEvents().some((e) => e.id === ev.id));
      });
    });

    describe("modalidades", () => {
      test("vienen Normal y Una mano; se pueden crear mas", async () => {
        const s = await makeBackend()();
        assert.deepEqual(
          s.listModes().map((m) => m.name),
          ["Normal", "Una mano"]
        );
        const m = await s.addMode("Con los pies");
        await rejects(s.addMode("con los pies"), /Ya existe/);
        await rejects(s.archiveMode("normal"), /base/);
        await s.archiveMode(m.id);
        assert.equal(s.listModes().length, 2);
        assert.equal(s.listModes({ includeArchived: true }).length, 3);
        await s.restoreMode(m.id);
        assert.equal(s.listModes().length, 3);
      });
    });

    describe("solves", () => {
      test("el tipo sale del cubo y los historiales quedan separados", async () => {
        const s = await makeBackend()();
        const c3 = await s.addCube({ name: "Valk", eventId: "333" });
        const c4 = await s.addCube({ name: "Gans", eventId: "444" });
        await s.addSolve({ cubeId: c3.id, timeMs: 10000 });
        await s.addSolve({ cubeId: c3.id, timeMs: 15000, modeId: "oh" });
        await s.addSolve({ cubeId: c4.id, timeMs: 50000 });
        assert.equal(s.querySolves({ eventId: "333", modeId: "normal" }).length, 1);
        assert.equal(s.querySolves({ eventId: "333", modeId: "oh" }).length, 1);
        assert.equal(s.querySolves({ eventId: "333" }).length, 2);
        assert.equal(s.querySolves({ cubeId: c4.id })[0].eventId, "444");
        assert.equal(s.querySolves({ eventId: "444", modeId: "oh" }).length, 0);
      });

      test("penalizaciones +2/+4/+6/+8/+10 y DNF", async () => {
        const s = await makeBackend()();
        const c = await s.addCube({ name: "Valk", eventId: "333" });
        const sol = await s.addSolve({ cubeId: c.id, timeMs: 10000 });
        assert.equal(finalTime(sol), 10000);
        for (const plus of [2, 4, 6, 8, 10]) {
          const u = await s.setPenalty(sol.id, { plus });
          assert.equal(finalTime(u), 10000 + plus * 1000);
        }
        await rejects(s.setPenalty(sol.id, { plus: 3 }), /Penalizacion invalida/);
        await rejects(s.addSolve({ cubeId: c.id, timeMs: 1, plus: 12 }), /Penalizacion invalida/);
        const d = await s.setPenalty(sol.id, { dnf: true });
        assert.equal(finalTime(d), Infinity);
        const back = await s.setPenalty(sol.id, { dnf: false, plus: 0 });
        assert.equal(finalTime(back), 10000);
      });

      test("deshacer (borrar) y ultimo solve", async () => {
        const s = await makeBackend()();
        const c = await s.addCube({ name: "Valk", eventId: "333" });
        const a = await s.addSolve({ cubeId: c.id, timeMs: 9000 });
        const b = await s.addSolve({ cubeId: c.id, timeMs: 8000 });
        assert.equal(s.lastSolve({ cubeId: c.id }).id, b.id);
        await s.deleteSolve(b.id);
        assert.equal(s.lastSolve({ cubeId: c.id }).id, a.id);
        await rejects(s.deleteSolve("no-existe"), /no existe/);
      });

      test("validaciones: cubo retirado, modalidad archivada, tiempo invalido", async () => {
        const s = await makeBackend()();
        const c = await s.addCube({ name: "Valk", eventId: "333" });
        const m = await s.addMode("Ciego");
        await rejects(s.addSolve({ cubeId: c.id, timeMs: -5 }), /Tiempo invalido/);
        await rejects(s.addSolve({ cubeId: c.id, timeMs: NaN }), /Tiempo invalido/);
        await rejects(s.addSolve({ cubeId: c.id, timeMs: 1000, modeId: "nope" }), /modalidad/);
        await s.archiveMode(m.id);
        await rejects(s.addSolve({ cubeId: c.id, timeMs: 1000, modeId: m.id }), /archivada/);
        await s.retireCube(c.id);
        await rejects(s.addSolve({ cubeId: c.id, timeMs: 1000 }), /retirado/);
      });

      test("orden estricto aunque el reloj no avance", async () => {
        const s = await makeBackend()({ now: () => 5000 });
        const c = await s.addCube({ name: "Valk", eventId: "333" });
        const ids = [];
        for (let i = 0; i < 5; i++) ids.push((await s.addSolve({ cubeId: c.id, timeMs: 1000 + i })).id);
        assert.deepEqual(
          s.querySolves({ cubeId: c.id, newestFirst: false }).map((x) => x.id),
          ids
        );
      });

      test("los datos devueltos son copias (no se puede corromper el store)", async () => {
        const s = await makeBackend()();
        const c = await s.addCube({ name: "Valk", eventId: "333" });
        const sol = await s.addSolve({ cubeId: c.id, timeMs: 7000 });
        sol.timeMs = 1;
        s.listCubes()[0].name = "HACK";
        assert.equal(s.querySolves()[0].timeMs, 7000);
        assert.equal(s.listCubes()[0].name, "Valk");
      });
    });

    describe("boss rush", () => {
      test("requisitos del preset: lo que falta y lo que hay", async () => {
        const s = await makeBackend()();
        await s.addCube({ name: "T", eventId: "222" });
        await s.addCube({ name: "V1", eventId: "333" });
        await s.addCube({ name: "V2", eventId: "333" });
        const r = s.presetRequirements("br-2-4");
        assert.equal(r.kind, "oneOfEach");
        assert.equal(r.ready, false);
        assert.deepEqual(r.missing, ["4x4"]);
        assert.equal(r.slots.find((x) => x.event.id === "333").candidates.length, 2);
        await s.addCube({ name: "G", eventId: "444" });
        assert.equal(s.presetRequirements("br-2-4").ready, true);
      });

      test("validar seleccion y guardar carrera con foto de los cubos", async () => {
        const s = await makeBackend()();
        const a = await s.addCube({ name: "T", eventId: "222" });
        const b = await s.addCube({ name: "V1", eventId: "333" });
        const b2 = await s.addCube({ name: "V2", eventId: "333" });
        const c = await s.addCube({ name: "G", eventId: "444" });
        await rejects(async () => s.validateRunSelection("br-2-4", [a.id, b.id]), /exactamente 3/);
        await rejects(async () => s.validateRunSelection("br-2-4", [a.id, b.id, b2.id]), /Falta o sobra/);
        await rejects(async () => s.validateRunSelection("br-2-4", [a.id, a.id, c.id]), /repetido/);
        const run = await s.addRun({ presetId: "br-2-4", cubeIds: [a.id, b.id, c.id], totalMs: 95000, plus: 4 });
        assert.equal(finalTime(run), 99000);
        await s.retireCube(b.id);
        assert.equal(s.listRuns({ presetId: "br-2-4" })[0].cubes.find((x) => x.eventId === "333").name, "V1");
        await rejects(s.addRun({ presetId: "br-2-4", cubeIds: [a.id, b.id, c.id], totalMs: 1 }), /retirado/);
        const dnf = await s.setRunPenalty(run.id, { dnf: true });
        assert.equal(finalTime(dnf), Infinity);
        await s.deleteRun(run.id);
        assert.equal(s.listRuns().length, 0);
      });

      test("todo el estante usa solo los cubos activos", async () => {
        const s = await makeBackend()();
        const a = await s.addCube({ name: "T", eventId: "222" });
        const b = await s.addCube({ name: "P", eventId: "pyram" });
        const old = await s.addCube({ name: "Viejo", eventId: "skewb" });
        await s.retireCube(old.id);
        const r = s.presetRequirements("br-all");
        assert.equal(r.kind, "all");
        assert.deepEqual(r.cubes.map((c) => c.name).sort(), ["P", "T"]);
        const run = await s.addRun({ presetId: "br-all", cubeIds: [a.id, b.id], totalMs: 40000 });
        assert.equal(run.cubes.length, 2);
        await rejects(s.addRun({ presetId: "br-all", cubeIds: [], totalMs: 1 }), /al menos un cubo/);
        await rejects(s.addRun({ presetId: "no-existe", cubeIds: [a.id], totalMs: 1 }), /preset/);
      });
    });

    describe("persistencia", () => {
      test("todo sobrevive a cerrar y volver a abrir", async () => {
        const open = makeBackend();
        const s1 = await open();
        const c = await s1.addCube({ name: "Valk", eventId: "333", notes: "mi favorito" });
        const m = await s1.addMode("Ciego");
        const ev = await s1.addCustomEvent("Mirror");
        const sol = await s1.addSolve({ cubeId: c.id, timeMs: 11111, plus: 2, modeId: m.id, scramble: "R U R'" });
        const t = await s1.addCube({ name: "T", eventId: "222" });
        const b = await s1.addCube({ name: "G", eventId: "444" });
        const run = await s1.addRun({ presetId: "br-2-4", cubeIds: [t.id, c.id, b.id], totalMs: 80000 });

        const s2 = await open(); // "reiniciar"
        assert.equal(s2.getCube(c.id).notes, "mi favorito");
        assert.equal(s2.querySolves()[0].id, sol.id);
        assert.equal(s2.querySolves()[0].scramble, "R U R'");
        assert.equal(finalTime(s2.querySolves()[0]), 13111);
        assert.ok(s2.listModes().some((x) => x.id === m.id));
        assert.ok(s2.listEvents().some((x) => x.id === ev.id));
        assert.equal(s2.listRuns()[0].id, run.id);
        assert.equal(s2.listModes().filter((x) => x.builtin).length, 2); // no se duplican las base
        // y el orden sigue siendo estricto despues de reabrir
        const nuevo = await s2.addSolve({ cubeId: c.id, timeMs: 9000, modeId: m.id });
        assert.equal(s2.lastSolve().id, nuevo.id);
      });

      test("borrados tambien persisten", async () => {
        const open = makeBackend();
        const s1 = await open();
        const c = await s1.addCube({ name: "Valk", eventId: "333" });
        const sol = await s1.addSolve({ cubeId: c.id, timeMs: 5000 });
        await s1.deleteSolve(sol.id);
        const s2 = await open();
        assert.equal(s2.querySolves().length, 0);
        assert.equal(s2.counts().cubes, 1);
      });
    });

    describe("exportar / importar", () => {
      async function relleno(s) {
        const c3 = await s.addCube({ name: "Valk", eventId: "333", lubedAt: "2026-10-01" });
        const c2 = await s.addCube({ name: "T", eventId: "222" });
        const c4 = await s.addCube({ name: "G", eventId: "444" });
        const m = await s.addMode("Ciego");
        await s.addSolve({ cubeId: c3.id, timeMs: 9000, scramble: "R U" });
        await s.addSolve({ cubeId: c3.id, timeMs: 14000, modeId: "oh", plus: 2 });
        await s.addSolve({ cubeId: c2.id, timeMs: 3000, modeId: m.id, dnf: true });
        await s.addRun({ presetId: "br-2-4", cubeIds: [c2.id, c3.id, c4.id], totalMs: 70000 });
      }

      test("ida y vuelta completa (replace)", async () => {
        const a = await makeBackend()();
        await relleno(a);
        const json = exportToJSON(a);
        const b = await makeBackend()();
        const sum = await importFromText(b, json, { strategy: "replace" });
        assert.equal(sum.added.cubes, 3);
        assert.equal(sum.added.solves, 3);
        assert.equal(sum.added.runs, 1);
        assert.deepEqual(b.exportData().data.cubes.sort((x, y) => x.id.localeCompare(y.id)),
                         a.exportData().data.cubes.sort((x, y) => x.id.localeCompare(y.id)));
        assert.deepEqual(b.querySolves({ newestFirst: false }), a.querySolves({ newestFirst: false }));
        assert.deepEqual(b.listRuns(), a.listRuns());
        assert.match(describeImport(sum), /Se agregaron 3 cubos, 3 solves/);
      });

      test("importar dos veces no duplica (merge)", async () => {
        const a = await makeBackend()();
        await relleno(a);
        const json = exportToJSON(a);
        const sum = await importFromText(a, json, { strategy: "merge" });
        assert.equal(sum.added.solves, 0);
        assert.equal(sum.existing.solves, 3);
        assert.equal(a.querySolves().length, 3);
        assert.equal(a.listCubes().length, 3);
      });

      test("merge suma lo nuevo de otro dispositivo sin tocar lo local", async () => {
        const celular = await makeBackend()();
        const laptop = await makeBackend()();
        await relleno(laptop);
        const mio = await celular.addCube({ name: "Solo celular", eventId: "pyram" });
        await celular.addSolve({ cubeId: mio.id, timeMs: 4000 });
        await importFromText(celular, exportToJSON(laptop), { strategy: "merge" });
        assert.equal(celular.listCubes().length, 4);
        assert.equal(celular.querySolves().length, 4);
        assert.ok(celular.getCube(mio.id));
      });

      test("replace borra lo anterior", async () => {
        const a = await makeBackend()();
        await relleno(a);
        const otro = await makeBackend()();
        await otro.addCube({ name: "Unico", eventId: "skewb" });
        await importFromText(a, exportToJSON(otro), { strategy: "replace" });
        assert.deepEqual(a.listCubes().map((c) => c.name), ["Unico"]);
        assert.equal(a.querySolves().length, 0);
        assert.equal(a.listModes().length, 2); // las base siguen
      });

      test("replace persiste tras reabrir", async () => {
        const open = makeBackend();
        const a = await open();
        await relleno(a);
        const otro = await makeBackend()();
        await otro.addCube({ name: "Unico", eventId: "skewb" });
        await importFromText(a, exportToJSON(otro), { strategy: "replace" });
        const reab = await open();
        assert.deepEqual(reab.listCubes().map((c) => c.name), ["Unico"]);
      });

      test("rechaza archivos ajenos, rotos o de version futura", async () => {
        const s = await makeBackend()();
        await rejects(importFromText(s, "esto no es json"), /JSON valido/);
        await rejects(importFromText(s, JSON.stringify({ hola: 1 })), /no es de Cubing/);
        await rejects(importFromText(s, JSON.stringify({ app: "cubing-in-the-stars", schema: 99, data: {} })), /version mas nueva/);
        await rejects(importFromText(s, "null"), /no es de Cubing/);
        await rejects(importFromText(s, exportToJSON(s), { strategy: "otra" }), /Estrategia/);
      });

      test("omite registros danados y huerfanos sin romper el resto", async () => {
        const s = await makeBackend()();
        const c = await s.addCube({ name: "Valk", eventId: "333" });
        const buenSolve = await s.addSolve({ cubeId: c.id, timeMs: 8000 });
        const payload = s.exportData();
        const destino = await makeBackend()();
        payload.data.solves.push(
          { ...buenSolve, id: "s_malo1", timeMs: "rapido" }, // tipo invalido
          { ...buenSolve, id: "s_malo2", plus: 3 }, // penalizacion invalida
          { ...buenSolve, id: "s_huerfano", cubeId: "cube_fantasma" }, // cubo inexistente
          { ...buenSolve, id: "s_evento", eventId: "444" }, // evento no coincide con el cubo
          null,
          42
        );
        payload.data.cubes.push({ id: "c_malo", name: "", eventId: "333" });
        const sum = await destino.importData(payload, { strategy: "replace" });
        assert.equal(sum.added.solves, 1);
        assert.equal(sum.invalid.solves, 4); // malo1, malo2, null, 42
        assert.equal(sum.orphans.solves, 2); // huerfano y evento
        assert.equal(sum.invalid.cubes, 1);
        assert.equal(destino.querySolves().length, 1);
        assert.match(describeImport(sum), /omitieron 7 registros/);
      });

      test("un archivo invalido en replace NO borra tus datos", async () => {
        const s = await makeBackend()();
        await relleno(s);
        await rejects(s.importData({ app: "otra-app", schema: 1 }, { strategy: "replace" }), /no es de Cubing/);
        assert.equal(s.querySolves().length, 3);
        assert.equal(s.listCubes().length, 3);
      });

      test("nombre de archivo del respaldo", () => {
        assert.equal(exportFilename(new Date(2026, 9, 5)), "cubing-in-the-stars-2026-10-05.json");
      });
    });
  });
}
