# Dirección artística de La Roda City

Referencias de Joaquín: «El Abuelo» (hoja de diseño con 10 colores), la lámina de «Lugares clave»
y el «Tablero conceptual» (pantalla de juego, casas modulares, interfaz). Inspiración general:
dibujo animado oscuro y artesanal, sin copiar personajes ni recursos de otros juegos.

## Estilo
- Dibujo animado oscuro: contorno de tinta negro y grueso, algo tembloroso; sombreado sencillo
  (dos o tres tonos), sin degradados fotográficos.
- Paleta terrosa y apagada: cal crema, albero ocre, teja rojiza y marrón, verde oliva, piedra gris
  cálida, y noches violetas y azules. Los colores vivos se reservan para lo que importa en el juego:
  jugadores, misiones, avisos y sabotajes.
- Vista de 3/4 desde arriba en el mapa; los personajes de pie, de frente o de lado.

## Dos niveles de detalle (decisión de Joaquín, 22-10-2026)
| Nivel | Qué es | Detalle |
|---|---|---|
| **Mapa** | Fachadas corrientes, suelos, tejados, árboles, farolas, bancos, macetas | Poco: formas limpias, sin grietas ni suciedad. Se repiten muchísimo y tienen que leerse rápido y pesar poco. |
| **Singular** | Ayuntamiento, Iglesia, Estación, Cuartel, estatua del Sagrado y lugares de interés | Algo más de detalle: son los sitios donde pasan las cosas. |
| **Escenas** | Minijuegos, reunión, expulsión, revelación del papel, final | El máximo: se ven en grande y de una en una. |

## Animación (principios aplicados)
- **Acción secundaria:** los árboles se mecen, caen hojas y pétalos, las farolas parpadean y los
  personajes respiran en reposo. Solo se calcula lo que está en pantalla.
- **Estirar y encoger:** al pisar, al saltar al completar una misión y al caer.
- **Anticipación:** el personaje se encoge antes del salto, y la palanca de la tragaperras baja antes de
  que giren los rodillos.
- **Entrada y salida suaves** en todas las pantallas; los golpes (sellos, «¡ZAS!») entran de golpe y con rebote.
- Todo respeta la opción del sistema «reducir movimiento».

## Producción de piezas (gratis)
- Generación con Stable Diffusion XL en Kaggle (GPU gratuita, unas 30 h por semana):
  `tools/kaggle/generar_piezas.py` con el encargo `tools/kaggle/piezas.json`.
  - Texturas repetibles sin costura (relleno circular de la red).
  - Fachadas como tiras continuas sin costura en horizontal (obliga a la vista de frente).
  - Objetos sobre fondo liso, que luego se quita con rembg/u2net (Apache 2.0).
- Integración: `python3 tools/integrar_arte.py <carpeta> <elecciones.json>` ajusta cada pieza al tamaño
  exacto de su entrada en `src/art/index.ts` y la deja en `src/art/pintado/<clave>.png` con 256
  colores. El juego usa ese PNG en lugar del dibujo SVG sin tocar mapa, colisiones ni animaciones.
- Rendimiento en el móvil: el mapa se hornea en trozos de 1024 px, así que el detalle de las piezas
  no cuesta en cada fotograma; lo que cuenta es el peso de la página, y por eso se reducen las piezas
  a su tamaño final y a 256 colores.

## Licencias
- SDXL base 1.0: CreativeML Open RAIL++-M (uso comercial permitido, con restricciones de uso).
- rembg + u2net: Apache 2.0. No usar el modelo «bria-rmbg» (no comercial).
- Skill `game-art` (guía de principios): CC BY 4.0, de sickn33/agentic-awesome-skills.
