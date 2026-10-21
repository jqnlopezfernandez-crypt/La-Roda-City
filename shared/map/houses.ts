/**
 * Colocación de las casas del pueblo (lógica pura, sin Phaser).
 *
 * Cada casa tiene una huella convexa en el suelo (`footprint`). Se colocan:
 *  1. Casas de esquina (con chaflán) en los cruces cuyas calles forman 55°–125°.
 *  2. Casas en hilera a lo largo de cada lado de cada calle, siguiendo su
 *     orientación; en las curvas fuertes se acortan.
 * Una casa solo se acepta si su huella no se solapa con otra (prueba de ejes
 * separadores), queda dentro de una manzana y respeta distancias mínimas a calles,
 * plazas/parques, río y puentes. Por último se eligen las fachadas visibles (las que
 * miran hacia la cámara) sin que una tape a otra.
 */
import { STREET_HALF_WIDTH, cityBlocks, segments, streetEdges, streetNodes, traceToWorld, worldAreas, type StreetEdge, type Vec2 } from "./townMap";
import { RIVER_WIDTH, bridges, riverLines, type Bridge } from "./river";
import { RAIL_BED_WIDTH, railLines } from "./railway";

/** Altura de la fachada dibujada (sobresale hacia arriba de la huella). */
export const WALL_HEIGHT = 40;
/** Fondo máximo de una parcela. */
export const LOT_DEPTH = 72;

/** Separación de la fachada respecto al eje de la calle. */
const FRONT_OFFSET = STREET_HALF_WIDTH + 3;
/** Distancia mínima de una huella a cualquier eje de calle. */
const MIN_STREET_DIST = STREET_HALF_WIDTH + 2;
/** Distancia mínima al eje del río. */
const MIN_RIVER_DIST = RIVER_WIDTH / 2 + 11 + 6;
/** Distancia mínima al eje de las vías del tren. */
const MIN_RAIL_DIST = RAIL_BED_WIDTH / 2 + 8;
/** Distancia mínima a plazas, parques y campo. */
const MIN_AREA_DIST = 12;
/** Ancho mínimo de una casa en hilera. */
const MIN_WIDTH = 34;
/** Fondo mínimo de una casa en hilera. */
const MIN_DEPTH = 34;
/** Giro máximo de la calle (rad) a lo largo de una fachada. */
const MAX_TURN = 0.22;
/** Componente vertical mínima de la normal para que una fachada mire a la cámara. */
const FACADE_MIN_FACING = 0.6;
/** Fracción máxima de una fachada que puede tapar otra casa. */
const FACADE_MAX_COVERED = 0.25;

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type RoofFace = { pts: Vec2[]; eave: Vec2; origin: Vec2; shade: boolean };
export type Front = { a: Vec2; b: Vec2; out: Vec2; kind: "casa" | "chaflan" };
export type Facade = { a: Vec2; b: Vec2; kind: "casa" | "chaflan" };
export type HouseShape = {
  kind: "hilera" | "esquina";
  footprint: Vec2[];
  fronts: Front[];
  roof: RoofFace[];
  ridges: [Vec2, Vec2][];
  mid: Vec2;
};
export type House = HouseShape & { id: number; seed: number; facades: Facade[] };

// --- vectores --------------------------------------------------------------
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
const normalize = (a: Vec2): Vec2 => {
  const len = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / len, y: a.y / len };
};

// --- polígonos -------------------------------------------------------------
function signedArea(poly: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += cross(poly[i], poly[(i + 1) % poly.length]);
  return s / 2;
}

/** Quita vértices repetidos y deja el polígono en sentido positivo. */
function orient(poly: Vec2[]): Vec2[] {
  const clean = poly.filter((p, i) => Math.hypot(p.x - poly[(i + 1) % poly.length].x, p.y - poly[(i + 1) % poly.length].y) > 0.01);
  return signedArea(clean) < 0 ? clean.reverse() : clean;
}

function centroid(poly: Vec2[]): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const c = cross(p, q);
    a += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  if (Math.abs(a) < 1e-9) {
    return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i].y > p.y !== poly[j].y > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) {
      inside = !inside;
    }
  }
  return inside;
}

