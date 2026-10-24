// Estante lateral: tus cubos dibujados, agrupados por tipo. Todo el texto entra con textContent.
import { finalTime } from "./store.js";
import { fmt } from "./timer.js";
import { cubeArt } from "./cubeart.js";

const LUBE_DAYS = 60; // despues de esto el cubo muestra aviso de lubricante

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...kids.flat().filter((x) => x != null && x !== false));
  return el;
}

const daysSince = (iso) => Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 864e5);
let formOpen = false;

export function renderShelf(root, store, { selectedId, onSelect, onChange }) {
  const err = h("div", { class: "error", role: "alert" });
  const run = (fn) => async (e) => {
    try { err.textContent = ""; await fn(e); } catch (ex) { err.textContent = ex.message; }
  };

  // ----- Formulario para agregar -----
  const name = h("input", { placeholder: "Nombre (ej. Valk 3 M)", maxlength: 60 });
  const type = h("select", { "aria-label": "Tipo de cubo" }, store.listEvents().map((e) => h("option", { value: e.id }, e.name)));
  const notes = h("input", { placeholder: "Notas (opcional)", maxlength: 500 });
  const lube = h("input", { type: "date", "aria-label": "Fecha de lubricante" });
  const form = h("div", { class: "form", hidden: !formOpen },
    name, type, notes, h("label", {}, "Lubricado el ", lube),
    h("div", { class: "row" },
      h("button", { class: "primary", onclick: run(async () => {
        const c = await store.addCube({ name: name.value, eventId: type.value, notes: notes.value, lubedAt: lube.value || null });
        onChange(c.id);
      }) }, "Agregar"),
      h("button", { onclick: run(async () => {
        const n = prompt("Nombre del nuevo tipo de cubo (usa mezcla libre):");
        if (n) { await store.addCustomEvent(n); onChange(); }
      }) }, "+ Tipo nuevo")),
    err);
  const toggle = h("button", { class: "primary wide", onclick: () => { formOpen = !formOpen; form.hidden = !formOpen; } }, "＋ Agregar cubo");

  // ----- Grupos de cubos, cada uno con su dibujo -----
  const groups = store.listEvents().map((ev) => {
    const cubes = store.listCubes({ eventId: ev.id });
    if (!cubes.length) return null;
    return h("section", { class: "group" },
      h("h2", {}, ev.name, ev.cubingId ? "" : h("small", {}, " · mezcla libre")),
      h("div", { class: "tiles" }, cubes.map((c) => {
        const best = store.querySolves({ cubeId: c.id }).map(finalTime).filter(Number.isFinite);
        return h("button", { class: "tile" + (c.id === selectedId ? " sel" : ""), "aria-pressed": c.id === selectedId, onclick: () => onSelect(c.id) },
          cubeArt(c.eventId), h("strong", {}, c.name), h("small", {}, best.length ? fmt(Math.min(...best)) : "—"));
      })));
  });

  // ----- Detalle del cubo seleccionado -----
  const sel = selectedId ? store.getCube(selectedId) : null;
  let detail = null;
  if (sel) {
    const age = sel.lubedAt ? daysSince(sel.lubedAt) : null;
    const note = age === null ? "Sin lubricante registrado" : age > LUBE_DAYS ? `⚠ Lubricante hace ${age} días` : `Lubricado hace ${age} días`;
    detail = h("section", { class: "detail" },
      h("strong", {}, sel.name),
      sel.notes ? h("span", { class: "dim" }, sel.notes) : null,
      h("span", { class: age !== null && age > LUBE_DAYS ? "warn" : "dim" }, note),
      h("label", {}, "Lubricado el ", h("input", { type: "date", value: sel.lubedAt ?? "", onchange: run(async (e) => {
        await store.updateCube(sel.id, { lubedAt: e.target.value || null }); onChange();
      }) })),
      h("button", { onclick: run(async () => {
        if (confirm(`¿Retirar "${sel.name}"? Su historial se conserva.`)) { await store.retireCube(sel.id); onChange(); }
      }) }, "Retirar cubo"));
  }

  const empty = store.listCubes().length ? null : h("p", { class: "dim" }, "Tu estante está vacío. Agrega tu primer cubo.");
  root.replaceChildren(toggle, form, empty, ...groups, detail);
}