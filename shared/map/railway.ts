/**
 * Vías del tren, en PÍXELES DEL TRAZADO.
 *
 * - "principal": la línea discontinua de vía que dibuja Apple Maps en la captura original
 *   (al este del río, pasando junto a los parques Chicocos y Europa).
 * - "curva" y "enlace": las dos vías que el usuario marcó en naranja en su captura de satélite
 *   ("VIAS DEL TREN", 21-10-2026). La captura del móvil está girada respecto a la del iPad;
 *   se registró con dos cruces de la avenida (calle de la Estación y calle del puente de Erillas)
 *   y la distancia avenida-vía principal. Posición aproximada (±8 px del trazado).
 *
 * Las vías son decorado: no cortan el paso. Donde cruzan una calle se dibuja un paso a nivel.
 */
import { segments, traceToWorld, type Vec2 } from "./townMap";

export type RailLine = { id: string; nombre: string; puntos: [number, number][]; aproximada: boolean };

export const RAIL_LINES: RailLine[] = [
  {
    id: "principal",
    nombre: "Línea principal",
    aproximada: false,
    puntos: [
      [806, -20], [808, 60], [812, 130], [818, 200], [825, 260], [832, 320], [845, 390], [858, 440],
      [875, 490], [900, 540], [925, 585], [950, 622], [1000, 668], [1050, 720], [1100, 770], [1130, 800],
    ],
  },
  {
    id: "curva",
    nombre: "Vía de la estación",
    aproximada: true,
    puntos: [
      [470, 468], [510.7, 456.2], [561.9, 442.4], [612.5, 424.1], [655.1, 403], [687.7, 378.6], [711.1, 355.5],
      [731.8, 327], [751.2, 289.3], [771.3, 242.9], [789.5, 195.8], [800, 165], [809, 110],
    ],
  },
  {
    id: "enlace",
    nombre: "Enlace con la línea principal",
    aproximada: true,
    puntos: [[711.1, 355.5], [727, 344.5], [745.7, 331.7], [768.4, 303.9], [788, 261.8], [800.7, 221.7], [812, 165]],
  },
];

/** Ancho de la banqueta de balasto (px de mundo). */
export const RAIL_BED_WIDTH = 30;

export const railLines: Vec2[][] = RAIL_LINES.map((l) => l.puntos.map(([x, y]) => traceToWorld({ x, y })));

/** Intersección de los segmentos a-b y c-d (o null). */
function cross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t < 0 || t > 1 || u < 0 || u > 1 ? null : { x: a.x + r.x * t, y: a.y + r.y * t };
}

export type LevelCrossing = { x: number; y: number; railAngle: number; streetAngle: number };

/** Pasos a nivel: cada cruce vía-calle (los cruces a menos de 30 px se funden). */
export const levelCrossings: LevelCrossing[] = [];
for (const line of railLines) {
  for (let i = 0; i < line.length - 1; i++) {
    for (const seg of segments) {
      const p = cross(line[i], line[i + 1], { x: seg.ax, y: seg.ay }, { x: seg.bx, y: seg.by });
      if (!p || levelCrossings.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 30)) continue;
      levelCrossings.push({
        x: p.x,
        y: p.y,
        railAngle: Math.atan2(line[i + 1].y - line[i].y, line[i + 1].x - line[i].x),
        streetAngle: Math.atan2(seg.by - seg.ay, seg.bx - seg.ax),
      });
    }
  }
}
