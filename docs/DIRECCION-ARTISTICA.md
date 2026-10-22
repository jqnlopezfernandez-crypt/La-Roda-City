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

## Primera tanda integrada (22-10-2026)
Comparado en el juego con capturas de antes y después:
- **Entran**: tejas (3), asfalto, acera, empedrado, losas de plaza, banco, buganvilla, maceta, pilón,
  papelera y farola. Las tejas dibujadas a mano son la mejora más visible. Unos 150 KB en total.
- **Se quedan como estaban**: naranjo y olivo (los nuevos salían pálidos, como bonsáis en maceta, y se
  leían peor en los parques), fachadas y edificios singulares (SDXL base los dibuja como bocetos de
  arquitecto europeo, recargados y nada andaluces), estatua (no tenía los brazos abiertos), tierra,
  campo y césped.
- Siguiente intento para fachadas y edificios: dar al modelo una imagen de referencia del estilo
  (IP-Adapter, Apache 2.0) con las láminas de Joaquín, en lugar de describirlo solo con palabras.

## Segunda tanda: misiones y edificios con estilo de referencia (22-10-2026)
- Encargo `tools/kaggle/misiones.json`: 14 escenas de minijuego, 19 piezas (vasos, botellas, balones, pez,
  cuchillo, monedas…), fachadas del Ayuntamiento, la Iglesia, la Estación y el Cuartel, y naranjo/olivo.
- El estilo se da con una imagen (IP-Adapter, InstantStyle, solo bloques de estilo) sacada de las láminas de
  Joaquín. Las láminas se escriben en el cuaderno de Kaggle y no se publican en el repositorio.
- Con el IP-Adapter el modelo no cabe entero en la T4 (15 GB): las partes se suben a la GPU solo al usarse
  (`enable_model_cpu_offload`).
- Prueba con 4 piezas (cubata, vaso, barra del bar, Ayuntamiento): ahora sí sale dibujo animado con tinta,
  cal y arcos, mucho más cerca de las láminas que la primera tanda. Sale algo apagado (sepia): al integrarlo
  se sube el color con `entonar()`.
- Los minijuegos usarán `src/art/pintadoMg.ts`: fondo pintado (`pintado/mg/escena-*.jpg`) y piezas con
  transparencia (`pintado/mg/pieza-*.png`), con el SVG de siempre como reserva si falta una imagen.

## Licencias
- SDXL base 1.0: CreativeML Open RAIL++-M (uso comercial permitido, con restricciones de uso).
- rembg + u2net: Apache 2.0. No usar el modelo «bria-rmbg» (no comercial).
- Skill `game-art` (guía de principios): CC BY 4.0, de sickn33/agentic-awesome-skills.

## Resultado de la segunda tanda (22-10-2026)
- Entran: 14 fondos de minijuego y 16 piezas (ver `tools/integrar_mg.py`), y las fachadas del Cuartel (dos plantas con
  puertas verdes) y de la Estación (arcos) en el mapa (`tools/kaggle/elecciones-misiones.json`).
- No entran: textura de la peluquería (salió como mosaico roto), moneda (con cara), pastilla, cabeza de la estatua,
  salabre y las fachadas del Ayuntamiento y la Iglesia (salieron como perfil de tejados con cielo). Para esas fachadas
  hace falta otra tanda pidiendo «solo el muro, sin cielo ni tejado».

## Tercera tanda (22-10-2026)
- Entran: agua del río y de la piscina (suavizadas y teñidas), arriate de geranios, olivo y pino de campo, piedras,
  fachadas del Ayuntamiento (muro de dos plantas con arcos y balcón) e Iglesia (recortes sin cielo), moneda, cabeza
  de la estatua, carne del kebab y suelo de la peluquería. Se integran con `python3 tools/integrar_mg.py <carpeta> mapa`
  y `tools/kaggle/elecciones-tanda3.json`.
- No entran: césped, campo y tierra (salieron recargados para el mapa), cañas y nenúfares (sin fondo limpio), cápsula,
  pastilla y salabre.
