"""Pruebas de arte de La Roda City en Kaggle (gráfica gratuita T4/P100).

Uso en una celda de Kaggle (con Accelerator = GPU e Internet activados):
    !wget -q -O la_roda_arte.py https://raw.githubusercontent.com/jqnlopezfernandez-crypt/La-Roda-City/main/tools/kaggle/la_roda_arte.py && python la_roda_arte.py

Genera 2 versiones de 4 piezas con Stable Diffusion XL base 1.0 (licencia CreativeML
Open RAIL++-M), intenta quitar el fondo con rembg y deja todo en
/kaggle/working/la-roda-arte-pruebas.zip.
"""
import glob
import os
import subprocess
import sys
import zipfile

OUT = "/kaggle/working"


def pip(*args):
    return subprocess.run([sys.executable, "-m", "pip", "install", "-q", *args]).returncode == 0


try:
    import diffusers  # noqa: F401  (Kaggle ya lo trae: no se actualiza para no romper versiones)
except ImportError:
    pip("diffusers", "accelerate", "safetensors")
# torchao preinstalado choca con algunas versiones de diffusers y no hace falta aquí
subprocess.run([sys.executable, "-m", "pip", "uninstall", "-y", "-q", "torchao"])

import torch  # noqa: E402
from diffusers import StableDiffusionXLPipeline  # noqa: E402

if not torch.cuda.is_available():
    sys.exit("SIN GPU: activa Accelerator = GPU en Session options y vuelve a ejecutar.")
print("GPU:", torch.cuda.get_device_name(0), flush=True)

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, variant="fp16", use_safetensors=True
).to("cuda")
pipe.enable_vae_slicing()

# La "receta" de estilo, igual para todas las piezas para que sean coherentes
ESTILO = (
    "hand-drawn 2D game asset, dark whimsical storybook illustration, thick wobbly black ink outlines, "
    "visible cross-hatching and paper texture, muted earthy palette with warm ochre and terracotta accents, "
    "dramatic soft shadows, slightly crooked charming shapes, original design, "
    "three-quarter top-down view, single object centered, isolated on plain light grey background"
)
NEGATIVO = (
    "photo, photorealistic, 3d render, cgi, flat vector, clean geometric shapes, gradient mesh, "
    "text, letters, watermark, signature, logo, frame, border, multiple objects, cropped, blurry, low quality"
)
PIEZAS = {
    "casa-encalada": "small whitewashed Andalusian village house, irregular lime-washed walls, red clay tile roof, "
    "green wooden door, window with black iron bars and red geranium pots",
    "naranjo": "Seville orange tree in a small square stone planter, round dark green canopy full of bright oranges",
    "farola": "old Andalusian cast-iron street lamp on a tall black post, warm glowing lantern",
    "ayuntamiento": "Andalusian town hall building facade, white walls with ochre trim, three arches, "
    "iron balconies with flowers, small bell gable with a bell and a clock on top",
}
SEMILLAS = [11, 42]

os.makedirs(f"{OUT}/originales", exist_ok=True)
for nombre, desc in PIEZAS.items():
    for semilla in SEMILLAS:
        img = pipe(
            prompt=f"{desc}, {ESTILO}",
            negative_prompt=NEGATIVO,
            num_inference_steps=30,
            guidance_scale=6.5,
            width=1024,
            height=1024,
            generator=torch.Generator("cuda").manual_seed(semilla),
        ).images[0]
        ruta = f"{OUT}/originales/{nombre}-{semilla}.png"
        img.save(ruta)
        print("hecha:", ruta, flush=True)

del pipe
torch.cuda.empty_cache()

def empaquetar():
    with zipfile.ZipFile(f"{OUT}/la-roda-arte-pruebas.zip", "w") as z:
        for ruta in glob.glob(f"{OUT}/originales/*.png") + glob.glob(f"{OUT}/sin-fondo/*.png"):
            z.write(ruta, ruta.replace(f"{OUT}/", ""))


empaquetar()
print("LISTO (originales): la-roda-arte-pruebas.zip", flush=True)

# Quitar el fondo al final: si falla, las imágenes ya están guardadas
os.makedirs(f"{OUT}/sin-fondo", exist_ok=True)
try:
    if not pip("rembg", "onnxruntime"):
        raise RuntimeError("no se pudo instalar rembg")
    from PIL import Image
    from rembg import remove

    for ruta in sorted(glob.glob(f"{OUT}/originales/*.png")):
        remove(Image.open(ruta)).save(ruta.replace("originales", "sin-fondo"))
    empaquetar()
    print("LISTO (con fondos quitados): la-roda-arte-pruebas.zip", flush=True)
except Exception as e:  # no es grave: el fondo se puede quitar después
    print("No se pudo quitar el fondo:", e, flush=True)
