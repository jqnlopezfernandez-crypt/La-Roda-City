"""Mete en el juego las ilustraciones de los minijuegos generadas en Kaggle (tools/kaggle/misiones.json).

Uso:
    python3 tools/integrar_mg.py <carpeta del zip descomprimido>

- Escenas -> src/art/pintado/mg/<clave>.jpg (640 px de ancho, JPEG): fondos de los minijuegos.
- Piezas  -> src/art/pintado/mg/<clave>.png (con transparencia, 256 colores): objetos que se mueven.

El modelo las saca casi en sepia (por la lámina de referencia), así que cada una se colorea:
se sube la saturación y se tiñen los tonos medios con el color propio del objeto, sin tocar la
tinta negra ni los brillos. Las piezas que no salieron bien se quedan con su dibujo SVG.
"""
import os
import sys

from PIL import Image, ImageChops, ImageEnhance, ImageOps

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "src", "art", "pintado", "mg")

# clave: (archivo, tinte de los tonos medios o None, fuerza del tinte, saturación, recorte en fracciones o None)
ESCENAS = {
    "escena-bar": ("escena-bar__1000.png", "#c98a4e", 0.35, 1.5, None),
    "escena-barra": ("escena-bar__1037.png", "#c98a4e", 0.35, 1.5, None),
    "escena-caja": ("escena-caja__1037.png", "#c98a4e", 0.3, 1.5, None),
    "escena-canasta": ("escena-canasta__1037.png", "#e0a060", 0.3, 1.7, None),
    "escena-estanco": ("escena-estanco__1037.png", "#c98a4e", 0.3, 1.5, None),
    "escena-estanque": ("escena-estanque__1037.png", "#6fae6a", 0.4, 1.7, None),
    "escena-farmacia": ("escena-farmacia__1037.png", "#5aa58a", 0.35, 1.5, None),
    "escena-fregadero": ("escena-fregadero__1037.png", "#9fb5c0", 0.3, 1.4, None),
    "escena-kebab": ("escena-kebab__1037.png", "#d07a3a", 0.35, 1.5, None),
    "escena-piscina": ("escena-piscina__1037.png", "#3fa6cf", 0.45, 1.7, None),
    "escena-porteria": ("escena-porteria__1037.png", "#6fa84f", 0.35, 1.6, None),
    "escena-rezar": ("escena-rezar__1037.png", "#8a78b0", 0.3, 1.4, None),
    "escena-riada": ("escena-riada__1037.png", "#6f8f7a", 0.3, 1.4, None),
    "escena-tren": ("escena-tren__1037.png", "#c98a4e", 0.3, 1.5, None),
}
PIEZAS = {
    # clave: (archivo en sprites/ o candidatas/, tinte, fuerza, saturación, recorte, lado máximo)
    "pieza-balon-basket": ("pieza-balon-basket__1037.png", "#e0782e", 0.6, 1.8, None, 160),
    "pieza-balon-futbol": ("pieza-balon-futbol__1037.png", None, 0, 1.0, None, 140),
    "pieza-botella-cola": ("pieza-botella-cola__1037.png", "#5a2a14", 0.35, 1.6, None, 300),
    "pieza-botella-ron": ("pieza-botella-ron__1037.png", "#d08a2e", 0.55, 1.6, None, 300),
    "pieza-caca": ("pieza-caca__1037.png", "#7a4a22", 0.55, 1.6, None, 140),
    "pieza-cubata": ("pieza-cubata__1037.png", "#7a3a1a", 0.45, 1.7, None, 260),
    "pieza-cuchillo": ("pieza-cuchillo__1037.png", "#b8c4cc", 0.2, 1.2, None, 300),
    "pieza-hielo": ("pieza-hielo__1037.png", "#bfe6f2", 0.5, 1.3, (0.33, 0.31, 0.73, 0.77), 90),
    "pieza-pez": ("pieza-pez__1037.png", "#f08a24", 0.7, 2.0, None, 150),
    "pieza-plato": ("pieza-plato__1037.png", "#d9c9a6", 0.25, 1.3, None, 420),
    "pieza-portero": ("pieza-portero__1037.png", "#e2a33a", 0.45, 1.7, None, 260),
    "pieza-saco": ("pieza-saco__1037.png", "#b89a62", 0.5, 1.5, None, 160),
    "pieza-tarjeta": ("pieza-tarjeta__1037.png", "#e2a33a", 0.5, 1.6, None, 220),
    "pieza-vaso": ("pieza-vaso__1037.png", "#cfe6ee", 0.25, 1.2, None, 300),
    "pieza-vela": ("pieza-vela__1037.png", "#efe0b8", 0.35, 1.3, None, 220),
}
# piezas que se toman del dibujo con fondo (rembg recortó mal): rectángulo exacto
CON_FONDO = {"pieza-tarjeta"}


