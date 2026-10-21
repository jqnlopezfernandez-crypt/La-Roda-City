/**
 * Geometría jugable de La Roda, construida a partir de streets.generated.json.
 *
 * Reglas de fidelidad:
 *  - Las líneas centrales de las calles vienen tal cual del trazado del usuario
 *    (tools/extraer_calles.py). Aquí solo se multiplican por una escala UNIFORME,
 *    así que ángulos, curvas y conexiones se conservan.
 *  - El ancho de calle es un parámetro de jugabilidad: no desplaza ninguna calle.
 *
 * Una posición es transitable si está a menos de medio ancho de alguna línea
 * central (unión de "cápsulas") o dentro de una zona extra (plazas, parques, campo,
 * entradas: shared/map/places.ts), y no choca con un obstáculo (estatua, estanques,
 * bancos). Este módulo no depende de Phaser: lo usan cliente, servidor y pruebas.
 */
import streetData from "./streets.generated.json";
import { AREAS } from "./places";

export type Vec2 = { x: number; y: number };

export type StreetEdge = {
  id: number;
  a: number;
  b: number;
  length: number;
  trazo: string;
  points: [number, number][];
};
export type StreetNode = { id: number; x: number; y: number; kind: string };
export type Block = { id: number; area: number; anchoMax: number; points: [number, number][]; patios: [number, number][][] };
export type Segment = { ax: number; ay: number; bx: number; by: number; edge: number };

/** Píxeles de mundo por píxel del trazado. */
export const MAP_SCALE = 5;
/** Ancho de calle en píxeles del trazado. */
export const STREET_WIDTH_TRACE = 9;
export const STREET_HALF_WIDTH = (STREET_WIDTH_TRACE * MAP_SCALE) / 2;
export const SOURCE_SIZE = { width: streetData.sourceSize[0], height: streetData.sourceSize[1] };
/** Margen alrededor del trazado para que la cámara no choque con el borde. */
export const WORLD_MARGIN = 200;
export const WORLD_SIZE = {
  width: SOURCE_SIZE.width * MAP_SCALE + WORLD_MARGIN * 2,
  height: SOURCE_SIZE.height * MAP_SCALE + WORLD_MARGIN * 2,
};

export function traceToWorld(p: { x: number; y: number }): Vec2 {
  return { x: p.x * MAP_SCALE + WORLD_MARGIN, y: p.y * MAP_SCALE + WORLD_MARGIN };
}

export function worldToTrace(p: Vec2): Vec2 {
  return { x: (p.x - WORLD_MARGIN) / MAP_SCALE, y: (p.y - WORLD_MARGIN) / MAP_SCALE };
}

export const streetNodes = streetData.nodes as StreetNode[];
export const streetEdges = streetData.edges as StreetEdge[];
export const cityBlocks = streetData.blocks as unknown as Block[];
/** Métricas de calidad de la extracción (las comprueban las pruebas). */
export const extractionReport = streetData.report;

export const segments: Segment[] = [];
for (const e of streetEdges) {
  for (let i = 0; i < e.points.length - 1; i++) {
    const a = traceToWorld({ x: e.points[i][0], y: e.points[i][1] });
    const b = traceToWorld({ x: e.points[i + 1][0], y: e.points[i + 1][1] });
    segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, edge: e.id });
  }
}

/** Cuadrícula espacial para buscar segmentos cercanos sin recorrerlos todos. */
const CELL = 160;
const gridCols = Math.ceil(WORLD_SIZE.width / CELL);
const gridRows = Math.ceil(WORLD_SIZE.height / CELL);
const grid: number[][] = Array.from({ length: gridCols * gridRows }, () => []);
{
  const pad = STREET_HALF_WIDTH + CELL; // cubre la búsqueda en celdas vecinas
  segments.forEach((s, idx) => {
    const minX = Math.max(0, Math.floor((Math.min(s.ax, s.bx) - pad) / CELL));
    const maxX = Math.min(gridCols - 1, Math.floor((Math.max(s.ax, s.bx) + pad) / CELL));
    const minY = Math.max(0, Math.floor((Math.min(s.ay, s.by) - pad) / CELL));
    const maxY = Math.min(gridRows - 1, Math.floor((Math.max(s.ay, s.by) + pad) / CELL));
    for (let gy = minY; gy <= maxY; gy++) for (let gx = minX; gx <= maxX; gx++) grid[gy * gridCols + gx].push(idx);
  });
}

function closestOnSegment(px: number, py: number, s: Segment): Vec2 {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - s.ax) * dx + (py - s.ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: s.ax + t * dx, y: s.ay + t * dy };
}

