/**
 * Rutas a pie por las calles del trazado (Dijkstra sobre el grafo de calles).
 * Sirve para guiar al jugador hacia sus misiones y para las pruebas automáticas.
 * Los extremos de la ruta pueden estar dentro de plazas, parques o el campo: en ese
 * caso se busca un punto intermedio para no cruzar por fuera de lo transitable.
 */
import { clampToStreets, segmentWalkable, streetEdges, traceToWorld, type Vec2 } from "./townMap";

type Link = { to: number; edge: number; reverse: boolean; length: number };
export type Path = { points: Vec2[]; length: number };

const edgePts: Vec2[][] = streetEdges.map((e) => e.points.map(([x, y]) => traceToWorld({ x, y })));
const edgeLen = edgePts.map((pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0));
const adjacency = new Map<number, Link[]>();
streetEdges.forEach((e, i) => {
  adjacency.set(e.a, [...(adjacency.get(e.a) ?? []), { to: e.b, edge: i, reverse: false, length: edgeLen[i] }]);
  adjacency.set(e.b, [...(adjacency.get(e.b) ?? []), { to: e.a, edge: i, reverse: true, length: edgeLen[i] }]);
});

/** Radio del personaje al comprobar tramos rectos. */
const RADIUS = 10;

/** Proyección de un punto sobre el tramo más cercano: tramo, segmento y fracción recorrida. */
function project(p: Vec2) {
  let best = { edge: 0, seg: 0, t: 0, point: p, d: Infinity, along: 0 };
  edgePts.forEach((pts, ei) => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
      const q = { x: a.x + dx * t, y: a.y + dy * t };
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      const segLen = Math.sqrt(L2);
      if (d < best.d) best = { edge: ei, seg: i, t, point: q, d, along: acc + segLen * t };
      acc += segLen;
    }
  });
  return best;
}

/** Puntos de un tramo desde el extremo `fromStart` hasta la posición proyectada. */
function partial(edge: number, seg: number, q: Vec2, fromStart: boolean): Vec2[] {
  const pts = edgePts[edge];
  return fromStart ? [...pts.slice(0, seg + 1), q] : [q, ...pts.slice(seg + 1)];
}

/**
 * Ruta más corta por las calles de `from` a `to` (en coordenadas de mundo).
 * Si el primer o el último tramo recto no es transitable (p. ej. el destino está
 * dentro de un parque), se intercala un punto de paso.
 */
export function findPath(from: Vec2, to: Vec2, opts: { skipHead?: boolean } = {}): Path {
  const route = streetRoute(from, to);
  if (!Number.isFinite(route.length) || route.points.length < 3) return route;
  const pts = route.points;
  const detour = (a: Vec2, b: Vec2): Vec2[] => {
    if (segmentWalkable(a, b, RADIUS)) return [];
    // celdas de 8 px: el jugador que se mueve un poco reutiliza el desvío ya calculado
    const key = `${Math.round(a.x / 8)},${Math.round(a.y / 8)}>${Math.round(b.x / 8)},${Math.round(b.y / 8)}`;
    const cached = detourCache.get(key);
    if (cached) return cached;
    const found = findWaypoint(a, b);
    if (detourCache.size > 400) detourCache.clear();
    detourCache.set(key, found);
    return found;
  };
  // skipHead: la guía de puntos en pantalla no necesita el desvío desde la posición exacta del
  // jugador (cambia en cada paso y recalcularlo cuesta); empieza en la calle más cercana
  const head = opts.skipHead ? [] : detour(pts[0], pts[1]);
  const tail = detour(pts[pts.length - 2], pts[pts.length - 1]);
  return { points: [pts[0], ...head, ...pts.slice(1, -1), ...tail, pts[pts.length - 1]], length: route.length };
}

const detourCache = new Map<string, Vec2[]>();

/** Longitud de la ruta por las calles sin calcular desvíos (barata: para elegir el destino más cercano). */
export function routeLength(from: Vec2, to: Vec2): number {
  return streetRoute(from, to).length;
}

/**
 * Busca en una rejilla alrededor del tramo un punto desde el que se vean ambos extremos.
 * Los candidatos se prueban de más corto a más largo y se para en el primero que vale:
 * comprobar un tramo es caro (≈ 0,5 ms) y antes se probaban los ~1000 de la rejilla,
 * lo que congelaba el juego unos segundos dentro de parques y plazas.
 */
