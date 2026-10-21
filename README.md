# La Roda City

Juego web 2D cenital de deducción social ambientado en **La Roda de Andalucía (Sevilla)**.
Phaser 3 + TypeScript + Vite en el cliente; Node.js + Colyseus para el multijugador (en desarrollo).

> Estado detallado y probado: [`PLAN.md`](PLAN.md) · Decisiones y limitaciones: [`DECISIONES.md`](DECISIONES.md)

## Qué funciona ahora
- Mapa de La Roda generado a partir de **tu trazado original**, con colisiones: solo se camina por las calles.
- 29 lugares numerados de tu dibujo, marcados como *sin verificar*.
- **Multijugador en red local**: salas privadas con código o enlace, anfitrión, reconexión.
- **Roles**: Sapo y Gitano (impostores), Roeño y Vilchez (vecinos); eliminaciones, cuerpos,
  reuniones, votaciones y victoria, todo decidido por el servidor.
- **Misiones** en 8 lugares del dibujo con minijuegos táctiles y ruta guiada.
- **Página publicada** para probar en el iPad: mapa y práctica de misiones en solitario.

## Usarlo en Windows sin terminal
| Archivo | Para qué |
|---|---|
| `instalar-node.bat` | Instala Node.js LTS (solo la primera vez; ya está hecho en tu PC). |
| `comprobar-proyecto.bat` | Instala dependencias y compila. Resultado en `comprobacion.log`. |
| `arrancar-juego.bat` | Arranca el servidor multijugador y el juego. Abre `http://localhost:5173`. Cierra las dos ventanas para pararlo. |

## Con terminal
```bash
npm install
npm run server:dev   # servidor multijugador (puerto 2567)
npm run dev          # juego en http://localhost:5173
npm test             # pruebas automáticas
npm run build        # cliente de producción en dist/
npm run server:build # servidor de producción en dist-server/
npm run build:pagina # página de un solo archivo (sin servidor) en dist-pagina/
```

## Jugar con amigos en la misma Wi-Fi
Con `arrancar-juego.bat` abierto, la ventana muestra una dirección "Network" (p. ej. `http://192.168.1.20:5173`).
Todos la abren en el móvil; uno pulsa **Crear sala privada** y comparte el código o el enlace; el anfitrión
pulsa **Empezar partida** cuando hay al menos 4. Windows puede pedir permiso de firewall la primera vez
(acepta para redes privadas).

## Controles
| Acción | Teclado | Móvil |
|---|---|---|
| Moverse | WASD / flechas | joystick (mitad izquierda) |
| Misión / ver lugar | E | ✋ |
| Eliminar (impostor) | Q | 🔪 |
| Reportar cuerpo | F | 📣 |
| Llevarse cuerpo (Gitano) | C | 🧺 |
| Reunión (Ayuntamiento o Vilchez) | X | 🔔 |
| Ver trazado / mapa de referencia | R / M | botones arriba a la derecha |

## Mapa: de dónde sale y cómo regenerarlo
- Fuente: `public/referencias/trazado-fondo-negro-original.jpeg` (no se modifica nunca).
- `python tools/extraer_calles.py` → `shared/map/streets.generated.json` y la imagen de revisión
  `public/referencias/_extraccion-calles.png`.
- `python tools/comprobar_alineacion.py` → comprueba que el trazado encaja 1:1 en la captura.
- Requisitos Python: `pip install opencv-python numpy scipy scikit-image`.

## Estructura
Ver [`CLAUDE.md`](CLAUDE.md).

## Publicación
Pendiente (fase 7). Necesitará una cuenta de GitHub (frontend en GitHub Pages) y un servicio
Node.js para el servidor. No se ha publicado nada.
