"""Genera en Kaggle (gratis, GPU T4) las piezas de arte de La Roda City descritas en piezas.json.

Uso en una celda de Kaggle (Accelerator = GPU T4 x2, Internet activado):
    !wget -q https://raw.githubusercontent.com/jqnlopezfernandez-crypt/La-Roda-City/<commit>/tools/kaggle/generar_piezas.py \
          https://raw.githubusercontent.com/jqnlopezfernandez-crypt/La-Roda-City/<commit>/tools/kaggle/piezas.json \
     && (CUDA_VISIBLE_DEVICES=0 python generar_piezas.py 0 & CUDA_VISIBLE_DEVICES=1 python generar_piezas.py 1 & wait) \
     && python generar_piezas.py post

- Modelo: Stable Diffusion XL base 1.0 (CreativeML Open RAIL++-M: permite uso comercial con restricciones de uso).
- Quitar fondo: rembg con el modelo u2net (Apache 2.0).
- Salida en /kaggle/working: candidatas/*.png, sprites/*.png (con transparencia), hojas/*.jpg
  (hojas de muestra con el nombre de cada candidata) y la-roda-piezas.zip.
Usa las versiones de diffusers/torch que ya trae Kaggle (no las actualiza: se rompen otras cosas).
"""
import glob
import json
import os
import subprocess
import sys
import zipfile

OUT = "/kaggle/working"
SPEC = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "piezas.json")))
CANDIDATAS = 2  # por pieza (las fachadas generan variantes x 2)


def trabajos():
    """Lista ordenada de (pieza, semilla) a generar."""
    out = []
    for p in SPEC["piezas"]:
        n = p.get("variantes", 1) * CANDIDATAS
        for k in range(n):
            out.append((p, 1000 + k * 37))
    return out


def prompt_de(p):
    e = SPEC["estilo"]
    # lo importante va primero: lo que pase de 77 tokens se pierde por el final
    if p["tipo"] == "fachada":
        return f"orthographic flat front elevation drawing, {p['prompt']}, {e['fachada']}, {e['base']}, {e[p['nivel']]}"
    return f"{p['prompt']}, {e[p['tipo']]}, {e['base']}, {e[p['nivel']]}"


def negativo_de(p):
    e = SPEC["estilo"]
    return e["negativo_sprite"] if p["tipo"] == "sprite" else e["negativo"]


PRUEBA = ["fachada-0", "fachada-3", "esquina", "farola", "olivo", "edificio-iglesia-corto", "suelo-cesped", "teja-1"]


def generar(parte, prueba=False):
    import torch
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, variant="fp16", use_safetensors=True
    ).to("cuda")
    pipe.set_progress_bar_config(disable=True)
    convs = [m for m in list(pipe.unet.modules()) + list(pipe.vae.modules()) if isinstance(m, torch.nn.Conv2d)]

    def circular(on):  # texturas repetibles: el borde izquierdo continúa en el derecho (y arriba/abajo)
        for m in convs:
            m.padding_mode = "circular" if on else "zeros"

    os.makedirs(f"{OUT}/candidatas", exist_ok=True)
    lista = trabajos()
    if prueba:
        vistas = set()
        lista = [(p, s) for p, s in lista if p["clave"] in PRUEBA and not (p["clave"] in vistas or vistas.add(p["clave"]))]
    for i, (p, semilla) in enumerate(lista):
        if not prueba and i % 2 != parte:
            continue
        ruta = f"{OUT}/candidatas/{p['clave']}__{semilla}.png"
        if os.path.exists(ruta):
            continue
        circular(p["tipo"] == "textura")
        img = pipe(
            prompt=prompt_de(p),
            negative_prompt=negativo_de(p),
            num_inference_steps=28,
            guidance_scale=6.0,
            width=p["w"],
            height=p["h"],
            generator=torch.Generator("cuda").manual_seed(semilla),
        ).images[0]
        img.save(ruta)
        print(f"[{parte}] {i + 1}/{len(lista)} {os.path.basename(ruta)}", flush=True)


def post():
    from PIL import Image, ImageDraw

    # 1) Fondo transparente para los objetos sueltos
    os.makedirs(f"{OUT}/sprites", exist_ok=True)
    sprites = {p["clave"] for p in SPEC["piezas"] if p["tipo"] == "sprite"}
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "rembg", "onnxruntime"], check=True)
        from rembg import new_session, remove

        sesion = new_session("u2net")
        for ruta in sorted(glob.glob(f"{OUT}/candidatas/*.png")):
            if os.path.basename(ruta).split("__")[0] in sprites:
                remove(Image.open(ruta), session=sesion).save(ruta.replace("candidatas", "sprites"))
        print("fondos quitados", flush=True)
    except Exception as e:  # no es grave: se puede hacer después
        print("no se pudo quitar el fondo:", e, flush=True)

    # 2) Hojas de muestra (una por tipo) con el nombre debajo de cada candidata
    os.makedirs(f"{OUT}/hojas", exist_ok=True)
    for tipo in ("textura", "fachada", "sprite"):
        claves = [p["clave"] for p in SPEC["piezas"] if p["tipo"] == tipo]
        rutas = [r for r in sorted(glob.glob(f"{OUT}/candidatas/*.png")) if os.path.basename(r).split("__")[0] in claves]
        if not rutas:
            continue
        T, cols = 220, 8
        filas = (len(rutas) + cols - 1) // cols
        hoja = Image.new("RGB", (cols * T, filas * (T + 18)), (40, 34, 30))
        d = ImageDraw.Draw(hoja)
        for k, r in enumerate(rutas):
            im = Image.open(r).convert("RGB")
            im.thumbnail((T, T))
            x, y = (k % cols) * T, (k // cols) * (T + 18)
            hoja.paste(im, (x + (T - im.width) // 2, y + (T - im.height) // 2))
            d.text((x + 4, y + T + 2), os.path.basename(r)[:-4], fill=(240, 230, 210))
        hoja.save(f"{OUT}/hojas/{tipo}.jpg", quality=88)

    # 3) Todo en un zip
    with zipfile.ZipFile(f"{OUT}/la-roda-piezas.zip", "w") as z:
        for r in glob.glob(f"{OUT}/candidatas/*.png") + glob.glob(f"{OUT}/sprites/*.png") + glob.glob(f"{OUT}/hojas/*.jpg"):
            z.write(r, r.replace(f"{OUT}/", ""))
    print("LISTO: la-roda-piezas.zip", flush=True)


if __name__ == "__main__":
    if sys.argv[1] == "post":
        post()
    elif sys.argv[1] == "prueba":
        generar(0, prueba=True)
        post()
    else:
        generar(int(sys.argv[1]))
