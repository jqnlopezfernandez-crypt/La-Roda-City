// Carga del arte: rasteriza cada recurso a un <canvas> una sola vez y lo registra
// como textura en las escenas de Phaser.
import type Phaser from "phaser";
import { svgDataUrl } from "./svg";
import { ART, type ArtEntry } from "./index";

function sourceUrl(entry: ArtEntry): string {
  return entry.url ?? svgDataUrl(entry.svg());
}

/** Lienzos ya rasterizados, por clave. */
const canvases = new Map<string, HTMLCanvasElement>();
let loading: Promise<void> | null = null;

/** Rasteriza una entrada a su tamaño final (w·scale × h·scale). Nunca falla: avisa y sigue. */
function rasterize(entry: ArtEntry): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(entry.w * entry.scale);
      canvas.height = Math.round(entry.h * entry.scale);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.dataset.w = String(entry.w);
      canvases.set(entry.key, canvas);
      resolve();
    };
    image.onerror = () => {
      console.warn(`No se pudo cargar el recurso gr\xE1fico ${entry.key}`);
      resolve();
    };
    image.src = sourceUrl(entry);
  });
}

/** Prepara todo el arte (solo la primera llamada trabaja; las demás reutilizan la promesa). */
export function loadArt(): Promise<void> {
  loading ??= Promise.all(ART.map(rasterize)).then(() => {});
  return loading;
}

export function artCanvas(key: string): HTMLCanvasElement | undefined {
  return canvases.get(key);
}

function findArt(key: string): ArtEntry | undefined {
  return ART.find((entry) => entry.key === key);
}

/** Da de alta en la escena las texturas cargadas que aún no existan (y sus fotogramas). */
export function registerArt(scene: Phaser.Scene): void {
  for (const entry of ART) {
    const canvas = canvases.get(entry.key);
    if (!canvas || scene.textures.exists(entry.key)) continue;
    const texture = scene.textures.addCanvas(entry.key, canvas);
    if (entry.frames) {
      const frameWidth = (entry.frameW ?? entry.w / entry.frames) * entry.scale;
      const frameHeight = (entry.frameH ?? entry.h) * entry.scale;
      for (let frame = 0; frame < entry.frames; frame++) {
        texture!.add(frame, 0, frame * frameWidth, 0, frameWidth, frameHeight);
      }
    }
  }
}

/**
 * Coloca un elemento del arte como imagen con su origen del manifiesto.
 * `size` = escala en el mundo (1 = tamaño lógico w×h).
 */
export function addProp(scene: Phaser.Scene, key: string, x: number, y: number, size = 1): Phaser.GameObjects.Image {
  const entry = findArt(key)!;
  return scene.add
    .image(x, y, key)
    .setOrigin(entry.ox ?? 0.5, entry.oy ?? 0.5)
    .setScale(size / entry.scale);
}
