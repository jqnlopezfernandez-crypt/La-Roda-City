# PLAN.md — La Roda City

Estado real del proyecto. Cada fase indica qué funciona, **cómo se ha comprobado** y qué falta.
Leyenda: ✅ hecho y comprobado · 🟡 parcial · ⬜ pendiente · ⛔ bloqueado (necesita al usuario)

Página jugable (sin servidor, modo en solitario): artifact "La Roda City" — se actualiza en el mismo enlace.

## Fase 0 — Entorno ✅
- ✅ Node.js 24.22.0 LTS en el PC (instalador oficial, huella SHA-256 verificada).
- ✅ Dependencias comprobadas en npm: Phaser 3.90.0, Vite 6.4.4, TypeScript 5.7.3, Vitest 3.2.7,
  Colyseus 0.18 por piezas (`@colyseus/core`, `ws-transport`, `schema` 5, cliente `@colyseus/sdk` 0.18.5).
- ⬜ Git en el PC (opcional; el historial vive en el entorno de Claude).

## Fase 1 — Mapa fiel y recorrible ✅
- `tools/extraer_calles.py`: 46 nodos, 61 tramos, 1 red conectada, 8 calles sin salida, 16 manzanas.
  Línea central siempre dentro del trazo (máx. 2 px). Teclas R/M superponen las referencias.
- 29 lugares desde los puntos rojos (sin verificar). Pruebas: `tests/townMap.test.ts`.

- ✅ (21-10-2026) Sitios de las capturas de satélite del usuario: Piscina Municipal (nueva, lugar 31),
  Parque Europa (forma real, pistas giradas, templete, fuente), Parque Peces, Parque Chicocos (triángulo),
  recinto del campo Carmelita y vías del tren con paso a nivel. Pruebas en `tests/casas.test.ts`
  (agua no transitable, pistas dentro del parque, ninguna casa sobre las vías) y capturas reales.

## Fase 2 — Movimiento y escenario ✅ (pulido pendiente en fase 6)
- WASD/flechas, joystick táctil dinámico, cámara, zoom adaptable, personaje original, nombres.
- Interacción con lugares (E / ✋). Mapa horneado en texturas por trozos.
- Arranque robusto si el lienzo está oculto (antes fallaba WebGL con 0×0).
- Pruebas: `tests/e2e/play.mjs` (escritorio y móvil táctil).

## Fase 3 — Multijugador real ✅ (en red local; en internet ⛔ fase 7)
- Salas privadas: el código (5 caracteres sin ambigüedades) es el id de sala; enlace `?sala=CÓDIGO`.
- Movimiento validado en el servidor (no atravesar manzanas ni teletransportarse).
- Anfitrión con relevo, nombres limpios y únicos, reconexión (45 s) y vuelta tras recargar la página.
- El servidor se sirve a través de Vite (`/servidor-juego`): un solo puerto para el móvil en la Wi-Fi.
- Pruebas: `tests/server.test.ts` (8, clientes reales), `tests/e2e/multijugador.mjs` (2 navegadores).
- Comprobado en el PC de Windows: pruebas, compilación y creación de sala por el proxy.

## Fase 4 — Roles y mecánicas ✅
- Impostores: Sapo, Gitano (se lleva el cuerpo), Pirómano (incendio con humo). Vecinos: Roeño, Vilchez
  (saluda y rastrea en el minimapa), Conserje (arregla solo), Ludópata (tragaperras, 15 %).
- Sabotajes críticos de cualquier impostor (cabeza del Sagrado, cacas en la piscina, riada en el Erillas):
  40 s, dos arreglos o el Conserje; si no, ganan los impostores. Menú ilustrado, cuenta atrás, música de
  tensión, decorado en el mapa y minijuegos de arrastrar. Probado: pruebas de servidor en `partida.test.ts`
  y `tests/e2e/sabotaje.mjs` (4 navegadores: menú, cuenta atrás en todos, arreglo con el minijuego, la
  partida sigue). En el entorno de pruebas los navegadores van a pocos fotogramas, por eso los vecinos
  llegan al sitio antes de sabotear.
- Roles secretos con StateView (comprobado que un vecino no recibe roles ajenos; prueba de mutación).
- Eliminación con alcance y espera, cuerpos, reportar, reunión de emergencia en el Ayuntamiento,
  votación (empate o "saltar" = nadie), revelación de si era impostor, victoria y vuelta a la sala.
- Pruebas: `tests/rules.test.ts`, `tests/partida.test.ts` (11), `tests/e2e/partida.mjs` (4 navegadores).

## Fase 5 — Misiones ✅ (3 pendientes de ubicar ⛔)
- 8 misiones activas en lugares del dibujo: rezar (17), tren (26), pelo (30), peces + canasta (27),
  tabaco (12), pastillas (23 → 24), platos (4/5/9), kebab (3). 4 por jugador, secretas.
- El servidor exige estar en el sitio y un tiempo mínimo; las de los impostores son tapadera.
  Los vecinos ganan al completar todas.
- Rutas por las calles (`shared/map/pathfinding.ts`) con guía de puntos amarillos.
- Práctica en solitario (página publicada): todas las misiones, sin servidor.
- Pruebas: `tests/misiones.test.ts`, `tests/pathfinding.test.ts`, `tests/e2e/minijuegos.mjs` (9 minijuegos),
  `tests/e2e/mision-en-partida.mjs` (4 navegadores).
- ⛔ Madishon (cubata), Calle Rosa 4 y 5 (puertas), Casa de la Juventud (cámaras): sin ubicar.

## Fase 6 — Diseño y pulido 🟡
- ✅ Minimapa ampliable, lista de misiones plegable con progreso, sonidos sintetizados con silencio.
  Comprobado en móvil 390×844 e iPad 1180×820 (capturas, sin errores).
- ✅ Nombres de lugares solo cerca o con misión (de 29 a ~10 visibles); aviso al terminar la práctica.
- ✅ Nombres de jugadores apilados cuando están juntos; colores de camiseta distintos asignados
  por el servidor (prueba en `tests/server.test.ts`); aparición animada del cuerpo con temblor de cámara;
  fundido al entrar, destello al empezar la reunión, pantallas con entrada suave.
  Todo respeta "reducir movimiento" del sistema. Comprobado con 4 navegadores (`tests/e2e/partida.mjs`).

## Fase 7 — Publicación 🟡 preparada · ⛔ despliegue (necesita cuentas)
- ✅ `.github/workflows/pages.yml` (cliente → GitHub Pages con `VITE_SERVER_URL`), `Dockerfile`,
  `render.yaml`, `/salud`, `package-lock.json` del PC (incluye dependencias de Linux).
- ✅ Prueba con dos navegadores contra la compilación de producción con el servidor en otro origen.
- ⛔ Crear cuentas, decidir repositorio público/privado y desplegar: guía en `docs/PUBLICAR.md`.

## Cómo se prueba todo
```bash
npm run check                      # tipos cliente + servidor + 54 pruebas Vitest
npm run dev & npm run server:dev   # y después:
node tests/e2e/play.mjs http://localhost:5173 /tmp
node tests/e2e/multijugador.mjs http://localhost:5173 /tmp
node tests/e2e/partida.mjs http://localhost:5173 /tmp
node tests/e2e/sabotaje.mjs http://localhost:5173 /tmp cabeza   # o piscina / riada
node tests/e2e/minijuegos.mjs http://localhost:5173 /tmp
node tests/e2e/mision-en-partida.mjs http://localhost:5173
```
(Las pruebas e2e necesitan Playwright, que no está en las dependencias del proyecto.)
