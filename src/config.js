// Configuracion: agregar y editar cubos, modalidades y tipos de cubo, y respaldo.
// Los desplegables (<details>) viven solo aqui. Todo el texto entra con textContent.
import { h } from "./shelf.js";
import { downloadExport, importFromFile, describeImport } from "./io.js";

const SWATCHES = ["#1a1a1a", "#f1f1f1", "#3b82f6", "#e5484d", "#34c759", "#facc15", "#ff9f1a", "#a855f7", "#14b8a6"];

export function setupConfig(dlg, store, { onChange }) {
  const msg = h("div", { class: "error", role: "alert" });
  const body = h("div", { class: "cfg-body" });
  const opened = new Set(); // que desplegables estan abiertos, para no cerrarlos al refrescar

  dlg.replaceChildren(
    h("div", { class: "cfg-head" }, h("h1", {}, "⚙ Configuración"), h("button", { "aria-label": "Cerrar", onclick: () => dlg.close() }, "✕")),
    msg, body);

  const run = (fn) => async (e) => {
    try { msg.textContent = ""; await fn(e); render(); onChange(); } catch (ex) { msg.textContent = ex.message; }
  };
  const det = (key, title, ...kids) => {
    const d = h("details", { open: opened.has(key) }, h("summary", {}, title), ...kids);
    d.addEventListener("toggle", () => (d.open ? opened.add(key) : opened.delete(key)));
    return d;
  };
  const colorInput = (v) => h("input", { type: "color", value: v ?? "#1a1a1a", "aria-label": "Color del cubo" });

  function render() {
    // ----- Cubos -----
    const nName = h("input", { placeholder: "Nombre (ej. Valk 3 M)", maxlength: 60 });
    const nType = h("select", { "aria-label": "Tipo" }, store.listEvents().map((e) => h("option", { value: e.id }, e.name)));
    const nColor = colorInput("#1a1a1a");
    const nNotes = h("input", { placeholder: "Notas (opcional)", maxlength: 500 });
    const addCube = h("div", { class: "form" },
      h("h3", {}, "Agregar cubo"), nName, nType,
      h("div", { class: "row" }, nColor, ...SWATCHES.map((c) => h("button", { class: "swatch", style: `background:${c}`, "aria-label": c, onclick: () => (nColor.value = c) }))),
      nNotes,
      h("button", { class: "primary", onclick: run(() => store.addCube({ name: nName.value, eventId: nType.value, color: nColor.value, notes: nNotes.value })) }, "Agregar cubo"));

    const cubeGroups = store.listEvents().map((ev) => {
      const cubes = store.listCubes({ eventId: ev.id });
      if (!cubes.length) return null;
      return det("cubes:" + ev.id, `${ev.name} (${cubes.length})`, ...cubes.map((c) => {
        const name = h("input", { value: c.name, maxlength: 60, "aria-label": "Nombre" });
        const color = colorInput(c.color);
        const notes = h("input", { value: c.notes, maxlength: 500, placeholder: "Notas", "aria-label": "Notas" });
        return h("div", { class: "edit-row" }, name, color, notes,
          h("button", { class: "primary", onclick: run(() => store.updateCube(c.id, { name: name.value, color: color.value, notes: notes.value })) }, "Guardar"),
          h("button", { onclick: run(() => confirm(`¿Retirar "${c.name}"? Su historial se conserva.`) && store.retireCube(c.id)) }, "Retirar"));
      }));
    });
    const retired = store.listCubes({ includeRetired: true }).filter((c) => !c.active);
    const retiredBox = retired.length
      ? det("retired", `Retirados (${retired.length})`, ...retired.map((c) => h("div", { class: "edit-row" }, h("span", { class: "grow" }, `${c.name} · ${store.getEvent(c.eventId)?.name ?? ""}`), h("button", { onclick: run(() => store.restoreCube(c.id)) }, "Restaurar"))))
      : null;

    // ----- Modalidades -----
    const mName = h("input", { placeholder: "Nueva modalidad (ej. Ciego, Con los pies)", maxlength: 40 });
    const modes = store.listModes({ includeArchived: true }).map((m) =>
      h("div", { class: "edit-row" }, h("span", { class: "grow" }, m.name, m.archived ? h("small", {}, " · archivada") : null),
        m.builtin ? h("small", { class: "dim" }, "base")
          : m.archived ? h("button", { onclick: run(() => store.restoreMode(m.id)) }, "Restaurar")
          : h("button", { onclick: run(() => store.archiveMode(m.id)) }, "Archivar")));

    // ----- Tipos de cubo -----
    const tName = h("input", { placeholder: "Nuevo tipo (mezcla libre)", maxlength: 40 });
    const all = store.listEvents({ includeHidden: true });
    const custom = all.filter((e) => e.custom).map((e) => {
      if (e.hidden) return h("div", { class: "edit-row" }, h("span", { class: "grow" }, e.name, h("small", {}, " · oculto")), h("button", { onclick: run(() => store.restoreCustomEvent(e.id)) }, "Mostrar"));
      const name = h("input", { value: e.name, maxlength: 40, "aria-label": "Nombre del tipo" });
      return h("div", { class: "edit-row" }, name,
        h("button", { class: "primary", onclick: run(() => store.renameCustomEvent(e.id, name.value)) }, "Guardar"),
        h("button", { onclick: run(() => confirm(`¿Quitar "${e.name}"? Sus cubos y solves se conservan ocultos y puedes volver a mostrarlo.`) && store.hideCustomEvent(e.id)) }, "Quitar"));
    });

    // ----- Datos -----
    const file = h("input", { type: "file", accept: "application/json,.json" });
    const strat = h("select", { "aria-label": "Modo de importacion" },
      h("option", { value: "merge" }, "Agregar lo nuevo (no borra nada)"), h("option", { value: "replace" }, "Reemplazar todo"));

    body.replaceChildren(
      det("sec:cubos", "Cubos", addCube, ...cubeGroups, retiredBox),
      det("sec:modos", "Modalidades", h("div", { class: "form" }, mName, h("button", { class: "primary", onclick: run(() => store.addMode(mName.value)) }, "Agregar modalidad")), ...modes),
      det("sec:tipos", "Tipos de cubo",
        h("p", { class: "dim" }, "De fábrica (no se editan): " + all.filter((e) => !e.custom).map((e) => e.name).join(", ")),
        h("div", { class: "form" }, tName, h("button", { class: "primary", onclick: run(() => store.addCustomEvent(tName.value)) }, "Agregar tipo")), ...custom),
      det("sec:datos", "Respaldo",
        h("p", { class: "dim" }, "Tus datos viven solo en este navegador. Descarga un respaldo de vez en cuando."),
        h("button", { class: "primary", onclick: () => downloadExport(store) }, "Exportar respaldo"),
        h("div", { class: "form" }, file, strat,
          h("button", { onclick: run(async () => {
            if (strat.value === "replace" && !confirm("Esto BORRA lo que tienes ahora y deja solo lo del archivo. ¿Seguro?")) return;
            msg.textContent = describeImport(await importFromFile(store, file.files[0], { strategy: strat.value }));
          }) }, "Importar"))));
  }

  return { open() { msg.textContent = ""; render(); dlg.showModal(); } };
}