function pointSegmentDist(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t));
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function segmentSegmentDist(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(pointSegmentDist(a, c, d), pointSegmentDist(b, c, d), pointSegmentDist(c, a, b), pointSegmentDist(d, a, b));
}

/** Distancia de un polígono a un segmento (0 si se tocan o el segmento entra). */
function polygonSegmentDist(poly: Vec2[], a: Vec2, b: Vec2): number {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, segmentSegmentDist(poly[i], poly[(i + 1) % poly.length], a, b));
  return best;
}

function polygonPolygonDist(p: Vec2[], q: Vec2[]): number {
  if (p.some((v) => pointInPolygon(v, q)) || q.some((v) => pointInPolygon(v, p))) return 0;
  let best = Infinity;
  for (let i = 0; i < q.length; i++) best = Math.min(best, polygonSegmentDist(p, q[i], q[(i + 1) % q.length]));
  return best;
}

/** ¿Se solapan dos polígonos convexos? (teorema de los ejes separadores, con tolerancia). */
function convexOverlap(p: Vec2[], q: Vec2[], tolerance = 0.05): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const edge = sub(poly[(i + 1) % poly.length], poly[i]);
      const axis = normalize({ x: -edge.y, y: edge.x });
      let pMin = Infinity;
      let pMax = -Infinity;
      let qMin = Infinity;
      let qMax = -Infinity;
      for (const v of p) {
        const k = dot(v, axis);
        pMin = Math.min(pMin, k);
        pMax = Math.max(pMax, k);
      }
      for (const v of q) {
        const k = dot(v, axis);
        qMin = Math.min(qMin, k);
        qMax = Math.max(qMax, k);
      }
      if (pMax <= qMin + tolerance || qMax <= pMin + tolerance) return false;
    }
  }
  return true;
}

/** Recorte de un polígono por otro convexo (Sutherland–Hodgman). */
function clipPolygon(subject: Vec2[], clip: Vec2[]): Vec2[] {
  const c = orient(clip);
  let out = subject.slice();
  for (let i = 0; i < c.length && out.length; i++) {
    const a = c[i];
    const b = c[(i + 1) % c.length];
    const inside = (p: Vec2) => cross(sub(b, a), sub(p, a)) >= 0;
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn !== prevIn) {
        const dir = sub(cur, prev);
        const edge = sub(b, a);
        const den = cross(edge, dir);
        if (Math.abs(den) > 1e-12) {
          const t = cross(sub(a, prev), edge) / -den;
          out.push(add(prev, scale(dir, t)));
        }
      }
      if (curIn) out.push(cur);
    }
  }
  return out;
}

function overlapArea(p: Vec2[], q: Vec2[]): number {
  const clipped = clipPolygon(p, q);
  return clipped.length < 3 ? 0 : Math.abs(signedArea(clipped));
}

