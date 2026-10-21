/**
 * Edificios singulares (iglesia, ayuntamiento, estación, cuartel) y letreros de comercio,
 * colocados en el lado de la calle donde está el punto del lugar. Lógica pura: la usan el
 * dibujo del mapa, la colocación de casas (para no pisarlos) y las pruebas.
 */
import { pointsOfInterest } from "../data/pointsOfInterest";
import { RIVER_WIDTH, riverLines } from "./river";
import { RAIL_BED_WIDTH, railLines } from "./railway";
import { STREET_HALF_WIDTH, segments, traceToWorld, worldAreas, type Vec2 } from "./townMap";

export type BuildingKind = "iglesia" | "ayuntamiento" | "estacion" | "cuartel";
export type SignKind = "farmacia" | "super" | "bar" | "kebab" | "peluqueria" | "estanco" | "gimnasio" | "autoescuela" | "tienda" | "piscina";

/** Edificio por número de lugar: tamaño de la huella (ancho a lo largo de la calle × fondo). */
const BUILDINGS: { poi: number; kind: BuildingKind; w: number; d: number }[] = [
  { poi: 13, kind: "iglesia", w: 190, d: 80 },
  { poi: 11, kind: "ayuntamiento", w: 190, d: 70 },
  { poi: 26, kind: "estacion", w: 220, d: 60 },
  { poi: 18, kind: "cuartel", w: 160, d: 60 },
];

/** Letrero por número de lugar. */
const SIGNS: Record<number, SignKind> = {
  2: "super", 14: "super", 3: "kebab", 4: "bar", 5: "bar", 9: "bar", 19: "bar", 28: "bar", 29: "bar",
  12: "estanco", 23: "farmacia", 24: "farmacia", 30: "peluqueria", 15: "gimnasio", 6: "autoescuela", 20: "tienda", 31: "piscina",
};

export type Landmark = { poi: number; kind: BuildingKind; center: Vec2; footprint: Vec2[]; w: number; d: number };
export type ShopSign = { poi: number; kind: SignKind; x: number; y: number };

/** Tramo de calle más cercano: punto y dirección. */
function nearestStreet(p: Vec2): { q: Vec2; u: Vec2; dist: number } {
  let best = { q: p, u: { x: 1, y: 0 }, dist: Infinity };
  for (const s of segments) {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.y - s.ay) * dy) / len2));
    const q = { x: s.ax + dx * t, y: s.ay + dy * t };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best.dist) {
      const len = Math.sqrt(len2);
      best = { q, u: { x: dx / len, y: dy / len }, dist: d };
    }
  }
  return best;
}

const segDist = (p: Vec2, a: Vec2, b: Vec2) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const lineDist = (p: Vec2, lines: Vec2[][]) => Math.min(...lines.flatMap((l) => l.slice(1).map((b, i) => segDist(p, l[i], b))));

function inPolygon(p: Vec2, pts: Vec2[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** ¿La huella está libre de calles, zonas, río y vías? (se comprueba en una rejilla de puntos) */
function footprintFree(pts: Vec2[]): boolean {
  const [a, b, , d] = pts;
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 4; j++) {
      const p = {
        x: a.x + ((b.x - a.x) * i) / 8 + ((d.x - a.x) * j) / 4,
        y: a.y + ((b.y - a.y) * i) / 8 + ((d.y - a.y) * j) / 4,
      };
      if (nearestStreet(p).dist < STREET_HALF_WIDTH + 4) return false;
      if (worldAreas.some((ar) => (ar.kind === "circulo" ? Math.hypot(p.x - ar.c.x, p.y - ar.c.y) < ar.r + 6 : inPolygon(p, ar.pts)))) return false;
      if (lineDist(p, riverLines) < RIVER_WIDTH / 2 + 14) return false;
      if (lineDist(p, railLines) < RAIL_BED_WIDTH / 2 + 8) return false;
    }
  }
  return true;
}

function placeBuilding(def: (typeof BUILDINGS)[number]): Landmark | null {
  const poi = pointsOfInterest.find((p) => p.number === def.poi);
  if (!poi?.trace) return null;
  const P = traceToWorld(poi.trace);
  const { q, u, dist } = nearestStreet(P);
  const toPoi = dist > 2 ? { x: (P.x - q.x) / dist, y: (P.y - q.y) / dist } : { x: -u.y, y: u.x };
  // Lado del punto primero; si no cabe, el otro; si tampoco, más estrecho
  const n0 = { x: -u.y, y: u.x };
  const sign = n0.x * toPoi.x + n0.y * toPoi.y >= 0 ? 1 : -1;
  for (const scale of [1, 0.85, 0.7]) {
    for (const side of [sign, -sign]) {
      const v = { x: n0.x * side, y: n0.y * side };
      const w = def.w * scale;
      const off = STREET_HALF_WIDTH + 8 + def.d / 2;
      const c = { x: q.x + v.x * off, y: q.y + v.y * off };
      const hu = { x: (u.x * w) / 2, y: (u.y * w) / 2 };
      const hv = { x: (v.x * def.d) / 2, y: (v.y * def.d) / 2 };
      const footprint = [
        { x: c.x - hu.x - hv.x, y: c.y - hu.y - hv.y },
        { x: c.x + hu.x - hv.x, y: c.y + hu.y - hv.y },
        { x: c.x + hu.x + hv.x, y: c.y + hu.y + hv.y },
        { x: c.x - hu.x + hv.x, y: c.y - hu.y + hv.y },
      ];
      if (footprintFree(footprint)) return { poi: def.poi, kind: def.kind, center: c, footprint, w, d: def.d };
    }
  }
  return null;
}

export const landmarks: Landmark[] = BUILDINGS.map(placeBuilding).filter((l): l is Landmark => !!l);

/** Letreros: en la acera del lado del punto, junto a la fachada. */
export const shopSigns: ShopSign[] = pointsOfInterest
  .filter((p) => p.trace && SIGNS[p.number])
  .map((p) => {
    const P = traceToWorld(p.trace!);
    const { q, u, dist } = nearestStreet(P);
    const v = dist > 2 ? { x: (P.x - q.x) / dist, y: (P.y - q.y) / dist } : { x: -u.y, y: u.x };
    const off = STREET_HALF_WIDTH + 2;
    return { poi: p.number, kind: SIGNS[p.number], x: q.x + v.x * off, y: q.y + v.y * off };
  });
