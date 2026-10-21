// Fachadas estrechas de esquina (ochaves) con puerta en arco y placa de calle.
import { INK, hatching, inkShape, inkStroke, rectPts, shade, speckles, svgDoc, type Point } from "./svg";

export const CORNER_ROOFS = ["#a4553a", "#97503a", "#ad6040"];
export const CORNER_W = 52;
export const CORNER_H = 84;
export const CORNER_VARIANTS = 4;

const WALL_COLORS = ["#efe6d2", "#e8d6b2", "#e2c48c", "#ece0c6"];
const PLINTH_COLORS = ["#4f6f8a", "#8a6a45", "#6d7a4a", "#a0563c"];
const DOOR_COLORS = ["#6d2f2a", "#3f5f4a", "#5e3a22", "#2f4a6a"];
const ROOF_COLOR = "#a4553a";
/** Altura del alero. */
const EAVE_H = 11;
/** Altura del zócalo. */
const PLINTH_H = 13;

export function cornerFacade(variant: number): string {
  const width = CORNER_W;
  const height = CORNER_H;
  const seed = 700 + variant * 23;
  const wallColor = WALL_COLORS[variant % WALL_COLORS.length];
  // Pared con manchas, sombra del alero y de los cantos.
  let svg = inkShape(rectPts(1.5, EAVE_H - 1, width - 3, height - EAVE_H - 0.5), wallColor, { seed, amp: 1, ink: 2.6 });
  svg += speckles(
    10,
    EAVE_H + 8,
    width - 20,
    height - EAVE_H - PLINTH_H - 16,
    4,
    [shade(wallColor, -0.06), shade(wallColor, 0.05)],
    4,
    7,
    0.7,
    seed + 3,
  );
  svg += `<rect x="2" y="${EAVE_H - 1}" width="${width - 4}" height="7" fill="${INK}" fill-opacity="0.16"/>`;
  svg += hatching(3, EAVE_H, width - 6, 6, 5, INK, 0.18, seed + 4);
  svg += `<rect x="2" y="${EAVE_H}" width="5" height="${height - EAVE_H - 2}" fill="${INK}" fill-opacity="0.1"/>`;
  svg += `<rect x="${width - 7}" y="${EAVE_H}" width="5" height="${height - EAVE_H - 2}" fill="${INK}" fill-opacity="0.14"/>`;
  // Zócalo.
  svg += inkShape(rectPts(1.5, height - PLINTH_H - 1, width - 3, PLINTH_H), PLINTH_COLORS[variant % PLINTH_COLORS.length], {
    seed: seed + 5,
    amp: 0.8,
    ink: 2.2,
  });
  svg += hatching(3, height - PLINTH_H, width - 6, PLINTH_H - 2, 6, INK, 0.2, seed + 6);
  // Puerta en arco de medio punto, centrada.
  const doorWidth = 20;
  const doorX = (width - doorWidth) / 2;
  const doorTop = height - PLINTH_H - 30;
  const doorOutline: Point[] = [
    [doorX, height - 1.5],
    [doorX, doorTop + doorWidth / 2],
  ];
  for (let i = 1; i < 8; i++) {
    const angle = Math.PI + (i / 8) * Math.PI;
    doorOutline.push([
      doorX + doorWidth / 2 + Math.cos(angle) * (doorWidth / 2),
      doorTop + doorWidth / 2 + Math.sin(angle) * (doorWidth / 2),
    ]);
  }
  doorOutline.push([doorX + doorWidth, doorTop + doorWidth / 2], [doorX + doorWidth, height - 1.5]);
  // Marco: el mismo contorno agrandado 2 px hacia fuera y hacia arriba.
  svg += inkShape(
    doorOutline.map(([px, py]): Point => [px + (px < width / 2 ? -2 : 2), py - (py < height - 2 ? 2 : 0)]),
    "#d8cdb4",
    { seed: seed + 7, amp: 0.5, ink: 1.6 },
  );
  svg += inkShape(doorOutline, DOOR_COLORS[variant % DOOR_COLORS.length], { seed: seed + 8, amp: 0.5, ink: 2 });
  svg += hatching(doorX + 1, doorTop + 4, doorWidth - 2, height - doorTop - 6, 4, INK, 0.25, seed + 9);
  svg += inkStroke(
    [
      [width / 2, doorTop + 2],
      [width / 2, height - 2],
    ],
    1.3,
    INK,
    seed + 10,
    0.3,
  );
  svg += `<circle cx="${width / 2 - 3}" cy="${height - PLINTH_H - 9}" r="1.4" fill="#d9b25a" stroke="${INK}" stroke-width="0.8"/>`;
  // Placa de calle de azulejo.
  svg += inkShape(rectPts(width / 2 - 11, EAVE_H + 7, 22, 9), "#f2efe6", { seed: seed + 11, amp: 0.3, ink: 1.4 });
  svg += `<path d="M${width / 2 - 8} ${EAVE_H + 11.5} h16" stroke="#3f6f8a" stroke-width="2.2" stroke-linecap="round"/>`;
  svg += `<rect x="${width / 2 - 11}" y="${EAVE_H + 7}" width="22" height="9" fill="none" stroke="#3f6f8a" stroke-width="0.9"/>`;
  // Farolillo de pared.
  svg += inkStroke(
    [
      [width - 9, EAVE_H + 21],
      [width - 4, EAVE_H + 21],
    ],
    1.4,
    INK,
    seed + 12,
    0.2,
  );
  svg += inkShape(rectPts(width - 9, EAVE_H + 21, 6, 8), "#f1c76c", { seed: seed + 13, amp: 0.3, ink: 1.4 });
  // Alero de tejas.
  svg += inkShape(rectPts(0, 0, width, EAVE_H), shade(ROOF_COLOR, -0.1), { seed: seed + 14, amp: 0.7, ink: 2.4 });
  for (let x = 2; x < width - 4; x += 8) {
    svg += `<path d="M${x} ${EAVE_H - 1} q4 4 8 0" fill="${shade(ROOF_COLOR, 0.08)}" stroke="${INK}" stroke-width="1.3"/>`;
  }
  return svgDoc(width, height, svg);
}