function bounds(pts: Vec2[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

// --- puentes -------------------------------------------------------------------

/** Medidas de los puentes: tablero, estribos, medio ancho y caída hasta el agua. */
export const BRIDGE = { deck: RIVER_WIDTH * 4, abutment: 26, half: STREET_HALF_WIDTH + 10, drop: 26 };

/** Ejes locales de un puente: `u` a lo largo de la calle, `n` a lo ancho. */
export function bridgeFrame(b: Bridge) {
  const u = { x: Math.cos(b.angle), y: Math.sin(b.angle) };
  const n = { x: -u.y, y: u.x };
  return { u, n, at: (along: number, across: number): Vec2 => ({ x: b.x + u.x * along + n.x * across, y: b.y + u.y * along + n.y * across }) };
}

function convexHull(pts: Vec2[]): Vec2[] {
  const sorted = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: Vec2[]) => {
    const h: Vec2[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(sub(h[h.length - 1], h[h.length - 2]), sub(p, h[h.length - 2])) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return orient([...half(sorted), ...half(sorted.slice().reverse())]);
}

/** Silueta del puente en el suelo (tablero + estribos + caída al agua). */
function bridgePolygon(b: Bridge): Vec2[] {
  const { at } = bridgeFrame(b);
  const along = BRIDGE.deck / 2 + BRIDGE.abutment;
  const across = BRIDGE.half + 8;
  const top = [at(-along, -across), at(along, -across), at(along, across), at(-along, across)];
  return convexHull([...top, ...top.map((p) => ({ x: p.x, y: p.y + BRIDGE.drop + 6 }))]);
}

/** Cuadrilátero que ocupa una fachada dibujada (sube WALL_HEIGHT desde su base). */
function facadeQuad(f: { a: Vec2; b: Vec2 }): Vec2[] {
  return orient([f.a, f.b, { x: f.b.x, y: f.b.y - WALL_HEIGHT }, { x: f.a.x, y: f.a.y - WALL_HEIGHT }]);
}

/** Aleatorio con semilla (el mismo generador que el arte), para que el pueblo sea siempre igual. */
function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 1831565813) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- entorno: distancias a lo que no se puede pisar --------------------------------

type Seg = { a: Vec2; b: Vec2 };
type IndexedSeg = Seg & { bb: Box };

function sceneGeometry() {
  const blocks = cityBlocks.map((b) => b.points.map(([x, y]) => traceToWorld({ x, y })));
  const streetSegs: Seg[] = segments.map((s) => ({ a: { x: s.ax, y: s.ay }, b: { x: s.bx, y: s.by } }));
  const riverSegs: Seg[] = riverLines.flatMap((line) => line.slice(1).map((p, i) => ({ a: line[i], b: p })));
  const railSegs: Seg[] = railLines.flatMap((line) => line.slice(1).map((p, i) => ({ a: line[i], b: p })));
  const bridgePolys = bridges.map((b) => bridgePolygon(b));
  return { blocks, streetSegs, riverSegs, railSegs, bridgePolys };
}

type Scene = ReturnType<typeof buildScene>;

function buildScene() {
  const base = sceneGeometry();
  const apart = (p: Box, q: Box, margin: number) =>
    p.x1 < q.x0 - margin || p.x0 > q.x1 + margin || p.y1 < q.y0 - margin || p.y0 > q.y1 + margin;
  const indexSeg = (s: Seg): IndexedSeg => ({ ...s, bb: bounds([s.a, s.b]) });
  const streets = base.streetSegs.map(indexSeg);
  const river = base.riverSegs.map(indexSeg);
  const rails = base.railSegs.map(indexSeg);
  const blocks = base.blocks.map((pts) => ({ pts, bb: bounds(pts) }));
  const areas = worldAreas.map((a) => ({
    a,
    bb: a.kind === "circulo" ? { x0: a.c.x - a.r, y0: a.c.y - a.r, x1: a.c.x + a.r, y1: a.c.y + a.r } : bounds(a.pts),
  }));
  const bridgeShapes = base.bridgePolys.map((pts) => ({ pts, bb: bounds(pts) }));
  const distToSegs = (poly: Vec2[], segs: IndexedSeg[], margin: number) => {
    const bb = bounds(poly);
    let best = Infinity;
    for (const s of segs) if (!apart(bb, s.bb, margin)) best = Math.min(best, polygonSegmentDist(poly, s.a, s.b));
    return best;
  };
  return {
    ...base,
    streetDist: (poly: Vec2[], margin = MIN_STREET_DIST + 1) => distToSegs(poly, streets, margin),
    riverDist: (poly: Vec2[]) => distToSegs(poly, river, MIN_RIVER_DIST + 1),
    railDist: (poly: Vec2[]) => distToSegs(poly, rails, MIN_RAIL_DIST + 1),
    areaDist(poly: Vec2[], margin = MIN_AREA_DIST + 1) {
      const bb = bounds(poly);
      let best = Infinity;
      for (const { a, bb: abb } of areas) {
        if (apart(bb, abb, margin)) continue;
        if (a.kind === "circulo") {
          const d = pointInPolygon(a.c, poly) ? 0 : Math.min(...poly.map((p, i) => pointSegmentDist(a.c, p, poly[(i + 1) % poly.length])));
          best = Math.min(best, Math.max(0, d - a.r));
        } else {
          best = Math.min(best, polygonPolygonDist(poly, a.pts));
        }
      }
      return best;
    },
    bridgeDist(poly: Vec2[], margin = 9) {
      const bb = bounds(poly);
      let best = Infinity;
      for (const b of bridgeShapes) if (!apart(bb, b.bb, margin)) best = Math.min(best, polygonPolygonDist(poly, b.pts));
      return best;
    },
    /** Índice de la manzana que contiene la huella completa (o -1). */
    blockOf(poly: Vec2[]) {
      const bb = bounds(poly);
      return blocks.findIndex(
        (b) => bb.x0 >= b.bb.x0 && bb.x1 <= b.bb.x1 && bb.y0 >= b.bb.y0 && bb.y1 <= b.bb.y1 && poly.every((p) => pointInPolygon(p, b.pts)),
      );
    },
  };
}

/** ¿Es un sitio válido para una casa? (dentro de manzana y lejos de lo que no se pisa). */
function siteOk(poly: Vec2[], scene: Scene): boolean {
  return (
    scene.blockOf(poly) >= 0 &&
    scene.streetDist(poly) >= MIN_STREET_DIST &&
    scene.areaDist(poly) >= MIN_AREA_DIST &&
    scene.riverDist(poly) >= MIN_RIVER_DIST &&
    scene.railDist(poly) >= MIN_RAIL_DIST &&
    scene.bridgeDist(poly) >= 8
  );
}

/** Rejilla espacial de huellas para comprobar solapes rápido. */
class SpatialGrid {
  private cells = new Map<string, number[]>();
  constructor(private cell = 200) {}
  private keys(poly: Vec2[]): string[] {
    const bb = bounds(poly);
    const c = this.cell;
    const out: string[] = [];
    for (let gy = Math.floor(bb.y0 / c); gy <= Math.floor(bb.y1 / c); gy++) {
      for (let gx = Math.floor(bb.x0 / c); gx <= Math.floor(bb.x1 / c); gx++) out.push(`${gx},${gy}`);
    }
    return out;
  }
  add(poly: Vec2[], id: number) {
    for (const k of this.keys(poly)) {
      const list = this.cells.get(k);
      if (list) list.push(id);
      else this.cells.set(k, [id]);
    }
  }
  near(poly: Vec2[]): number[] {
    const found = new Set<number>();
    for (const k of this.keys(poly)) for (const id of this.cells.get(k) ?? []) found.add(id);
    return [...found];
  }
}

/** Polilínea con longitud acumulada para recorrerla por distancia. */
function polyline(pts: Vec2[]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1];
  const segAt = (d: number) => {
    let i = 0;
    while (i < pts.length - 2 && cum[i + 1] < d) i++;
    return i;
  };
  return {
    pts,
    cum,
    L,
    at(d: number): Vec2 {
      const i = segAt(d);
      const len = cum[i + 1] - cum[i] || 1;
      const t = Math.max(0, Math.min(1, (d - cum[i]) / len));
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    },
    /** Giro total (rad) de la calle entre dos distancias. */
    turn(d0: number, d1: number): number {
      const i0 = segAt(d0);
      const i1 = segAt(d1);
      let min = Infinity;
      let max = -Infinity;
      let prev: number | null = null;
      for (let i = i0; i <= i1; i++) {
        let ang = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
        if (prev !== null) {
          while (ang - prev > Math.PI) ang -= 2 * Math.PI;
          while (ang - prev < -Math.PI) ang += 2 * Math.PI;
        }
        prev = ang;
        min = Math.min(min, ang);
        max = Math.max(max, ang);
      }
      return max - min;
    },
    /** Vértices estrictamente entre dos distancias. */
    inner(d0: number, d1: number): Vec2[] {
      return pts.filter((_, i) => cum[i] > d0 && cum[i] < d1);
    },
    toNextVertex(d: number): number {
      const next = cum.find((c) => c > d + 0.5);
      return next === undefined ? L - d : next - d;
    },
  };
}

/** Casa en hilera: fachada a-b, fondo `depth` hacia `inward`, tejado a dos aguas. */
function rowHouse(a: Vec2, b: Vec2, depth: number, inward: Vec2): HouseShape {
  const backB = add(b, scale(inward, depth));
  const backA = add(a, scale(inward, depth));
  const ridgeA = add(a, scale(inward, depth / 2));
  const ridgeB = add(b, scale(inward, depth / 2));
  const eave = normalize(sub(b, a));
  const out = scale(inward, -1);
  return {
    kind: "hilera",
    footprint: orient([a, b, backB, backA]),
    fronts: [{ a, b, out, kind: "casa" }],
    roof: [
      { pts: [a, b, ridgeB, ridgeA], eave, origin: a, shade: out.y < -0.05 },
      { pts: [ridgeA, ridgeB, backB, backA], eave, origin: a, shade: out.y >= -0.05 },
    ],
    ridges: [[ridgeA, ridgeB]],
    mid: centroid([a, b, backB, backA]),
  };
}

/** Tejado a cuatro aguas que converge en `apex` (respaldo para formas raras). */
function hipRoof(poly: Vec2[], apex: Vec2) {
  const faces: RoofFace[] = [];
  const ridges: [Vec2, Vec2][] = [];
  const c = centroid(poly);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const eave = normalize(sub(q, p));
    let n = { x: -eave.y, y: eave.x };
    if (dot(n, sub(p, c)) < 0) n = scale(n, -1);
    faces.push({ pts: [p, q, apex], eave, origin: p, shade: n.y < -0.05 });
    ridges.push([p, apex]);
  }
  return { faces, ridges };
}

