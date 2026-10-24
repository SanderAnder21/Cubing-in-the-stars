// Adaptadores de almacenamiento. El store (store.js) solo conoce esta interfaz:
//   loadAll()            -> { cubes:[], solves:[], modes:[], runs:[], events:[] }
//   put(coll, rec)       -> guarda o reemplaza un registro
//   putMany(coll, recs)  -> igual, varios en una sola transaccion
//   remove(coll, id)     -> borra un registro
//   clear()              -> borra TODO
// Asi la logica se prueba en Node con memoria, y en el navegador usa IndexedDB.

export const COLLECTIONS = ["cubes", "solves", "modes", "runs", "events"];

export function createMemoryAdapter() {
  const db = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
  return {
    async loadAll() {
      return Object.fromEntries(
        COLLECTIONS.map((c) => [c, [...db[c].values()].map((r) => structuredClone(r))])
      );
    },
    async put(coll, rec) {
      db[coll].set(rec.id, structuredClone(rec));
    },
    async putMany(coll, recs) {
      for (const r of recs) db[coll].set(r.id, structuredClone(r));
    },
    async remove(coll, id) {
      db[coll].delete(id);
    },
    async clear() {
      for (const c of COLLECTIONS) db[c].clear();
    },
  };
}

export function createIndexedDBAdapter({
  name = "cubing-in-the-stars",
  idb = globalThis.indexedDB,
} = {}) {
  if (!idb) throw new Error("Este navegador no tiene IndexedDB");
  let dbPromise = null;

  const open = () =>
    (dbPromise ??= new Promise((resolve, reject) => {
      const req = idb.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const c of COLLECTIONS) {
          if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));

  // Corre `fn(transaction)` y resuelve cuando la transaccion TERMINA (no antes).
  async function tx(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      const out = fn(t);
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error("Transaccion cancelada"));
    });
  }

  return {
    async loadAll() {
      const reqs = await tx(COLLECTIONS, "readonly", (t) =>
        Object.fromEntries(COLLECTIONS.map((c) => [c, t.objectStore(c).getAll()]))
      );
      return Object.fromEntries(COLLECTIONS.map((c) => [c, reqs[c].result]));
    },
    async put(coll, rec) {
      await tx([coll], "readwrite", (t) => void t.objectStore(coll).put(rec));
    },
    async putMany(coll, recs) {
      if (!recs.length) return;
      await tx([coll], "readwrite", (t) => {
        const s = t.objectStore(coll);
        for (const r of recs) s.put(r);
      });
    },
    async remove(coll, id) {
      await tx([coll], "readwrite", (t) => void t.objectStore(coll).delete(id));
    },
    async clear() {
      await tx(COLLECTIONS, "readwrite", (t) => {
        for (const c of COLLECTIONS) t.objectStore(c).clear();
      });
    },
  };
}

// Le pide al navegador que NO borre tus datos si anda corto de espacio.
// Importante en celular. Devuelve true si lo concedio.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}