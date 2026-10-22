"""Mete en el juego las piezas generadas en Kaggle (tools/kaggle/generar_piezas.py).

Uso:
    python3 tools/integrar_arte.py <carpeta del zip descomprimido> <elecciones.json>

elecciones.json: {"clave_del_juego": "nombre_candidata.png" | {"img": ..., "recorte": [x0, y0, x1, y1]}, ...}
  p. ej. {"naranjo": "naranjo__1037.png", "fachada-1-0": {"img": "fachada-1__1074.png", "recorte": [0, 0.35, 1, 1]}}
  recorte: parte de la imagen que se usa, en fracciones (0–1) de ancho y alto.

Cada pieza se ajusta al tamaño exacto de su entrada en src/art/index.ts (w × h × scale) y se
guarda en src/art/pintado/<clave>.png, que sustituye al dibujo SVG automáticamente. Para que el
juego siga yendo fluido en el móvil las imágenes se reducen a ese tamaño y a 256 colores.
"""
import json
import os
import re
import sys

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "src", "art", "pintado")

# Tamaños (w, h, scale, oy) copiados de src/art/index.ts; oy = altura relativa del punto de apoyo
CONST = {"HOUSE_W": 120, "HOUSE_H": 84, "CORNER_W": 52, "CORNER_H": 84}
LANDMARK = {
    "iglesia": {"largo": (190, 70), "corto": (80, 86)},
    "ayuntamiento": {"largo": (190, 64), "corto": (70, 64)},
    "estacion": {"largo": (220, 56), "corto": (60, 56)},
    "cuartel": {"largo": (160, 52), "corto": (60, 52)},
}
SPRITES = {  # clave: (w, h, scale, oy)
    "naranjo": (64, 84, 1.5, 0.93),
    "olivo": (72, 84, 1.5, 0.93),
    "arbusto": (44, 32, 1.5, 0.84),
    "farola": (26, 80, 1.5, 0.95),
    "banco": (52, 30, 1.5, 0.85),
    "maceta": (20, 24, 1.5, 0.95),
    "buganvilla": (40, 56, 1.5, 0.95),
    "pilon": (64, 44, 1.5, 0.88),
    "papelera": (16, 26, 1.5, 0.95),
    "estatua": (68, 128, 2, 0.95),
}
TEXTURAS = {  # clave: lado en píxeles de la textura
    "suelo-asfalto": 256,
    "suelo-acera": 128,
    "suelo-empedrado": 128,
    "suelo-tierra": 512,
    "suelo-campo": 512,
    "suelo-cesped": 512,
    "suelo-losas": 128,
    "teja-0": 96,
    "teja-1": 96,
    "teja-2": 96,
}


def tamano_muro(clave):
    if clave.startswith("fachada-"):
        return round(CONST["HOUSE_W"] * 1.5), round(CONST["HOUSE_H"] * 1.5)
    if clave.startswith("esquina-"):
        return round(CONST["CORNER_W"] * 1.5), round(CONST["CORNER_H"] * 1.5)
    m = re.match(r"edificio-(\w+)-(largo|corto)$", clave)
    if m:
        w, h = LANDMARK[m.group(1)][m.group(2)]
        return round(w * 1.5), round(h * 1.5)
    if clave == "torre-iglesia-muro":
        return 72, 240
    if clave == "torre-ayuntamiento-muro":
        return 60, 160
    return None


def reducir(im):
    """256 colores (con transparencia si la hay): archivos pequeños y rápidos de cargar."""
    if im.mode == "RGBA":
        return im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    return im.convert("RGB").quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def entonar(im, color=1.3, contraste=1.15, brillo=0.9):
    """Lleva la pieza a la paleta del juego: algo más de color y contraste y menos blanco
    (el modelo tiende a tonos lavados de boceto; las láminas de referencia son más oscuras)."""
    alfa = im.getchannel("A") if im.mode == "RGBA" else None
    rgb = im.convert("RGB")
    rgb = ImageEnhance.Color(rgb).enhance(color)
    rgb = ImageEnhance.Contrast(rgb).enhance(contraste)
    rgb = ImageEnhance.Brightness(rgb).enhance(brillo)
    if alfa is not None:
        rgb.putalpha(alfa)
    return rgb


def simplificar(im, colores=10):
    """Para objetos pequeños: quita el detalle fino (líneas de boceto, texturas) y deja manchas
    planas de pocos colores con un contorno de tinta limpio, que es lo que se lee a ese tamaño."""
    im = im.convert("RGBA")
    alfa = im.getchannel("A").point(lambda a: 255 if a > 110 else 0)
    rgb = im.convert("RGB").filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MedianFilter(5))
    rgb = rgb.quantize(colores, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    rgb = rgb.filter(ImageFilter.ModeFilter(5))
    # contorno: el borde de la silueta en tinta
    borde = ImageChops.subtract(alfa.filter(ImageFilter.MaxFilter(7)), alfa)
    tinta = Image.new("RGB", rgb.size, (34, 24, 18))
    rgb = Image.composite(tinta, rgb, borde)
    out = rgb.convert("RGBA")
    out.putalpha(ImageChops.lighter(alfa, borde))
    return out


def ajustar_sprite(im, w, h, oy):
    """Recorta al contenido y lo coloca de pie en un lienzo w×h, con la base en oy."""
    im = im.convert("RGBA")
    caja = im.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    if caja:
        im = im.crop(caja)
    base = round(h * oy)
    escala = min(w / im.width, base / im.height)
    im = im.resize((max(1, round(im.width * escala)), max(1, round(im.height * escala))), Image.LANCZOS)
    lienzo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    lienzo.paste(im, ((w - im.width) // 2, base - im.height), im)
    return lienzo


def main(carpeta, elecciones):
    os.makedirs(DESTINO, exist_ok=True)
    for clave, eleccion in json.load(open(elecciones)).items():
        nombre = eleccion if isinstance(eleccion, str) else eleccion["img"]
        sprite = os.path.join(carpeta, "sprites", nombre)
        ruta = sprite if os.path.exists(sprite) else os.path.join(carpeta, "candidatas", nombre)
        im = Image.open(ruta)
        if isinstance(eleccion, dict) and "recorte" in eleccion:
            x0, y0, x1, y1 = eleccion["recorte"]
            im = im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))
        if clave in SPRITES:
            w, h, s, oy = SPRITES[clave]
            if isinstance(eleccion, dict) and eleccion.get("simple"):
                # se simplifica a un tamaño intermedio (unas 4 veces el final) y luego se reduce
                im = im.convert("RGBA")
                caja = im.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
                if caja:
                    im = im.crop(caja)
                k = min(4 * w * s / im.width, 4 * h * s / im.height, 1)
                im = simplificar(im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS))
            out = entonar(ajustar_sprite(im, round(w * s), round(h * s), oy))
        elif clave in TEXTURAS:
            lado = TEXTURAS[clave]
            out = entonar(im.convert("RGB").resize((lado, lado), Image.LANCZOS), 1.25, 1.1, 0.92)
        elif tamano_muro(clave):
            out = entonar(im.convert("RGB").resize(tamano_muro(clave), Image.LANCZOS), 1.45, 1.1, 0.95)
        else:
            print("clave desconocida, se salta:", clave)
            continue
        destino = os.path.join(DESTINO, f"{clave}.png")
        reducir(out).save(destino, optimize=True)
        print(f"{clave:32s} <- {nombre:32s} {out.size} {os.path.getsize(destino) // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