/** Dirección de salida de una calle desde un cruce (30 px hacia dentro del tramo). */
function departure(e: StreetEdge, fromEnd: boolean): Vec2 {
  const pts = e.points.map(([x, y]) => traceToWorld({ x, y }));
  const ordered = fromEnd ? pts.slice().reverse() : pts;
  const line = polyline(ordered);
  const d = Math.min(30, line.L);
  return normalize(sub(line.at(d), ordered[0]));
}

/** Parámetro t de la intersección de las rectas p + t·d y q + s·e (o null si son paralelas). */
function lineIntersection(p: Vec2, d: Vec2, q: Vec2, e: Vec2): number | null {
  const den = cross(d, e);
  return Math.abs(den) < 1e-9 ? null : cross(sub(q, p), e) / den;
}

/** Tejado de la casa de esquina: dos faldones a lo largo de cada calle y uno sobre el chaflán. */
function cornerRoof(
  poly: Vec2[],
  farA: Vec2,
  farB: Vec2,
  cornerA: Vec2,
  cornerB: Vec2,
  dirA: Vec2,
  dirB: Vec2,
  inA: Vec2,
  inB: Vec2,
  bisector: Vec2,
) {
  const ia = poly.findIndex((p) => p === cornerA);
  const ib = poly.findIndex((p) => p === cornerB);
  const otherNeighbour = (i: number, not: Vec2) => {
    const next = poly[(i + 1) % poly.length];
    const prev = poly[(i + poly.length - 1) % poly.length];
    return next === not ? prev : next;
  };
  const fallback = () => {
    const c = centroid(poly);
    return { ...hipRoof(poly, c), mid: c };
  };
  if (ia < 0 || ib < 0) return fallback();
  const backA = otherNeighbour(ia, farA);
  const backB = otherNeighbour(ib, farB);
  const midA = scale(add(cornerA, backA), 0.5);
  const midB = scale(add(cornerB, backB), 0.5);
  const t = lineIntersection(midA, scale(dirA, -1), midB, scale(dirB, -1));
  if (t === null || t <= 0) return fallback();
  const apex = add(midA, scale(dirA, -t));
  if (!pointInPolygon(apex, poly)) return fallback();
  const back = [apex, midA];
  const step = poly[(ia + 1) % poly.length] === backA ? 1 : -1;
  for (let i = (ia + step + poly.length) % poly.length, n = 0; poly[i] !== cornerB && n < poly.length; i = (i + step + poly.length) % poly.length, n++) {
    back.push(poly[i]);
  }
  back.push(midB);
  return {
    faces: [
      { pts: [farA, cornerA, midA, apex], eave: dirA, origin: cornerA, shade: -inA.y < -0.05 },
      { pts: [cornerB, farB, apex, midB], eave: dirB, origin: cornerB, shade: -inB.y < -0.05 },
      { pts: [farB, farA, apex], eave: normalize(sub(farA, farB)), origin: farB, shade: -bisector.y < -0.05 },
      { pts: back, eave: dirA, origin: midA, shade: bisector.y < -0.05 },
    ],
    ridges: [
      [apex, midA],
      [apex, midB],
      [farA, apex],
      [farB, apex],
    ] as [Vec2, Vec2][],
    mid: centroid(poly),
  };
}

