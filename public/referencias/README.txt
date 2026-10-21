REFERENCIAS DEL MAPA — LA RODA CITY
===================================

Archivos originales (no editar; son la fuente de verdad del trazado):

  mapa-con-trazado-original.jpeg      Captura de Apple Maps (iPad, 2360x1600) con el
                                      trazado de calles en blanco y los puntos en rojo.
  trazado-fondo-negro-original.jpeg   Solo el trazado y los puntos, sobre negro (1100x1081).
  mapa-con-trazado-whatsapp.jpeg      Copia recomprimida por WhatsApp (2048x1388). Solo consulta.
  trazado-fondo-negro-whatsapp.jpeg   Copia recomprimida por WhatsApp (1100x1081). Solo consulta.

Para extraer geometría se usan SIEMPRE los dos "-original"; las copias de WhatsApp
tienen más compresión y la captura de mapa está reescalada.

Relación medida entre las dos imágenes originales (tools/comprobar_alineacion.py):
  El trazado sobre negro es un recorte exacto de la captura, a escala 1:1, sin giro.
  Píxel (x, y) del trazado  =  píxel (x + 744, y + 160) de la captura.
  Distancia mediana entre trazos tras alinear: 0 px (p99: 0,95 px).
  _comprobacion-alineacion.jpg muestra el trazado (rojo) encima del mapa.

Lo que NO se conoce todavía:
  - La escala en metros. La captura no tiene barra de escala legible; no se inventa.
    Si hace falta, se calcula midiendo en Apple Maps la distancia entre dos cruces.
  - Coordenadas GPS. No son necesarias para el juego.

Mediciones del trazado (tools/medir_manzanas.py), en píxeles del trazado:
  - Grosor del trazo: mediana 5,6 px.
  - Red de calles: 1 sola pieza conectada, una vez se tratan como calle los puntos
    rojos pintados encima del trazo (el punto del 26 cortaba la avenida norte).
  - 16 manzanas cerradas. La más estrecha mide 22 px de ancho (el rectángulo de la
    izquierda, junto a 17/19); la siguiente 24 px (triángulo junto a Taberna Monforte).
    => El ancho jugable de calle debe quedar por debajo de ~20 px del trazado, o
       esas manzanas desaparecerían al ensanchar las calles.

Imágenes generadas (se pueden regenerar, empiezan por "_"):
  _comprobacion-alineacion.jpg  trazado (rojo) sobre la captura, tras alinear.
  _extraccion-calles.png        resultado de tools/extraer_calles.py: ejes de calle (azul =
                                trazo blanco, amarillo = trazo gris), cruces (verde),
                                extremos (rojo) y manzanas (contorno rojo).