function candidates(p: Vec2): number[] {
  const gx = Math.floor(p.x / CELL);
  const gy = Math.floor(p.y / CELL);
  if (gx >= 0 && gy >= 0 && gx < gridCols && gy < gridRows) {
    const list = grid[gy * gridCols + gx];
    if (list.length) return list;
  }
  return segments.map((_, i) => i); // fuera de la cuadrícula: búsqueda completa
}

/** Punto más cercano de la red de calles (línea central) y su distancia. */
export function nearestOnNetwork(p: Vec2): { point: Vec2; distance: number; edge: number } {
  let best = { point: p, distance: Infinity, edge: -1 };
  for (const i of candidates(p)) {
    const q = closestOnSegment(p.x, p.y, segments[i]);
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best.distance) best = { point: q, distance: d, edge: segments[i].edge };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Zonas extra (plazas, parques, campo, entradas) y obstáculos, en coordenadas de mundo

export type WorldArea =
  | { id: string; kind: "circulo"; c: Vec2; r: number }
  | { id: string; kind: "poligono"; pts: Vec2[] };

/** Obstáculo redondo (c, r) o poligonal (`pts`; entonces r = 0). */
export type WorldObstacle = { area: string; tipo: string; c: Vec2; r: number; pts?: Vec2[] };

export const worldAreas: WorldArea[] = AREAS.map((a): WorldArea =>
  "circulo" in a.forma
    ? { id: a.id, kind: "circulo", c: traceToWorld(a.forma.circulo), r: a.forma.circulo.r * MAP_SCALE }
    : { id: a.id, kind: "poligono", pts: a.forma.poligono.map(([x, y]) => traceToWorld({ x, y })) },
);

export const worldObstacles: WorldObstacle[] = AREAS.flatMap((a) =>
  a.obstaculos.map((o) => ({
    area: a.id,
    tipo: o.tipo,
    c: traceToWorld(o),
    r: o.r * MAP_SCALE,
    ...(o.poligono ? { pts: o.poligono.map(([x, y]) => traceToWorld({ x, y })) } : {}),
  })),
);

/** Punto dentro de polígono (regla par-impar). */
function insidePolygon(p: Vec2, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Punto más cercano del borde de un polígono y su distancia. */
function nearestOnPolygonEdge(p: Vec2, pts: Vec2[]): { q: Vec2; d: number } {
  let best = { q: pts[0], d: Infinity };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const q = closestOnSegment(p.x, p.y, { ax: a.x, ay: a.y, bx: b.x, by: b.y, edge: -1 });
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best.d) best = { q, d };
  }
  return best;
}

/** ¿Cabe un círculo de radio `radius` centrado en `p` dentro de la zona? */
function insideArea(p: Vec2, area: WorldArea, radius: number): boolean {
  if (area.kind === "circulo") return Math.hypot(p.x - area.c.x, p.y - area.c.y) <= area.r - radius + 1e-6;
  return insidePolygon(p, area.pts) && nearestOnPolygonEdge(p, area.pts).d >= radius - 1e-6;
}

function hitsObstacle(p: Vec2, radius: number): boolean {
  return worldObstacles.some((o) =>
    o.pts
      ? insidePolygon(p, o.pts) || nearestOnPolygonEdge(p, o.pts).d < radius - 1e-6
      : Math.hypot(p.x - o.c.x, p.y - o.c.y) < o.r + radius - 1e-6,
  );
}

function onStreet(p: Vec2, radius: number): boolean {
  return nearestOnNetwork(p).distance <= STREET_HALF_WIDTH - radius + 1e-6;
}

/** ¿Puede estar aquí el centro de un personaje de radio `radius`? */
export function isWalkable(p: Vec2, radius = 0): boolean {
  if (hitsObstacle(p, radius)) return false;
  return onStreet(p, radius) || worldAreas.some((a) => insideArea(p, a, radius));
}

/** Empuja un punto fuera de los obstáculos que lo contengan. */
function pushOutOfObstacles(p: Vec2, radius: number): Vec2 {
  let q = p;
  for (const o of worldObstacles) {
    if (o.pts) {
      const { q: e, d } = nearestOnPolygonEdge(q, o.pts);
      const inside = insidePolygon(q, o.pts);
      if (!inside && d >= radius + 0.01) continue;
      // Hacia fuera del polígono, a radio + 0,01 del borde
      const min = radius + 0.01;
      if (d === 0) continue;
      const k = (inside ? -1 : 1) / d;
      q = { x: e.x + (q.x - e.x) * k * min, y: e.y + (q.y - e.y) * k * min };
      continue;
    }
    const d = Math.hypot(q.x - o.c.x, q.y - o.c.y);
    const min = o.r + radius + 0.01;
    if (d < min) {
      const inv = d === 0 ? 1 : 1 / d;
      const dx = d === 0 ? 1 : q.x - o.c.x;
      const dy = d === 0 ? 0 : q.y - o.c.y;
      q = { x: o.c.x + dx * inv * min, y: o.c.y + dy * inv * min };
    }
  }
  return q;
}

