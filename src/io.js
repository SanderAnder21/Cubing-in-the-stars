// Exportar e importar respaldos. La logica de validacion vive en store.js;
// aqui solo esta lo que toca archivos y el navegador.

export function exportFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `cubing-in-the-stars-${d}.json`;
}

export function exportToJSON(store) {
  return JSON.stringify(store.exportData(), null, 1);
}

// Dispara la descarga del respaldo. Solo funciona en el navegador.
export function downloadExport(store, { doc = document, date = new Date() } = {}) {
  const blob = new Blob([exportToJSON(store)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = exportFilename(date);
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Importa desde texto JSON. Devuelve el resumen de store.importData().
export async function importFromText(store, text, options) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON valido");
  }
  return store.importData(payload, options);
}

// Importa desde un <input type="file"> (objeto File).
export async function importFromFile(store, file, options) {
  need(file, "No elegiste ningun archivo");
  need(file.size <= 50 * 1024 * 1024, "El archivo es demasiado grande (max. 50 MB)");
  return importFromText(store, await file.text(), options);
}

// Texto corto para mostrar el resultado de una importacion.
export function describeImport(summary) {
  const names = { cubes: "cubos", solves: "solves", runs: "carreras", modes: "modalidades", events: "tipos de cubo" };
  const parts = [];
  for (const [k, label] of Object.entries(names)) {
    if (summary.added[k]) parts.push(`${summary.added[k]} ${label}`);
  }
  const skipped = Object.keys(names).reduce(
    (n, k) => n + summary.existing[k] + summary.invalid[k] + summary.orphans[k],
    0
  );
  const added = parts.length ? `Se agregaron ${parts.join(", ")}.` : "No habia nada nuevo que agregar.";
  return skipped ? `${added} Se omitieron ${skipped} registros (ya existian o estaban danados).` : added;
}

// Importar sesiones de csTimer: PENDIENTE. Hay que revisar su formato real de exportacion
// antes de escribirlo, en vez de adivinarlo.
export async function importFromCsTimer() {
  throw new Error("Importar desde csTimer todavia no esta listo");
}

function need(cond, msg) {
  if (!cond) throw new Error(msg);
}