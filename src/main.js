// Arranque y conexion de todas las piezas.
import { createStore, finalTime } from "./store.js";
import { createIndexedDBAdapter, requestPersistence } from "./db.js";
import { takeScramble } from "./scrambles.js";
import { createTimer, fmt, fmtAvg } from "./timer.js";
import { cubeStats, series, flagPBs } from "./stats.js";
import { renderShelf, h } from "./shelf.js";
import { setupConfig } from "./config.js";
import { cubeArt } from "./cubeart.js";

const store = await createStore(createIndexedDBAdapter());
requestPersistence(); // pide al navegador que NO borre tus datos si anda corto de espacio

const pref = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("cits:" + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("cits:" + k, JSON.stringify(v)); } catch {} },
};
const $ = (id) => document.getElementById(id);
const svgEl = (str) => new DOMParser().parseFromString(str, "image/svg+xml").documentElement;

let cubeId = pref.get("cube", null), modeId = pref.get("mode", "normal");
let scramble = null, scrambleFor = null, token = 0;
const currentCube = () => (cubeId ? store.getCube(cubeId) : null);
const chronoOf = () => (cubeId ? store.querySolves({ cubeId, modeId, newestFirst: false }) : []);

// ---------- Barra: modalidad + inspeccion ----------
const modeSel = h("select", { "aria-label": "Modalidad", onchange: () => { modeId = modeSel.value; pref.set("mode", modeId); modeSel.blur(); renderStats(); } });
const inspBox = h("input", { type: "checkbox", checked: pref.get("insp", true), onchange: () => { pref.set("insp", inspBox.checked); inspBox.blur(); } });
$("bar").append(modeSel, h("label", { class: "toggle" }, inspBox, h("span", {}, "Inspección 15 s")));

function fillModes() {
  const modes = store.listModes();
  if (!modes.some((m) => m.id === modeId)) modeId = "normal";
  modeSel.replaceChildren(...modes.map((m) => h("option", { value: m.id }, m.name)));
  modeSel.value = modeId;
}

// ---------- Luna (provisional, la de verdad llega en la fase 7) ----------
$("moon").append(svgEl('<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="46" fill="#d9b85c"/><circle cx="36" cy="42" r="6" fill="#0b0614"/><circle cx="64" cy="44" r="8" fill="#0b0614"/><path d="M30 68 Q52 80 72 62" stroke="#0b0614" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'));

// ---------- Mezcla ----------
async function refreshScramble() {
  const cube = currentCube(), mine = ++token;
  scrambleFor = cubeId;
  scramble = null;
  const el = $("scramble");
  if (!cube) return void (el.textContent = "Agrega un cubo en ⚙ Configuración para empezar.");
  const ev = store.getEvent(cube.eventId);
  if (!ev.cubingId) return void (el.textContent = "Mezcla libre");
  el.textContent = "Generando mezcla…";
  try {
    const s = await takeScramble(ev.cubingId);
    if (mine === token) { scramble = s; el.textContent = s; }
  } catch (e) {
    console.error(e);
    if (mine === token) el.textContent = "No se pudo generar la mezcla (puedes resolver igual).";
  }
}

// ---------- Paneles ----------
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

function renderCubePanel(chrono) {
  const cube = currentCube(), p = $("cubePanel");
  if (!cube) return void p.replaceChildren(h("h2", {}, "Cubo actual"), h("p", { class: "dim" }, "Todavía no hay cubos. Agrega el primero en ⚙ Configuración."));
  const st = cubeStats(chrono);
  const rows = [["Tiempo", st.time, fmt], ["Mo3", st.mo3, fmtAvg], ["Ao 5", st.ao5, fmtAvg], ["Ao 12", st.ao12, fmtAvg], ["Ao 100", st.ao100, fmtAvg]];
  p.replaceChildren(
    h("h2", {}, "Cubo actual"), cubeArt(cube.eventId, cube.color),
    h("strong", { class: "cube-name" }, cube.name),
    h("small", { class: "dim" }, `${store.getEvent(cube.eventId).name} · ${store.listModes().find((m) => m.id === modeId)?.name ?? ""}`),
    h("table", {}, h("thead", {}, h("tr", {}, h("th"), h("th", {}, "Mejor"), h("th", {}, "Actual"))),
      h("tbody", {}, rows.map(([n, v, f]) => h("tr", {}, h("th", {}, n), h("td", {}, f(v.best)), h("td", {}, f(v.current)))))));
}

function renderAvgs(chrono) {
  const st = cubeStats(chrono);
  $("avgs").replaceChildren(h("div", {}, "Ao 5: " + fmtAvg(st.ao5.current)), h("div", {}, "Ao 12: " + fmtAvg(st.ao12.current)));
}

function renderActions(chrono) {
  const last = chrono[chrono.length - 1];
  const act = (fn) => async () => { try { await fn(); } catch (e) { alert(e.message); } renderStats(); };
  $("actions").replaceChildren(
    h("span", { class: "dim" }, last ? `Último: ${last.dnf ? "DNF" : fmt(finalTime(last))}${last.plus && !last.dnf ? ` (+${last.plus})` : ""}` : "Sin solves todavía"),
    h("button", { disabled: !last, onclick: last && act(() => store.setPenalty(last.id, { plus: last.plus >= 10 ? 0 : last.plus + 2 })) }, "+2"),
    h("button", { disabled: !last, onclick: last && act(() => store.setPenalty(last.id, { dnf: !last.dnf })) }, "DNF"),
    h("button", { disabled: !last, "aria-label": "Borrar último solve", onclick: last && act(() => store.deleteSolve(last.id)) }, "✕"));
}