function findWaypoint(a: Vec2, b: Vec2): Vec2[] {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const reach = Math.min(160, Math.hypot(b.x - a.x, b.y - a.y) / 2 + 60);
  const seen = new Set<string>();
  const candidates: { w: Vec2; len: number }[] = [];
  for (let dy = -reach; dy <= reach; dy += 16) {
    for (let dx = -reach; dx <= reach; dx += 16) {
      const w = clampToStreets({ x: cx + dx, y: cy + dy }, RADIUS + 2);
      const key = `${Math.round(w.x / 4)},${Math.round(w.y / 4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ w, len: Math.hypot(w.x - a.x, w.y - a.y) + Math.hypot(b.x - w.x, b.y - w.y) });
    }
  }
  candidates.sort((p, q) => p.len - q.len);
  for (let i = 0; i < candidates.length && i < 60; i++) {
    const { w } = candidates[i];
    if (segmentWalkable(a, w, RADIUS) && segmentWalkable(w, b, RADIUS)) return [w];
  }
  return [];
}

/** Ruta por la red de calles (sin desvíos), Dijkstra desde los extremos del tramo de salida. */
function streetRoute(from: Vec2, to: Vec2): Path {
  const A = project(from);
  const B = project(to);
  if (A.edge === B.edge) {
    const pts = edgePts[A.edge];
    const forward = A.along <= B.along;
    const lo = forward ? A : B;
    const hi = forward ? B : A;
    const mid = pts.slice(lo.seg + 1, hi.seg + 1);
    const path = [lo.point, ...mid, hi.point];
    if (!forward) path.reverse();
    return { points: [from, ...path, to], length: Math.abs(B.along - A.along) };
  }
  const startEdge = streetEdges[A.edge];
  const endEdge = streetEdges[B.edge];
  const starts: Link[] = [
    { to: startEdge.a, edge: A.edge, reverse: true, length: A.along },
    { to: startEdge.b, edge: A.edge, reverse: false, length: edgeLen[A.edge] - A.along },
  ];
  // coste restante desde cada extremo del tramo de llegada
  const goals = new Map([
    [endEdge.a, B.along],
    [endEdge.b, edgeLen[B.edge] - B.along],
  ]);
  const dist = new Map<number, number>();
  const prev = new Map<number, { from: number; link: Link }>();
  const open: { n: number; f: number }[] = [];
  for (const s of starts) {
    if (s.length < (dist.get(s.to) ?? Infinity)) {
      dist.set(s.to, s.length);
      prev.set(s.to, { from: -1, link: s });
      open.push({ n: s.to, f: s.length });
    }
  }
  let best = { node: -1, cost: Infinity };
  while (open.length) {
    open.sort((x, y) => x.f - y.f);
    const { n } = open.shift()!;
    const d = dist.get(n)!;
    const rest = goals.get(n);
    if (rest !== undefined && d + rest < best.cost) best = { node: n, cost: d + rest };
    if (d >= best.cost) continue;
    for (const l of adjacency.get(n) ?? []) {
      const nd = d + l.length;
      if (nd < (dist.get(l.to) ?? Infinity)) {
        dist.set(l.to, nd);
        prev.set(l.to, { from: n, link: l });
        open.push({ n: l.to, f: nd });
      }
    }
  }
  if (best.node < 0) return { points: [from, to], length: Infinity };
  const chain: { from: number; link: Link }[] = [];
  for (let n = best.node; n !== -1; ) {
    const step = prev.get(n)!;
    chain.unshift(step);
    n = step.from;
  }
  const first = chain[0].link;
  const points = [from, ...(first.reverse ? partial(A.edge, A.seg, A.point, true).reverse() : partial(A.edge, A.seg, A.point, false))];
  for (const step of chain.slice(1)) {
    const pts = edgePts[step.link.edge];
    points.push(...(step.link.reverse ? [...pts].reverse() : pts));
  }
  const arrivesAtA = best.node === endEdge.a;
  points.push(...(arrivesAtA ? partial(B.edge, B.seg, B.point, true) : partial(B.edge, B.seg, B.point, false).reverse()));
  points.push(to);
  return { points, length: best.cost };
}