/**
 * Casa de esquina en un cruce cuyas calles salen en las direcciones `dirA` y `dirB`.
 * `length` es la longitud de cada fachada y `chamfer` el retranqueo del chaflán.
 */
function cornerHouse(node: Vec2, dirA: Vec2, dirB: Vec2, length: number, chamfer: number): HouseShape | null {
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(dirA, dirB))));
  const bisector = normalize(add(dirA, dirB));
  const corner = add(node, scale(bisector, FRONT_OFFSET / Math.sin(angle / 2)));
  const inA = normalize(sub(dirB, scale(dirA, dot(dirB, dirA))));
  const inB = normalize(sub(dirA, scale(dirB, dot(dirA, dirB))));
  const farA = add(corner, scale(dirA, length));
  const farB = add(corner, scale(dirB, length));
  const chamferA = add(corner, scale(dirA, chamfer));
  const chamferB = add(corner, scale(dirB, chamfer));
  const meet = lineIntersection(farA, inA, farB, inB);
  let poly: Vec2[];
  if (meet !== null && meet > 0 && meet <= LOT_DEPTH) {
    poly = [chamferA, farA, add(farA, scale(inA, meet)), farB, chamferB];
  } else {
    poly = [chamferA, farA, add(farA, scale(inA, LOT_DEPTH)), add(farB, scale(inB, LOT_DEPTH)), farB, chamferB];
  }
  poly = orient(poly);
  // solo huellas convexas
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const r = poly[(i + 2) % poly.length];
    if (cross(sub(q, p), sub(r, q)) < -1e-6) return null;
  }
  const { faces, ridges, mid } = cornerRoof(poly, chamferA, chamferB, farA, farB, dirA, dirB, inA, inB, bisector);
  return {
    kind: "esquina",
    footprint: poly,
    fronts: [
      { a: chamferA, b: farA, out: scale(inA, -1), kind: "casa" },
      { a: farB, b: chamferB, out: scale(inB, -1), kind: "casa" },
      { a: chamferB, b: chamferA, out: scale(bisector, -1), kind: "chaflan" },
    ],
    roof: faces,
    ridges,
    mid,
  };
}

