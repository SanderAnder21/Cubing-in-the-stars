# Cubing in the Stars

Timer de cubos con estante, boss rush y una luna que te mira.

## Estado
- [x] Fase 1: mezclas oficiales con `cubing.js` verificadas (11 eventos)
- [x] Fase 2: datos (cubos, solves, modalidades, boss rush, exportar/importar)
- [x] Fase 3: estante + timer (espacio en compu, toque en celular)
- [ ] Fase 4: modalidades
- [ ] Fase 5: boss rush
- [ ] Fase 6: estadisticas
- [ ] Fase 7: la luna
- [ ] Fase 8: PWA + GitHub Pages

## Pruebas
```
npm install
npm test                   # datos: 54 pruebas (memoria + IndexedDB simulado)
npm run test:scrambles     # mezclas de los 11 eventos
npm run test:validity      # las mezclas si desordenan el puzzle
```

## Archivos de src/
- `events.js`  catalogo: eventos, modalidades base, presets de boss rush, penalizaciones
- `db.js`      almacenamiento (IndexedDB en el navegador, memoria para pruebas)
- `store.js`   cubos, modalidades, solves, boss rush, exportar/importar
- `io.js`      descargar respaldo e importar archivos


## Notas
- Mezclas: `cubing.js` (MPL-2.0 OR GPL-3.0+). Es para uso no oficial; en competencias de la WCA se usa TNoodle.
- Gear cube y cubos raros: mezcla libre (sin scramble).

## Usarlo
```
npm run serve     # http://localhost:8080 (se recompila solo al editar src/)
npm run build     # deja la app lista en dist/
```