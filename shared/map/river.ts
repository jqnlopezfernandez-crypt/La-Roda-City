/**
 * Río (línea central extraída del dibujo con tools/extraer_rio.py) y puentes.
 * Los puentes no se colocan a mano: están donde una calle del trazado cruza el río.
 */
import river from "./river.generated.json";
import { segments, traceToWorld, type Vec2 } from "./townMap";

/** Ancho visual del cauce en píxeles de mundo. */
export const RIVER_WIDTH = 34;

export const riverLines: Vec2[][] = (river.lines as [number, number][][]).map((line) =>
  line.map(([x, y]) => traceToWorld({ x, y })),
);

export type Bridge = { x: number; y: number; angle: number; riverAngle: number };

/** Intersección de los segmentos a-b y c-d (o null). */
function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t < 0 || t > 1 || u < 0 || u > 1 ? null : { x: a.x + r.x * t, y: a.y + r.y * t };
}

/** Un puente por cada cruce calle-río (los cruces a menos de 20 px se funden). */
export const bridges: Bridge[] = [];
for (const line of riverLines) {
  for (let i = 0; i < line.length - 1; i++) {
    for (const seg of segments) {
      const p = segmentIntersection(line[i], line[i + 1], { x: seg.ax, y: seg.ay }, { x: seg.bx, y: seg.by });
      if (!p || bridges.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 20)) continue;
      bridges.push({
        x: p.x,
        y: p.y,
        angle: Math.atan2(seg.by - seg.ay, seg.bx - seg.ax),
        riverAngle: Math.atan2(line[i + 1].y - line[i].y, line[i + 1].x - line[i].x),
      });
    }
  }
}
