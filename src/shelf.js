// Estanteria: tus cubos sentados sobre tablas, con una etiqueta al inicio de cada tipo.
// Las tablas se acomodan solas segun el ancho: cuando una se llena, aparece otra.
import { cubeArt } from "./cubeart.js";

const ITEM_W = 80; // ancho aproximado de un cubo (px) para calcular cuantos caben por tabla

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

export function renderShelf(root, store, { selectedId, onSelect }) {
  const cubes = store.listCubes();
  if (!cubes.length) {
    root.replaceChildren(h("p", { class: "dim" }, "Tu estantería está vacía. Abre ⚙ Configuración y agrega tu primer cubo."));
    return;
  }
  const items = [];
  let last = null;
  for (const c of cubes) {
    if (c.eventId !== last) { items.push({ tag: store.getEvent(c.eventId).name }); last = c.eventId; }
    items.push({ cube: c });
  }
  const per = Math.max(3, Math.floor((root.clientWidth || 900) / ITEM_W));
  const rows = [];
  let row = [];
  for (const it of items) {
    if (row.length >= per) {
      const tail = row[row.length - 1];
      if (tail.tag) { row.pop(); rows.push(row); row = [tail]; } // una etiqueta nunca se queda sola al final de una tabla
      else { rows.push(row); row = []; }
    }
    row.push(it);
  }
  if (row.length) rows.push(row);

  root.replaceChildren(...rows.map((r) =>
    h("div", { class: "plank-row" }, r.map((it) =>
      it.tag
        ? h("span", { class: "tag" }, it.tag)
        : h("button", { class: "cube-item" + (it.cube.id === selectedId ? " sel" : ""), "aria-pressed": it.cube.id === selectedId, title: it.cube.name, onclick: () => onSelect(it.cube.id) },
            cubeArt(it.cube.eventId, it.cube.color), h("small", {}, it.cube.name))))));
}