def tenir(im, color, fuerza, saturacion):
    """Tiñe los tonos medios con `color` (la tinta oscura y los brillos se quedan) y sube la saturación."""
    alfa = im.getchannel("A") if im.mode == "RGBA" else None
    rgb = im.convert("RGB")
    if color and fuerza > 0:
        gris = ImageOps.grayscale(rgb)
        # máscara: 0 en negros y blancos, máxima en los medios
        medio = gris.point(lambda v: int(255 * max(0.0, 1 - abs(v - 140) / 115) * fuerza))
        tinte = ImageOps.colorize(gris, black="#1a120c", mid=color, white="#fbf4e4")
        rgb = Image.composite(tinte, rgb, medio)
    rgb = ImageEnhance.Color(rgb).enhance(saturacion)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.08)
    if alfa is not None:
        rgb.putalpha(alfa)
    return rgb


def recortar(im, caja):
    if not caja:
        return im
    x0, y0, x1, y1 = caja
    return im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))


def main(carpeta):
    os.makedirs(DESTINO, exist_ok=True)
    total = 0
    for clave, (nombre, color, fuerza, sat, caja) in ESCENAS.items():
        im = recortar(Image.open(os.path.join(carpeta, "candidatas", nombre)), caja)
        im = tenir(im, color, fuerza, sat)
        im = im.resize((640, round(640 * im.height / im.width)), Image.LANCZOS)
        ruta = os.path.join(DESTINO, f"{clave}.jpg")
        im.save(ruta, quality=70, optimize=True, progressive=True)
        total += os.path.getsize(ruta)
        print(f"{clave:22s} {im.size} {os.path.getsize(ruta) // 1024} KB")
    for clave, (nombre, color, fuerza, sat, caja, lado) in PIEZAS.items():
        sub = "candidatas" if clave in CON_FONDO else "sprites"
        im = recortar(Image.open(os.path.join(carpeta, sub, nombre)).convert("RGBA"), caja)
        if clave in CON_FONDO:
            # la tarjeta es el rectángulo del dibujo, sin el margen de papel
            gris = ImageOps.grayscale(im)
            bb = ImageOps.invert(gris).point(lambda v: 255 if v > 90 else 0).getbbox()
            if bb:
                im = im.crop(bb)
        else:
            bb = im.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
            if bb:
                im = im.crop(bb)
            # borde limpio: fuera los restos semitransparentes del recorte
            a = im.getchannel("A").point(lambda v: 0 if v < 40 else (255 if v > 200 else v))
            im.putalpha(a)
        if clave == "pieza-vela":
            # sin la llama pintada: en el juego la vela se enciende poco a poco
            im = im.crop((0, round(im.height * 0.33), im.width, im.height))
        im = tenir(im, color, fuerza, sat)
        k = min(1.0, lado / max(im.size))
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        out = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        ruta = os.path.join(DESTINO, f"{clave}.png")
        out.save(ruta, optimize=True)
        total += os.path.getsize(ruta)
        print(f"{clave:22s} {im.size} {os.path.getsize(ruta) // 1024} KB")
    print(f"TOTAL {total // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1])
