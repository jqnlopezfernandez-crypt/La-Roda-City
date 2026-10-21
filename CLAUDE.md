# CLAUDE.md — instrucciones permanentes de La Roda City

Juego web 2D cenital de deducción social ambientado en La Roda de Andalucía (Sevilla).
Cliente: Phaser 3 + TypeScript + Vite. Servidor: Node.js + Colyseus 0.18. Pruebas: Vitest.

## Reglas que no se negocian
1. **El mapa sale del trazado del usuario.** `public/referencias/trazado-fondo-negro-original.jpeg`
   es la fuente de verdad. Nunca se mueven calles a mano ni se inventan coordenadas.
   La geometría se regenera con `python tools/extraer_calles.py`.
2. **No borrar ni editar las imágenes originales** de `public/referencias/` (los archivos que
   empiezan por `_` son imágenes de comprobación generadas y sí pueden regenerarse).
3. **Lugares sin confirmar = sin confirmar.** `verified` solo pasa a `true` cuando el usuario
   lo confirma. Lugares sin posición (`pendingPlaces`) no se colocan en el mapa.
4. **Lógica autoritativa en el servidor** (roles, eliminaciones, votos, victoria). El cliente
   solo envía intenciones.
5. **No afirmar que algo funciona sin haberlo ejecutado.** Registrar lo probado en `PLAN.md`.
6. No publicar secretos. Las URL del servidor van en variables de entorno (`VITE_SERVER_URL`).

## Estructura
```
shared/            lógica pura, sin Phaser ni Node: la usan cliente, servidor y pruebas
  map/streets.generated.json   GENERADO por tools/extraer_calles.py (no editar a mano)
  map/townMap.ts               escala, zona transitable, colisiones, movimiento
  map/pathfinding.ts           rutas por las calles (Dijkstra sobre el grafo)
  data/pointsOfInterest.ts     lugares numerados del dibujo + estado de verificación
  net/protocol.ts              estado de la sala (schema), mensajes, límites
  game/rules.ts                roles, recuento de votos, victoria
  game/missions.ts             misiones y sus lugares (las pendientes no se reparten)
src/               cliente Phaser
  game/TownScene.ts            mundo, personaje, cámara, puntos de interés
  game/UIScene.ts              interfaz superpuesta (joystick, botones, paneles)
  game/mapRenderer.ts          dibujo del pueblo horneado en texturas por trozos
  game/characters.ts           personaje original (vectorial)
  net/session.ts               conexión a la sala (SDK de Colyseus)
  ui/lobby.ts, overlays.ts, minigames.ts   pantallas HTML (inicio, reunión, final, minijuegos)
server/            servidor Colyseus: app.ts (HTTP + /salud), rooms/GameRoom.ts (toda la lógica)
tests/             pruebas Vitest (`*.test.ts`)
tools/             scripts Python de extracción y medición del mapa
public/referencias/ imágenes originales + imágenes de comprobación (_*.png/jpg)
*.bat              ayudas para Windows (el usuario no usa terminal)
```

## Comandos
```bash
npm install
npm run dev            # cliente en http://localhost:5173
npm test               # pruebas
npm run build          # comprobación de tipos + build de producción en dist/
npm run check          # tipos de cliente y servidor + pruebas
npm run server:dev     # servidor Colyseus en ws://localhost:2567 (Vite lo reenvía en /servidor-juego)
npm run build:pagina   # página publicada de un solo archivo (VITE_SIN_SERVIDOR=1, sin multijugador)
python tools/extraer_calles.py   # regenera la geometría (requiere opencv, numpy, scipy, scikit-image)
```
En Windows sin terminal: `arrancar-juego.bat` (cliente) y `comprobar-proyecto.bat` (instalar + compilar).

## Convenciones
- Código y comentarios en español; identificadores en inglés cuando son técnicos.
- Coordenadas: el trazado se mide en **píxeles del trazado** (1100×1081). El mundo usa
  `traceToWorld()` (escala uniforme `MAP_SCALE` + margen). No mezclar sistemas.
- La zona transitable es la unión de cápsulas alrededor de las líneas centrales
  (`STREET_HALF_WIDTH`). Toda posición del jugador pasa por `moveAlongStreets()`.
- `window.__laRoda` expone ganchos de prueba (posición, rol, acciones, piloto automático); no usar en juego.
- Opciones de sala solo para pruebas (`meetingMs`, `firstKillMs`, `missionPool`…) se ignoran fuera de Vitest.
- La página publicada (artifact) se actualiza SIEMPRE en el mismo enlace tras cada cambio que se pueda probar.

## Entorno de trabajo de Claude
El usuario trabaja en Windows sin Git ni terminal. Claude desarrolla en su contenedor
(con Git) y sincroniza los archivos a `Documentos\La-Roda-City`. En el PC, Claude ejecuta
tareas dejando `scripts\tarea-actual.cmd` y lanzando `ejecutar-tarea.bat` (salida en
`scripts\tarea.log`).
El puente no escribe `.env*` ni `.github/workflows/` en el PC: el flujo de Pages se mantiene también
en `docs/despliegue/pages.yml` (deben ser idénticos) y el modo página se define en `vite.config.ts`.
Al sincronizar, usar SIEMPRE una ruta de envío nueva: reutilizar la misma manda la versión antigua.

## Continuidad entre sesiones (leer al empezar)
- Página jugable (artifact): https://claude.ai/artifact/FRQvxJ6NQfABzrp74TkcU6 — se publica SIEMPRE ahí.
  Publicar `dist-pagina/pagina-multi.html` con `files: {"juego.js": "dist-pagina/juego.js", "juego.css": "dist-pagina/juego.css"}`
  (la plataforma rechaza la página de un solo archivo con un aviso de "pr-review"). Se genera con `npm run build:pagina`.
- Página de progreso: https://claude.ai/artifact/7vXXuwinLXVU3miaJYuGnj (fuente `docs/progreso.html`, array `FASES`).
  Actualizar `ACTUALIZADO` y los estados al terminar cada paso y volver a publicar el mismo archivo.
- Archivo para abrir sin la plataforma: `dist-pagina/la-roda-city-completo.html` (lleva `<meta charset>`; sin él se ven mal las tildes).
- Trabajar en pasos pequeños y cerrados: probar, hacer commit y actualizar progreso al acabar cada uno,
  para que un corte de sesión no deje nada a medias.
- Web pública: https://jqnlopezfernandez-crypt.github.io/La-Roda-City/ (repositorio jqnlopezfernandez-crypt/La-Roda-City,
  se publica solo al subir a main). Subir con `python3 tools/publicar_github.py /home/claude/la-roda-city "mensaje"` y `git push`
  desde el clon: ese script deja fuera las imágenes privadas de `public/referencias/` (el usuario no quiere publicarlas).
- Servidor multijugador: https://la-roda-city-servidor.onrender.com (Render, plan gratuito, Blueprint `render.yaml`;
  se despliega solo al subir a main). El flujo de Pages usa `wss://la-roda-city-servidor.onrender.com` por defecto.
- El contenedor no llega a github.io ni a onrender.com: para comprobarlos usar WebFetch (p. ej. `/salud`).