/**
 * Lleva una posición al punto transitable más cercano. Se prueban candidatos:
 * la proyección sobre la cápsula de la calle más cercana y la proyección sobre
 * cada zona extra; se queda el más cercano que sea transitable.
 */
export function clampToStreets(p: Vec2, radius = 0): Vec2 {
  if (isWalkable(p, radius)) return { x: p.x, y: p.y };
  // El propio punto, empujado fuera de los obstáculos (deslizar junto a un estanque o un vaso)
  const options: Vec2[] = [p];
  const limit = Math.max(0, STREET_HALF_WIDTH - radius);
  const n = nearestOnNetwork(p);
  const k = n.distance === 0 ? 0 : limit / n.distance;
  options.push({ x: n.point.x + (p.x - n.point.x) * k, y: n.point.y + (p.y - n.point.y) * k });
  for (const area of worldAreas) {
    if (area.kind === "circulo") {
      const d = Math.hypot(p.x - area.c.x, p.y - area.c.y);
      const r = Math.max(0, area.r - radius);
      options.push(d <= r ? p : { x: area.c.x + ((p.x - area.c.x) * r) / d, y: area.c.y + ((p.y - area.c.y) * r) / d });
    } else {
      const { q, d } = nearestOnPolygonEdge(p, area.pts);
      const inside = insidePolygon(p, area.pts);
      if (d > 0) {
        const offset = (inside ? 1 : -1) * (radius + 0.5);
        options.push({ x: q.x + ((p.x - q.x) / d) * offset, y: q.y + ((p.y - q.y) / d) * offset });
      }
    }
  }
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (const option of options) {
    const q = pushOutOfObstacles(option, radius);
    if (!isWalkable(q, radius)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best ?? options[0];
}

/**
 * Mueve un personaje desde `from` intentando desplazarse `delta`.
 * Se subdivide en pasos cortos para no atravesar manzanas estrechas y se
 * proyecta tras cada paso, lo que produce deslizamiento suave contra las fachadas.
 */
export function moveAlongStreets(from: Vec2, delta: Vec2, radius = 0): Vec2 {
  const dist = Math.hypot(delta.x, delta.y);
  const maxStep = Math.max(4, STREET_HALF_WIDTH / 3);
  const steps = Math.max(1, Math.ceil(dist / maxStep));
  let p = { ...from };
  for (let i = 0; i < steps; i++) {
    const next = clampToStreets({ x: p.x + delta.x / steps, y: p.y + delta.y / steps }, radius);
    // Nunca saltar a otra calle que no esté conectada con la actual por un paso corto.
    if (Math.hypot(next.x - p.x, next.y - p.y) > maxStep * 1.5) break;
    p = next;
  }
  return p;
}

/** Punto de acceso a pie más cercano a una posición (p. ej. la puerta de un local). */
export function accessPoint(p: Vec2, radius = 0): Vec2 {
  return clampToStreets(p, radius);
}
/** Nombre que usa el cliente para `accessPoint`. */
export const nearestWalkable = accessPoint;

/** Punto de aparición por defecto: el cruce más próximo al ayuntamiento del dibujo. */
export function defaultSpawn(): Vec2 {
  const target = traceToWorld({ x: 498, y: 751.8 });
  let best = streetNodes[0];
  let bestD = Infinity;
  for (const n of streetNodes) {
    if (n.kind !== "cruce") continue;
    const w = traceToWorld(n);
    const d = Math.hypot(w.x - target.x, w.y - target.y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return traceToWorld(best);
}

/** ¿Se puede ir en línea recta de `a` a `b` sin salir de lo transitable? (muestreo cada 4 px) */
export function segmentWalkable(a: Vec2, b: Vec2, radius = 0): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  for (let i = 1; i <= n; i++) {
    if (!isWalkable({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }, radius)) return false;
  }
  return true;
}

/**
 * Validación en el servidor de una posición enviada por un cliente: no más rápido
 * de lo permitido (con holgura por la latencia) y sin atravesar manzanas.
 */
export function validateMove(
  from: Vec2,
  requested: Vec2,
  elapsedMs: number,
  maxSpeed: number,
  radius: number,
): { position: Vec2; accepted: boolean } {
  if (!Number.isFinite(requested.x) || !Number.isFinite(requested.y)) return { position: from, accepted: false };
  const allowance = maxSpeed * (Math.min(Math.max(elapsedMs, 0), 1000) / 1000) * 1.35 + 12;
  const dx = requested.x - from.x;
  const dy = requested.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= allowance && segmentWalkable(from, requested, radius)) return { position: requested, accepted: true };
  const k = dist > allowance ? allowance / dist : 1;
  return { position: moveAlongStreets(from, { x: dx * k, y: dy * k }, radius), accepted: false };
}