function chartEl(chrono) {
  const pts = chrono.slice(-50);
  if (pts.length < 2) return h("p", { class: "dim" }, "La gráfica aparece con 2 solves.");
  const t = pts.map(finalTime), fin = t.filter(Number.isFinite);
  const max = Math.max(...fin), min = Math.min(...fin), span = max - min || 1;
  const W = 300, H = 130, pad = 10, n = pts.length;
  const X = (i) => pad + ((W - 2 * pad) * i) / (n - 1);
  const Y = (v) => pad + (H - 2 * pad) * (1 - ((Number.isFinite(v) ? v : max) - min) / span);
  const f = (v) => v.toFixed(1);
  const line = t.map((v, i) => `${f(X(i))},${f(Y(v))}`).join(" ");
  const ao = series(chrono, "ao12").slice(-n);
  const aoLine = ao.map((v, i) => (v !== null && Number.isFinite(v) ? `${f(X(i))},${f(Y(v))}` : null)).filter(Boolean).join(" ");
  const pb = flagPBs(chrono);
  const dots = pts.map((s, i) => (s.dnf ? `<circle cx="${f(X(i))}" cy="${f(Y(Infinity))}" r="3.5" fill="#8c1e3c"/>` : pb.has(s.id) ? `<circle cx="${f(X(i))}" cy="${f(Y(t[i]))}" r="4" fill="#d9b85c"/>` : "")).join("");
  return svgEl(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gráfica de tus últimos solves"><polyline points="${line}" fill="none" stroke="#b388ff" stroke-width="1.8" stroke-linejoin="round"/>${aoLine ? `<polyline points="${aoLine}" fill="none" stroke="#00e5ff" stroke-width="2"/>` : ""}${dots}</svg>`);
}

function renderRight(chrono) {
  const todays = store.querySolves({ since: startOfToday(), newestFirst: false });
  const cubeToday = chrono.filter((s) => s.createdAt >= startOfToday()).map(finalTime).filter(Number.isFinite);
  const best = cubeToday.length ? Math.min(...cubeToday) : null;
  const last = chrono.slice(-8).reverse();
  $("statsPanel").replaceChildren(
    h("h2", {}, "Estadísticas"),
    h("div", { class: "kv" }, h("span", {}, "Solves hoy"), h("b", {}, String(todays.length))),
    h("div", { class: "kv" }, h("span", {}, "Mejor hoy"), h("b", {}, fmt(best))),
    chartEl(chrono),
    h("small", { class: "dim" }, "Violeta: solves · Cian: ao12 · Dorado: récord"),
    h("h3", {}, "Últimos solves"),
    ...(last.length ? last.map((s) => h("div", { class: "solve" }, s.dnf ? `DNF (${fmt(s.timeMs)})` : fmt(finalTime(s)) + (s.plus ? ` (+${s.plus})` : ""))) : [h("p", { class: "dim" }, "Todavía no hay solves.")]));
}

// 56 estrellas (28 + 28): una por solve de hoy. Azul = solve, dorada = récord, vino = DNF.
function renderStars() {
  const todays = store.querySolves({ since: startOfToday(), newestFirst: false }).slice(-56);
  const pbs = new Set();
  for (const key of new Set(todays.map((s) => s.cubeId + "|" + s.modeId))) {
    const [c, m] = key.split("|");
    for (const id of flagPBs(store.querySolves({ cubeId: c, modeId: m, newestFirst: false }))) pbs.add(id);
  }
  const star = (s) => h("span", { class: s ? (s.dnf ? "dnf" : pbs.has(s.id) ? "pb" : "on") : "" }, "★");
  const all = Array.from({ length: 56 }, (_, i) => star(todays[i]));
  $("starsL").replaceChildren(...all.slice(0, 28));
  $("starsR").replaceChildren(...all.slice(28));
}

function renderStats() {
  const chrono = chronoOf();
  renderCubePanel(chrono);
  renderAvgs(chrono);
  renderActions(chrono);
  renderRight(chrono);
  renderStars();
}

// ---------- Estanteria ----------
const shelfEl = $("shelf");
let shelfWidth = 0;
const drawShelf = () => renderShelf(shelfEl, store, { selectedId: cubeId, onSelect: select });
new ResizeObserver(() => { if (shelfEl.clientWidth !== shelfWidth) { shelfWidth = shelfEl.clientWidth; drawShelf(); } }).observe(shelfEl);

function select(id) {
  cubeId = id;
  pref.set("cube", id);
  renderAll();
}

function renderAll() {
  if (!store.listCubes().some((c) => c.id === cubeId)) cubeId = store.listCubes()[0]?.id ?? null;
  fillModes();
  drawShelf();
  renderStats();
  if (scrambleFor !== cubeId) refreshScramble();
}

// ---------- Configuracion y cronometro ----------
const dlg = $("config");
const config = setupConfig(dlg, store, { onChange: renderAll });
$("gear").addEventListener("click", () => config.open());

createTimer({
  pad: $("pad"), display: $("time"),
  isInspection: () => inspBox.checked,
  isActive: () => !!currentCube() && !dlg.open,
  onState: (s) => { if (s === "ready") $("time").textContent = "0,00"; },
  onDone: async ({ timeMs, plus, dnf }) => {
    try { await store.addSolve({ cubeId, modeId, timeMs, plus, dnf, scramble }); } catch (e) { alert(e.message); }
    renderStats();
    refreshScramble();
  },
});

// Que un boton con foco no se active con la barra espaciadora despues de usarlo.
document.addEventListener("click", (e) => e.target.closest("button")?.blur());

renderAll();
if (!currentCube()) config.open(); // primera vez: abre Configuracion para agregar tu primer cubo