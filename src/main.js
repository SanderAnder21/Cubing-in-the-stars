// Arranque y conexion: estante lateral + timer.
import { createStore, finalTime } from "./store.js";
import { createIndexedDBAdapter, requestPersistence } from "./db.js";
import { takeScramble } from "./scrambles.js";
import { createTimer, fmt } from "./timer.js";
import { summary } from "./stats.js";
import { renderShelf, h } from "./shelf.js";
import { cubeArt } from "./cubeart.js";

const store = await createStore(createIndexedDBAdapter());
requestPersistence(); // pide al navegador que NO borre tus datos si anda corto de espacio

const pref = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("cits:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("cits:" + k, JSON.stringify(v)); } catch {} },
};

let cubeId = pref.get("cube", null), modeId = pref.get("mode", "normal");
let scramble = null, scrambleFor = null, token = 0;

const $ = (id) => document.getElementById(id);
const currentCube = () => (cubeId ? store.getCube(cubeId) : null);

// ---------- Panel del estante (en celular se abre desde la izquierda) ----------
const panel = $("panel"), backdrop = $("backdrop");
const isOpen = () => panel.classList.contains("open");
const setPanel = (open) => { panel.classList.toggle("open", open); backdrop.classList.toggle("open", open); };
$("menu").addEventListener("click", () => setPanel(true));
$("close").addEventListener("click", () => setPanel(false));
backdrop.addEventListener("click", () => setPanel(false));
addEventListener("keydown", (e) => e.code === "Escape" && setPanel(false));

// ---------- Vista del timer ----------
const titleEl = h("div", { id: "title" });
const modeSel = h("select", { "aria-label": "Modalidad", onchange: () => { modeId = modeSel.value; pref.set("mode", modeId); modeSel.blur(); renderData(); } });
const inspBox = h("input", { type: "checkbox", checked: pref.get("insp", true), onchange: () => { pref.set("insp", inspBox.checked); inspBox.blur(); } });
const scrambleEl = h("div", { id: "scramble", "aria-live": "polite" });
const display = h("div", { id: "time" }, "0.00");
const pad = h("div", { id: "pad", role: "button", "aria-label": "Cronómetro: mantén y suelta para empezar" }, display);
const statsEl = h("div", { class: "stats" });
const listEl = h("div");

$("view-timer").append(
  titleEl,
  h("div", { class: "row" }, modeSel,
    h("button", { onclick: async () => {
      const n = prompt("Nombre de la modalidad (ej. Ciego, Con los pies):");
      if (!n) return;
      try { modeId = (await store.addMode(n)).id; pref.set("mode", modeId); fillModes(); renderData(); } catch (e) { alert(e.message); }
    } }, "+ Modalidad"),
    h("label", {}, inspBox, " Inspección 15 s")),
  scrambleEl, pad, statsEl, h("div", { class: "panel" }, h("h2", {}, "Últimos solves"), listEl)
);

function fillModes() {
  const modes = store.listModes();
  if (!modes.some((m) => m.id === modeId)) modeId = "normal";
  modeSel.replaceChildren(...modes.map((m) => h("option", { value: m.id }, m.name)));
  modeSel.value = modeId;
}

function renderTitle() {
  const cube = currentCube();
  const text = cube ? `${cube.name} · ${store.getEvent(cube.eventId).name}` : "Sin cubo";
  titleEl.replaceChildren(...(cube ? [cubeArt(cube.eventId)] : []), h("strong", {}, text));
  $("current").textContent = text;
}

async function refreshScramble() {
  const cube = currentCube(), mine = ++token;
  scrambleFor = cubeId;
  scramble = null;
  if (!cube) return void (scrambleEl.textContent = "Agrega un cubo en el estante para empezar.");
  const ev = store.getEvent(cube.eventId);
  if (!ev.cubingId) return void (scrambleEl.textContent = "Mezcla libre");
  scrambleEl.textContent = "Generando mezcla…";
  try {
    const s = await takeScramble(ev.cubingId);
    if (mine === token) { scramble = s; scrambleEl.textContent = s; }
  } catch (e) {
    console.error(e);
    if (mine === token) scrambleEl.textContent = "No se pudo generar la mezcla (puedes resolver igual).";
  }
}

const label = (s) => (s.dnf ? `DNF (${fmt(s.timeMs)})` : fmt(finalTime(s)) + (s.plus ? ` (+${s.plus})` : ""));

function renderData() {
  const cube = currentCube();
  if (!cube) { statsEl.replaceChildren(); listEl.replaceChildren(h("p", { class: "dim" }, "Todavía no hay solves.")); return; }
  // El historial es por combinacion tipo de cubo + modalidad.
  const solves = store.querySolves({ eventId: cube.eventId, modeId });
  const st = summary(solves, cube.eventId);
  const stat = (name, v) => h("span", {}, name + " ", h("b", {}, v === null ? "—" : fmt(v)));
  statsEl.replaceChildren(stat("Mejor", st.best), stat("ao5", st.ao5), stat("ao12", st.ao12),
    ...(cube.eventId === "666" || cube.eventId === "777" ? [stat("mo3", st.mo3)] : []),
    h("span", {}, `${st.count} solves`));
  const act = (fn) => async () => { try { await fn(); } catch (e) { alert(e.message); } renderData(); };
  listEl.replaceChildren(...(solves.length ? solves.slice(0, 8).map((s) =>
    h("div", { class: "solve" },
      h("span", { class: "t" }, label(s)),
      h("button", { onclick: act(() => store.setPenalty(s.id, { plus: s.plus >= 10 ? 0 : s.plus + 2 })) }, "+2"),
      h("button", { onclick: act(() => store.setPenalty(s.id, { dnf: !s.dnf })) }, "DNF"),
      h("button", { "aria-label": "Borrar solve", onclick: act(() => store.deleteSolve(s.id)) }, "✕"))) : [h("p", { class: "dim" }, "Todavía no hay solves.")]));
}

createTimer({
  pad, display,
  isInspection: () => inspBox.checked,
  isActive: () => !!currentCube() && !isOpen(),
  onState: (s) => { if (s === "ready") display.textContent = "0.00"; },
  onDone: async ({ timeMs, plus, dnf }) => {
    try { await store.addSolve({ cubeId, modeId, timeMs, plus, dnf, scramble }); } catch (e) { alert(e.message); }
    drawShelf(); // actualiza el mejor tiempo de la ficha
    renderData();
    refreshScramble();
  },
});

// ---------- Estante ----------
function drawShelf() {
  renderShelf($("shelf"), store, {
    selectedId: cubeId,
    onSelect: (id) => select(id),
    onChange: (newId) => (newId && store.getCube(newId)?.active ? select(newId) : renderAll()),
  });
}

function select(id) {
  cubeId = id;
  pref.set("cube", id);
  setPanel(false);
  renderAll();
}

function renderAll() {
  if (!store.listCubes().some((c) => c.id === cubeId)) cubeId = store.listCubes()[0]?.id ?? null;
  fillModes();
  drawShelf();
  renderTitle();
  renderData();
  if (scrambleFor !== cubeId) refreshScramble();
}

// Que un boton con foco no se active con la barra espaciadora despues de usarlo.
document.addEventListener("click", (e) => e.target.closest("button")?.blur());

renderAll();
if (!currentCube()) setPanel(true); // primera vez: abre el estante para agregar tu primer cubo