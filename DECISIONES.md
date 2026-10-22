# DECISIONES.md — decisiones, limitaciones y problemas abiertos

## Decisiones técnicas
| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-10-20 | Geometría desde el **trazado sobre negro**, no desde la captura de Apple Maps | Es el dibujo del usuario; la captura solo se usa para comprobar. Ambos encajan 1:1 (desplazamiento 744,160). |
| 2026-10-20 | Escala uniforme `MAP_SCALE = 5` px de mundo por px del trazado | Una sola escala conserva ángulos, curvas y proporciones. |
| 2026-10-20 | Ancho de calle de juego = 9 px del trazado | La manzana más estrecha mide 26 px entre ejes; con 9 px sigue visible y sólida. Es jugabilidad, no mueve calles. |
| 2026-10-20 | Suavizado de líneas centrales (RDP 1,2 px + Chaikin sin redondear esquinas > 55°) | Elimina los escalones de píxel al ampliar ×5. Medido: sigue dentro del trazo (máx. 2 px). |
| 2026-10-20 | Manzanas = caras cerradas de la red de ejes | Así no quedan cuñas vacías en los cruces agudos. |
| 2026-10-20 | Tejados y patios **solo dentro** de las manzanas cerradas | Fuera del casco el dibujo no indica edificios: no se inventan. |
| 2026-10-20 | Colisiones propias (cápsulas) en vez de físicas Arcade | Mismo código en cliente y servidor; el servidor podrá validar movimientos. |
| 2026-10-20 | Colyseus por piezas (`@colyseus/core` + `ws-transport` + `schema`) | El paquete `colyseus` incluye PM2, Redis y auth; además falló al instalar sin Git. |
| 2026-10-20 | Mapa horneado en texturas de 1024 px (resolución 0,75, máx. 16 trozos) | Redibujar el vector cada fotograma es lento en móvil. |
| 2026-10-20 | Código de invitación = id de sala (5 caracteres sin 0/O/1/I/L) | Entrar con `joinById` sin listados públicos. |
| 2026-10-20 | Servidor reenviado por Vite en `/servidor-juego` | Mismo origen y puerto: el navegador de la app y el móvil en la Wi-Fi solo necesitan el 5173. |
| 2026-10-20 | El cliente envía posiciones; el servidor valida velocidad y trayecto por calles | Respuesta inmediata al mover y sin trampas de teletransporte. |
| 2026-10-20 | Roles secretos con `StateView` (`.view()`) | El rol ajeno no llega ni siquiera a los datos del navegador. |
| 2026-10-20 | Gitano solo puede llevarse el cuerpo de SU víctima y este desaparece | Interpretación de "llevarse el cuerpo después de eliminar". |
| 2026-10-20 | 1 impostor hasta 6 jugadores, 2 (Sapo + Gitano) desde 7; un Vilchez | Equilibrio habitual del género. Ajustable en `RULES`. |
| 2026-10-20 | Misión completada = estar en el sitio + tiempo mínimo, validado en servidor | El minijuego no se puede verificar al 100 % en el servidor; así se evita completar a distancia o al instante. |
| 2026-10-20 | Página publicada sin multijugador | Una página publicada no puede conectar con un servidor; el multijugador en internet requiere alojarlo (fase 7). |
| 2026-10-21 | Piscina, parques Europa/Peces/Chicocos, recinto del campo y vías del tren desde las capturas de satélite del usuario (perímetro en naranja) | Cada captura se registró sobre la captura de Apple Maps con puntos comunes (campo de fútbol, Vía Verde, avenidas, vía); las pistas del Parque Europa coinciden con los rectángulos de Apple Maps. Marcadas `aproximada` (±5–8 px del trazado). |
| 2026-10-21 | Vía principal tomada de la línea de vía de la captura de Apple Maps; la vía de la estación y su enlace, de la captura del usuario | Las vías son decorado (no cortan el paso); paso a nivel donde cruzan una calle; las casas y árboles no se colocan encima. La vía de la estación termina en una topera donde acaba la captura. |
| 2026-10-21 | Obstáculos poligonales (vasos de la piscina, vestuarios) y entradas a parques y piscina | Las zonas nuevas quedan fuera del trazado: se añade un acceso desde el extremo de calle más cercano para poder entrar andando. |

## Animaciones y pantallas (22-10-2026)
- Las escenas de reunión, expulsión, revelación y final son HTML + SVG (no Phaser): se leen mejor en el
  móvil, escalan con la pantalla y reutilizan la hoja de sprites del Roeño como fondo CSS.
- Votar se hace tocando al vecino en la plaza (la lista desaparece); "Saltar voto" sigue al lado.
- La fase de resultado pasa de 5 s a 7 s (`RULES.resultMs`) para que dé tiempo a ver irse al expulsado.
- Los minijuegos no se escalan con `transform`/`zoom` (rompería las coordenadas de arrastre): se estrecha
  la zona de juego hasta que la tarjeta cabe en alto.

## Arte pintado de los minijuegos (22-10-2026)
- Fondos en JPEG de 640 px y piezas en PNG de 256 colores: el juego pasa de 3,8 a 5,1 MB. Se acepta a cambio de que
  nada parezca vectorial; si pesa en móviles, se puede bajar más la calidad de los fondos.
- Las piezas se tiñen al integrarlas (el modelo las da casi en sepia por la lámina de referencia).
- Se quedan en SVG: paquetes de tabaco (llevan el nombre de la marca), monedas y pastillas (las pintadas salieron mal),
  el salabre y la estatua decapitada; la carne del kebab sigue siendo dibujo, ahora con volumen.
- El vaso del cubata se pinta dos veces (semitransparente debajo y en multiplicar encima) para que el líquido se vea
  dentro del cristal.

## Limitaciones conocidas
- **Escala real desconocida.** No hay barra de escala legible; las distancias del juego no son metros.
- **Edificios fuera de las manzanas cerradas**: el dibujo no los incluye, así que allí se ve campo.
- **Trazo gris vs blanco**: el centro del casco está dibujado en gris. Se guarda el atributo
  (`trazo` en cada tramo) pero no se le da significado hasta que el usuario lo explique.
- **Posiciones de lugares**: tomadas de los puntos rojos (±2 px en los leídos a mano). Ninguna verificada.
- **Número 21**: no existe en la lista ni en el dibujo.

## Preguntas abiertas para el usuario
1. ¿Las posiciones de los lugares son correctas? (Se pueden revisar en el juego con la tecla R.)
2. ¿Qué significa el trazo gris del centro? (¿calles peatonales, casco antiguo…?)
3. ¿Dónde están Madishon, Calle Rosa (números 4 y 5) y la Casa de la Juventud?
4. ¿"Fregar platos" en Martín, Monforte y Leiva es una misión en uno de los tres (como ahora, al azar) o hay que fregar en los tres?
5. ¿El Gitano debe poder llevarse cualquier cuerpo o solo el de su víctima (como ahora)?
