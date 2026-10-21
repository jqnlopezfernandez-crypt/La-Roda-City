// Manifiesto de todos los recursos gráficos: cada entrada se convierte en una textura.
import {
  ICONS,
  alertSign,
  bench,
  bougainvillea,
  bush,
  dot,
  flowerPot,
  iconTexture,
  litterBin,
  mapMarker,
  oliveTree,
  orangeTree,
  statue,
  streetLamp,
  waterTrough,
  type IconName,
} from "./props";
import {
  asphaltTexture,
  cobblestoneTexture,
  dirtTexture,
  fieldTexture,
  roofTileTexture,
  sidewalkTexture,
  slabTexture,
} from "./ground";
import { CORNER_H, CORNER_ROOFS, CORNER_VARIANTS, CORNER_W, cornerFacade } from "./corners";
import { FACADE_MODELS, FACADE_VARIANTS, HOUSE_H, HOUSE_W, houseFacade } from "./houses";
import { PALETTE } from "../game/characters";
import { roenoMeta } from "../game/animation";

export type ArtGroup = "suelo" | "tejado" | "casa" | "vegetacion" | "mobiliario" | "interfaz" | "personaje";

export interface ArtEntry {
  /** Clave de la textura en Phaser. */
  key: string;
  /** Tamaño lógico (px del SVG). */
  w: number;
  h: number;
  /** Factor de rasterizado: el lienzo mide w·scale × h·scale. */
  scale: number;
  /** Origen (0..1) al colocarlo como imagen. */
  ox?: number;
  oy?: number;
  /** Hoja de sprites: número de fotogramas en fila y su tamaño lógico. */
  frames?: number;
  frameW?: number;
  frameH?: number;
  svg: () => string;
  /** Imagen pintada a mano que sustituye al SVG, si existe. */
  url?: string;
  grupo: ArtGroup;
}

const ICON_NAMES = Object.keys(ICONS) as IconName[];
const paintedImages = import.meta.glob<string>("./pintado/*.png", { eager: true, query: "?url", import: "default" });
const paintedUrl = (key: string): string | undefined => paintedImages[`./pintado/${key}.png`];

export const ART: ArtEntry[] = [
  { key: "suelo-asfalto", w: 192, h: 192, scale: 256 / 192, svg: () => asphaltTexture(256), grupo: "suelo" },
  { key: "suelo-acera", w: 64, h: 64, scale: 2, svg: () => sidewalkTexture(128), grupo: "suelo" },
  { key: "suelo-empedrado", w: 72, h: 72, scale: 128 / 72, svg: () => cobblestoneTexture(128), grupo: "suelo" },
  { key: "suelo-tierra", w: 512, h: 512, scale: 1, svg: () => dirtTexture(512), grupo: "suelo" },
  { key: "suelo-campo", w: 512, h: 512, scale: 1, svg: () => fieldTexture(512), grupo: "suelo" },
  { key: "suelo-cesped", w: 512, h: 512, scale: 1, svg: () => fieldTexture(512, "#5f8a3e", 33, false), grupo: "suelo" },
  { key: "suelo-losas", w: 96, h: 96, scale: 128 / 96, svg: () => slabTexture(128), grupo: "suelo" },
  ...CORNER_ROOFS.map(
    (color, i): ArtEntry => ({
      key: `teja-${i}`,
      w: 72,
      h: 72,
      scale: 96 / 72,
      svg: () => roofTileTexture(color, 96),
      grupo: "tejado",
    }),
  ),
  ...Array.from(
    { length: FACADE_MODELS * FACADE_VARIANTS },
    (_, i): ArtEntry => ({
      key: `fachada-${Math.floor(i / FACADE_VARIANTS)}-${i % FACADE_VARIANTS}`,
      w: HOUSE_W,
      h: HOUSE_H,
      scale: 1.5,
      svg: () => houseFacade(Math.floor(i / FACADE_VARIANTS), i % FACADE_VARIANTS),
      grupo: "casa",
    }),
  ),
  ...Array.from(
    { length: CORNER_VARIANTS },
    (_, i): ArtEntry => ({
      key: `esquina-${i}`,
      w: CORNER_W,
      h: CORNER_H,
      scale: 1.5,
      svg: () => cornerFacade(i),
      grupo: "casa",
    }),
  ),
  { key: "naranjo", w: 64, h: 84, scale: 1.5, ox: 0.5, oy: 0.93, svg: orangeTree, grupo: "vegetacion" },
  { key: "olivo", w: 72, h: 84, scale: 1.5, ox: 0.53, oy: 0.93, svg: oliveTree, grupo: "vegetacion" },
  { key: "arbusto", w: 44, h: 32, scale: 1.5, ox: 0.52, oy: 0.84, svg: bush, grupo: "vegetacion" },
  { key: "farola", w: 26, h: 80, scale: 1.5, ox: 0.5, oy: 0.95, svg: streetLamp, grupo: "mobiliario" },
  { key: "banco", w: 52, h: 30, scale: 1.5, ox: 0.5, oy: 0.85, svg: bench, grupo: "mobiliario" },
  { key: "maceta", w: 20, h: 24, scale: 1.5, ox: 0.5, oy: 0.95, svg: flowerPot, grupo: "mobiliario" },
  { key: "buganvilla", w: 40, h: 56, scale: 1.5, ox: 0.5, oy: 0.95, svg: bougainvillea, grupo: "vegetacion" },
  { key: "pilon", w: 64, h: 44, scale: 1.5, ox: 0.5, oy: 0.88, svg: waterTrough, grupo: "mobiliario" },
  { key: "papelera", w: 16, h: 26, scale: 1.5, ox: 0.5, oy: 0.95, svg: litterBin, grupo: "mobiliario" },
  { key: "estatua", w: 68, h: 128, scale: 2, ox: 0.5, oy: 0.95, svg: statue, grupo: "mobiliario" },
  { key: "marcador", w: 28, h: 38, scale: 2, ox: 0.5, oy: 0.92, svg: () => mapMarker(), grupo: "interfaz" },
  { key: "aviso", w: 30, h: 34, scale: 2, ox: 0.5, oy: 0.95, svg: alertSign, grupo: "interfaz" },
  { key: "punto", w: 14, h: 14, scale: 2, ox: 0.5, oy: 0.5, svg: dot, grupo: "interfaz" },
  ...ICON_NAMES.map(
    (name): ArtEntry => ({
      key: `icono-${name}`,
      w: 48,
      h: 48,
      scale: 2,
      ox: 0.5,
      oy: 0.5,
      svg: () => iconTexture(name),
      grupo: "interfaz",
    }),
  ),
  // Personajes: hojas de sprites pintadas (una por color de la paleta), sin SVG.
  ...PALETTE.map(
    (_look: unknown, i: number): ArtEntry => ({
      key: `roeno-${i}`,
      w: roenoMeta.frameW * roenoMeta.frames,
      h: roenoMeta.frameH,
      scale: 1,
      frames: roenoMeta.frames,
      frameW: roenoMeta.frameW,
      frameH: roenoMeta.frameH,
      svg: () => "",
      url: paintedUrl(`roeno-${i}`),
      grupo: "personaje",
    }),
  ),
];

// Si hay una imagen pintada con la misma clave, sustituye al SVG generado.
for (const entry of ART) entry.url ??= paintedUrl(entry.key);

export const HOUSE_KEYS = ART.filter((entry) => entry.grupo === "casa").map((entry) => entry.key);
export const ROOF_KEYS = ART.filter((entry) => entry.grupo === "tejado").map((entry) => entry.key);