/**
 * Coloca todas las casas del pueblo. Determinista para una semilla dada.
 * Devuelve las casas ordenadas de arriba abajo (para dibujarlas en ese orden).
 */
export function placeHouses(seed = 7): House[] {
  const scene = buildScene();
  const rng = seededRng(seed);
  const houses: House[] = [];
  const grid = new SpatialGrid();
  const overlaps = (poly: Vec2[]) => grid.near(poly).some((id) => convexOverlap(poly, houses[id].footprint));
  const accept = (shape: HouseShape) => {
    const id = houses.length;
    houses.push({ ...shape, id, seed: rng(), facades: [] });
    grid.add(shape.footprint, id);
  };

  // 1. Esquinas: en cada cruce, entre cada par de calles consecutivas
  for (const node of streetNodes) {
    if (node.kind !== "cruce") continue;
    const at = traceToWorld(node);
    const exits = streetEdges
      .filter((e) => e.a === node.id || e.b === node.id)
      .flatMap((e) => (e.a === e.b ? [departure(e, false), departure(e, true)] : [departure(e, e.a !== node.id)]))
      .map((d) => ({ d, ang: Math.atan2(d.y, d.x) }))
      .sort((p, q) => p.ang - q.ang);
    for (let i = 0; i < exits.length; i++) {
      const first = exits[i];
      const second = exits[(i + 1) % exits.length];
      let gap = second.ang - first.ang;
      if (gap <= 0) gap += Math.PI * 2;
      if (gap < (55 * Math.PI) / 180 || gap > (125 * Math.PI) / 180) continue;
      for (const length of [74, 64, 54, 46]) {
        const house = cornerHouse(at, first.d, second.d, length, 16);
        if (house && !overlaps(house.footprint) && siteOk(house.footprint, scene)) {
          accept(house);
          break;
        }
      }
    }
  }

  // 2. Hileras a ambos lados de cada calle
  for (const edge of streetEdges) {
    const line = polyline(edge.points.map(([x, y]) => traceToWorld({ x, y })));
    for (const side of [1, -1]) {
      let d = 0;
      while (d < line.L - MIN_WIDTH) {
        const wanted = 58 + rng() * 26;
        const widths = new Set<number>();
        const toVertex = line.toNextVertex(d);
        if (toVertex >= MIN_WIDTH && toVertex < wanted) widths.add(toVertex);
        for (let w = wanted; w >= MIN_WIDTH; w -= 10) widths.add(w);
        widths.add(MIN_WIDTH);
        let placed = 0;
        // sonda: la casa más pequeña posible aquí; si ni esa cabe, se avanza
        const probe = ((w: number) => {
          const p = line.at(d);
          const q = line.at(d + w);
          const dir = normalize(sub(q, p));
          const inward = scale({ x: -dir.y, y: dir.x }, side);
          const bulge = Math.max(0, ...line.inner(d, d + w).map((v) => dot(sub(v, p), inward)));
          return rowHouse(add(p, scale(inward, FRONT_OFFSET + bulge)), add(q, scale(inward, FRONT_OFFSET + bulge)), MIN_DEPTH, inward).footprint;
        })(Math.min(MIN_WIDTH, line.L - d));
        if (overlaps(probe) || !siteOk(probe, scene)) {
          d += 6;
          continue;
        }
        for (const width of widths) {
          const w = Math.min(width, line.L - d);
          if (w < MIN_WIDTH || line.turn(d, d + w) > MAX_TURN) continue;
          const p = line.at(d);
          const q = line.at(d + w);
          const dir = normalize(sub(q, p));
          const inward = scale({ x: -dir.y, y: dir.x }, side);
          const bulge = Math.max(0, ...line.inner(d, d + w).map((v) => dot(sub(v, p), inward)));
          const a = add(p, scale(inward, FRONT_OFFSET + bulge));
          const b = add(q, scale(inward, FRONT_OFFSET + bulge));
          const shallow = rowHouse(a, b, MIN_DEPTH, inward);
          if (overlaps(shallow.footprint) || !siteOk(shallow.footprint, scene)) continue;
          // la casa más honda que quepa
          for (const depth of [LOT_DEPTH, 60, 50, 42, MIN_DEPTH]) {
            const house = depth === MIN_DEPTH ? shallow : rowHouse(a, b, depth, inward);
            if (depth === MIN_DEPTH || (!overlaps(house.footprint) && siteOk(house.footprint, scene))) {
              accept(house);
              placed = w;
              break;
            }
          }
          if (placed) break;
        }
        if (placed) d += placed + (rng() < 0.1 ? 12 : 0);
        else d += 6;
      }
    }
  }

  // 3. Fachadas visibles: las que miran a la cámara, sin taparse entre sí
  const footprintOf = (id: number) => houses[id].footprint;
  const drawn: { quad: Vec2[]; house: number }[] = [];
  const drawnGrid = new SpatialGrid();
  const bottomFirst = houses.slice().sort((p, q) => q.mid.y - p.mid.y);
  for (const house of bottomFirst) {
    for (const front of house.fronts) {
      const minFacing = front.kind === "chaflan" ? 0.3 : FACADE_MIN_FACING;
      if (front.out.y < minFacing) continue;
      const [a, b] = front.a.x <= front.b.x ? [front.a, front.b] : [front.b, front.a];
      if (Math.hypot(b.x - a.x, b.y - a.y) < (front.kind === "chaflan" ? 14 : 26)) continue;
      const quad = facadeQuad({ a, b });
      const area = Math.abs(signedArea(quad));
      if (overlapArea(quad, house.footprint) < 0.7 * area) continue;
      let covered = 0;
      for (const id of grid.near(quad)) if (id !== house.id) covered += overlapArea(quad, footprintOf(id));
      if (
        covered > FACADE_MAX_COVERED * area ||
        drawnGrid.near(quad).some((i) => drawn[i].house !== house.id && overlapArea(quad, drawn[i].quad) > 1) ||
        scene.streetDist(quad, STREET_HALF_WIDTH + 1) < STREET_HALF_WIDTH ||
        scene.areaDist(quad, 2) < 1 ||
        scene.bridgeDist(quad, 2) < 1
      ) {
        continue;
      }
      house.facades.push({ a, b, kind: front.kind });
      drawnGrid.add(quad, drawn.length);
      drawn.push({ quad, house: house.id });
    }
  }
  return houses.sort((p, q) => p.mid.y - q.mid.y);
}
