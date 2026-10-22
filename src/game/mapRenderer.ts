import { ART, HOUSE_KEYS, ROOF_KEYS } from "../art/index";
import { LANDMARK_ART } from "../art/landmarks";
import { DrawRecorder, type PatternMatrix, type Point } from "./recorder";
import { STREET_HALF_WIDTH, WORLD_SIZE, cityBlocks, isWalkable, nearestOnNetwork, streetEdges, traceToWorld, worldAreas, worldObstacles } from "../../shared/map/townMap";
import { RIVER_WIDTH, bridges, riverLines } from "../../shared/map/river";
import { BRIDGE, LOT_DEPTH, RIDGE_HEIGHT, WALL_HEIGHT, bridgeFrame, placeHouses } from "../../shared/map/houses";
import { pointsOfInterest } from "../../shared/data/pointsOfInterest";
import { AREAS, courtPolygon } from "../../shared/map/places";
import { RAIL_BED_WIDTH, levelCrossings, railLines } from "../../shared/map/railway";
import { LANDMARK_HEIGHT, landmarks, shopSigns } from "../../shared/map/landmarks";
import Phaser from "phaser";
import { addProp, artCanvas } from "../art/runtime";

/**
 * Dibujo del pueblo. Todo el mapa se "graba" una vez en un DrawRecorder (campo,
 * manzanas, río, calles, zonas, casas, puentes) y después se hornea en texturas
 * por trozos alrededor de la cámara (TownRenderer). La decoración con sprites
 * (árboles, farolas, bancos…) se reúne mientras se graba y la coloca placeDecor.
 */

const COLORS = {
  agua: 0x3f7891,
  aguaClara: 0x6ea2b8,
  orilla: 0x5f7a46,
  piedra: 0xcbbd9f,
  piedraOscura: 0x8a7b62,
  cespedOscuro: 0x4f7536,
  albero: 0xcdb07a,
  tinta: 0x2a1c14,
  acera: 0xa89d88,
};

const FACADE_KEYS = HOUSE_KEYS.filter((key: string) => key.startsWith("fachada-"));
const CORNER_KEYS = ART.filter((art: { key: string }) => art.key.startsWith("esquina-")).map((art: { key: string }) => art.key);

/** Elemento de decoración que se coloca como sprite encima del mapa horneado. */
interface DecorItem {
  key: string;
  x: number;
  y: number;
  flip?: boolean;
  size?: number;
}

/** Un edificio por dibujar (casa, edificio singular o torre). */
interface BuildingJob {
  /** Borde sur de la huella: orden de pintado y profundidad del sprite. */
  y: number;
  draw: () => void;
  /** Huella y altura total para saber si puede tapar a un personaje. */
  shape?: Point[];
  lift?: number;
  /** Siempre como sprite (edificios altos). */
  always?: boolean;
}

/** Edificio separado del suelo para que tape a los personajes que pasan por detrás. */
export interface Occluder {
  rec: DrawRecorder;
  baseY: number;
  box: { x0: number; y0: number; x1: number; y1: number };
}
const occluders: Occluder[] = [];

function unionBox(ops: { x0: number; y0: number; x1: number; y1: number }[]) {
  return {
    x0: Math.min(...ops.map((o) => o.x0)),
    y0: Math.min(...ops.map((o) => o.y0)),
    x1: Math.max(...ops.map((o) => o.x1)),
    y1: Math.max(...ops.map((o) => o.y1)),
  };
}

/**
 * ¿Puede quedar un personaje detrás de este edificio? Sí, si hay algún punto transitable
 * dentro de la imagen del edificio (huella + huella levantada) y al norte de su base.
 */
function canHidePlayer(shape: Point[], lift: number, baseY: number): boolean {
  const pts = [...shape, ...shape.map((p) => ({ x: p.x, y: p.y - lift }))];
  const hull = convexHull(pts);
  const box = boundsOf(hull);
  for (let y = box.y0 + 6; y < Math.min(box.y1, baseY - 10); y += 8) {
    for (let x = box.x0 + 6; x < box.x1 - 6; x += 8) {
      if (!pointInPolygon(x, y, hull) || distToPolyline(x, y, hull, true) < 8) continue;
      if (isWalkable({ x, y }, 6)) return true;
    }
  }
  return false;
}

function convexHull(points: Point[]): Point[] {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Decoración reunida al grabar el mapa (la consume placeDecor). */
const decorItems: DecorItem[] = [];

type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** Generador pseudoaleatorio con semilla (mulberry32): el mapa sale siempre igual. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 1831565813) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function boundsOf(points: Point[]): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Lo que necesita drawSportsCourt de un DrawRecorder (lo cumple también un marco girado). */
interface CourtPen {
  fillStyle(color: number, alpha?: number): CourtPen;
  fillTexture(key: string, alpha?: number): CourtPen;
  lineStyle(width: number, color: number, alpha?: number): CourtPen;
  fillRect(x: number, y: number, w: number, h: number): CourtPen;
  strokeRect(x: number, y: number, w: number, h: number): CourtPen;
  lineBetween(x0: number, y0: number, x1: number, y1: number): CourtPen;
  fillCircle(x: number, y: number, r: number): CourtPen;
  strokeCircle(x: number, y: number, r: number): CourtPen;
  beginPath(): CourtPen;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): CourtPen;
  strokePath(): CourtPen;
}

/**
 * Dibuja una pista dada por su cuadrilátero (q0→q1 = ancho, q0→q3 = largo) aunque esté
 * girada: las coordenadas locales de la pista se llevan al mundo con un marco de referencia.
 */
function drawCourt(rec: DrawRecorder, kind: string, quad: Point[]): void {
  const o = quad[0];
  const w = Math.hypot(quad[1].x - o.x, quad[1].y - o.y);
  const h = Math.hypot(quad[3].x - o.x, quad[3].y - o.y);
  const ax = (quad[1].x - o.x) / w;
  const ay = (quad[1].y - o.y) / w;
  const bx = (quad[3].x - o.x) / h;
  const by = (quad[3].y - o.y) / h;
  const angle = Math.atan2(ay, ax);
  const P = (x: number, y: number): Point => ({ x: o.x + ax * x + bx * y, y: o.y + ay * x + by * y });
  const corners = (x: number, y: number, ww: number, hh: number) => [P(x, y), P(x + ww, y), P(x + ww, y + hh), P(x, y + hh)];
  const pen: CourtPen = {
    fillStyle: (c, a = 1) => (rec.fillStyle(c, a), pen),
    fillTexture: (key, a = 1) => (rec.fillTexture(key, undefined, a), pen),
    lineStyle: (wd, c, a = 1) => (rec.lineStyle(wd, c, a), pen),
    fillRect: (x, y, ww, hh) => (rec.fillPoints(corners(x, y, ww, hh)), pen),
    strokeRect: (x, y, ww, hh) => (rec.strokePoints(corners(x, y, ww, hh), true), pen),
    lineBetween: (x0, y0, x1, y1) => {
      const a = P(x0, y0);
      const b = P(x1, y1);
      rec.lineBetween(a.x, a.y, b.x, b.y);
      return pen;
    },
    fillCircle: (x, y, r) => {
      const c = P(x, y);
      rec.fillCircle(c.x, c.y, r);
      return pen;
    },
    strokeCircle: (x, y, r) => {
      const c = P(x, y);
      rec.strokeCircle(c.x, c.y, r);
      return pen;
    },
    beginPath: () => (rec.beginPath(), pen),
    arc: (x, y, r, a0, a1, ccw) => {
      const c = P(x, y);
      rec.arc(c.x, c.y, r, a0 + angle, a1 + angle, ccw);
      return pen;
    },
    strokePath: () => (rec.strokePath(), pen),
  };
  // Sombra suave del cercado
  rec.softShadow(quad, 8, 0.35, 4, 6);
  drawSportsCourt(pen, kind, 0, 0, w, h);
  rec.lineStyle(3, COLORS.tinta, 0.9).strokePoints(quad, true);
}

/** Pistas deportivas (fútbol, fútbol sala, tenis, baloncesto) dentro del rectángulo. */
function drawSportsCourt(rec: CourtPen, kind: string, x0: number, y0: number, x1: number, y1: number): void {
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const whiteLine = (width = 2) => rec.lineStyle(width, 0xffffff, 0.95);
  if (kind === "futbol") {
    // Césped pintado a franjas de segado (claras y oscuras)
    rec.fillStyle(0x4f9a46, 1).fillRect(x0, y0, w, h);
    rec.fillTexture("suelo-cesped", 0.85).fillRect(x0, y0, w, h);
    rec.fillStyle(0xd8f0a0, 0.13);
    for (let y = y0; y < y1; y += 60) rec.fillRect(x0, y, w, 30);
    rec.fillStyle(0x1f3a14, 0.08);
    for (let y = y0 + 30; y < y1; y += 60) rec.fillRect(x0, y, w, 30);
    // calvas de tierra en las porterías y el centro
    rec.fillStyle(0x9a7a4a, 0.28).fillCircle(cx, y0 + 26, 16).fillCircle(cx, y1 - 26, 16).fillCircle(cx, cy, 10);
    const margin = 12;
    whiteLine(3);
    rec.strokeRect(x0 + margin, y0 + margin, w - 2 * margin, h - 2 * margin);
    rec.lineBetween(x0 + margin, cy, x1 - margin, cy);
    rec.strokeCircle(cx, cy, Math.min(w, h) * 0.16);
    rec.fillStyle(0xffffff, 1).fillCircle(cx, cy, 3);
    // Áreas grande y pequeña
    const areaW = w * 0.56;
    const areaH = h * 0.15;
    const smallW = w * 0.28;
    const smallH = h * 0.06;
    rec.strokeRect(cx - areaW / 2, y0 + margin, areaW, areaH).strokeRect(cx - areaW / 2, y1 - margin - areaH, areaW, areaH);
    rec.strokeRect(cx - smallW / 2, y0 + margin, smallW, smallH).strokeRect(cx - smallW / 2, y1 - margin - smallH, smallW, smallH);
    // Porterías con red
    for (const [goalY, dir] of [
      [y0 + margin, -1],
      [y1 - margin, 1],
    ]) {
      rec.fillStyle(0xdedede, 0.55).fillRect(cx - smallW * 0.35, dir < 0 ? goalY - 10 : goalY, smallW * 0.7, 10);
      rec.lineStyle(3, 0xffffff, 1);
      rec.lineBetween(cx - smallW * 0.35, goalY, cx - smallW * 0.35, goalY - 14).lineBetween(cx + smallW * 0.35, goalY, cx + smallW * 0.35, goalY - 14);
      rec.lineBetween(cx - smallW * 0.35, goalY - 14, cx + smallW * 0.35, goalY - 14);
    }
  } else if (kind === "futbol-sala") {
    rec.fillStyle(0x3d6fb0, 1).fillRect(x0, y0, w, h);
    rec.fillStyle(0xd0703a, 1).fillRect(x0 + 8, y0 + 8, w - 16, h - 16);
    rec.fillTexture("suelo-asfalto", 0.22).fillRect(x0, y0, w, h);
    whiteLine();
    rec.strokeRect(x0 + 8, y0 + 8, w - 16, h - 16);
    rec.lineBetween(cx, y0 + 8, cx, y1 - 8);
    rec.strokeCircle(cx, cy, Math.min(w, h) * 0.15);
    for (const goalX of [x0 + 8, x1 - 8]) {
      rec
        .beginPath()
        .arc(goalX, cy, h * 0.25, goalX < cx ? -Math.PI / 2 : Math.PI / 2, goalX < cx ? Math.PI / 2 : (3 * Math.PI) / 2)
        .strokePath();
      rec.lineStyle(3, 0xffffff, 1).strokeRect(goalX - (goalX < cx ? 6 : 0), cy - 10, 6, 20);
      whiteLine();
    }
  } else if (kind === "tenis") {
    const inset = (h - 24) * 0.12;
    rec.fillStyle(0x3f8a5a, 1).fillRect(x0, y0, w, h);
    rec.fillStyle(0x3b6fa8, 1).fillRect(x0 + 10, y0 + 12, w - 20, h - 24);
    rec.fillTexture("suelo-asfalto", 0.2).fillRect(x0, y0, w, h);
    whiteLine();
    rec.strokeRect(x0 + 10, y0 + 12, w - 20, h - 24);
    rec.strokeRect(x0 + 10, y0 + 12 + inset, w - 20, (h - 24) * 0.76);
    rec.lineBetween(x0 + w * 0.3, y0 + 12 + inset, x0 + w * 0.3, y1 - 12 - inset);
    rec.lineBetween(x1 - w * 0.3, y0 + 12 + inset, x1 - w * 0.3, y1 - 12 - inset);
    rec.lineBetween(x0 + w * 0.3, cy, x1 - w * 0.3, cy);
    // Red
    rec.lineStyle(2, 0x222222, 1).lineBetween(cx, y0 + 6, cx, y1 - 6);
    rec.fillStyle(0xffffff, 1).fillRect(cx - 1.5, y0 + 4, 3, 8).fillRect(cx - 1.5, y1 - 12, 3, 8);
  } else if (kind === "baloncesto") {
    rec.fillStyle(0x8c8f96, 1).fillRect(x0, y0, w, h);
    rec.fillStyle(0xc9673b, 1).fillRect(x0 + 8, y0 + 8, w - 16, h - 16);
    rec.fillTexture("suelo-asfalto", 0.22).fillRect(x0, y0, w, h);
    whiteLine();
    rec.strokeRect(x0 + 8, y0 + 8, w - 16, h - 16);
    rec.lineBetween(x0 + 8, cy, x1 - 8, cy);
    rec.strokeCircle(cx, cy, Math.min(w, h) * 0.13);
    for (const [baseY, dir] of [
      [y0 + 8, 1],
      [y1 - 8, -1],
    ]) {
      rec.lineStyle(2, 0xffffff, 0.95).strokeRect(cx - 16, dir > 0 ? baseY : baseY - h * 0.22, 32, h * 0.22);
      // Canasta: poste, tablero y aro
      const hoopY = baseY + dir * 14;
      rec.fillStyle(0x555555, 1).fillRect(cx - 2, hoopY - 18, 4, 18);
      rec.fillStyle(0xffffff, 1).fillRect(cx - 12, hoopY - 28, 24, 12);
      rec.lineStyle(2, 0xe2521f, 1).strokeCircle(cx, hoopY - 12, 5);
    }
  }
}

const tracePoints = (points: number[][]): Point[] => points.map(([x, y]) => traceToWorld({ x, y }));

/** Graba todo el mapa del pueblo y reúne la decoración (decorItems). */
function buildTownDrawing(): DrawRecorder {
  const rec = new DrawRecorder();
  const halfWidth = STREET_HALF_WIDTH;
  decorItems.length = 0;
  rec.fillTexture("suelo-campo").fillRect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);

  // Manzanas (suelo de tierra; las casas van encima)
  const blocks = cityBlocks.map((block) => tracePoints(block.points));
  for (const block of blocks) {
    rec.fillTexture("suelo-tierra").fillPoints(block);
    rec.lineStyle(3, COLORS.tinta, 0.5).strokePoints(block, true);
  }

  // Río: contorno, orilla, agua y reflejo central
  const strokeRiver = (width: number, color: number, alpha = 1) => {
    for (const line of riverLines) rec.lineStyle(width, color, alpha).strokePoints(line, false);
  };
  strokeRiver(RIVER_WIDTH + 22, COLORS.tinta, 0.8);
  strokeRiver(RIVER_WIDTH + 16, COLORS.orilla);
  strokeRiver(RIVER_WIDTH, COLORS.agua);
  strokeRiver(RIVER_WIDTH * 0.3, COLORS.aguaClara, 0.5);
  drawRiverDetails(rec);
  drawAreas(rec);
  drawRailways(rec);

  // Calles en capas: contorno, acera, bordillo y asfalto
  const strokeStreets = (setStyle: () => void) => {
    for (const edge of streetEdges) {
      setStyle();
      rec.strokePoints(tracePoints(edge.points), false);
    }
  };
  strokeStreets(() => rec.lineStyle(halfWidth * 2 + 10, COLORS.tinta, 1));
  strokeStreets(() => rec.lineTexture(halfWidth * 2 + 6, "suelo-acera"));
  strokeStreets(() => rec.lineStyle(halfWidth * 2 - 10, 0x5e574f, 1));
  strokeStreets(() => rec.lineTexture(halfWidth * 2 - 14, "suelo-asfalto"));
  drawLevelCrossings(rec);

  // Alcantarillas en algunos puntos de las calles
  const drainRandom = seededRandom(5);
  for (const edge of streetEdges) {
    const pts = tracePoints(edge.points);
    for (let i = 1; i < pts.length; i += 3) {
      if (drainRandom() < 0.6) continue;
      rec.fillStyle(COLORS.tinta, 1).fillCircle(pts[i].x, pts[i].y, 7);
      rec.fillStyle(0x5a5550, 1).fillCircle(pts[i].x, pts[i].y, 5.5);
      rec
        .lineStyle(1.2, COLORS.tinta, 0.8)
        .lineBetween(pts[i].x - 4, pts[i].y, pts[i].x + 4, pts[i].y)
        .lineBetween(pts[i].x, pts[i].y - 4, pts[i].x, pts[i].y + 4);
    }
  }

  const inArea = (x: number, y: number) =>
    worldAreas.some((area) => (area.kind === "circulo" ? Math.hypot(x - area.c.x, y - area.c.y) < area.r + 8 : pointInPolygon(x, y, area.pts)));

  for (const sgn of shopSigns) decorItems.push({ key: `letrero-${sgn.kind}`, x: sgn.x, y: sgn.y });

  // Casas y edificios en vista 3/4: muros que miran a la cámara y tejado levantado sobre ellos.
  // Se pintan de atrás hacia delante (por el borde sur de la huella) para que se tapen bien.
  const houses = placeHouses(7);
  for (const house of houses) rec.softShadow(house.footprint, 14, 0.55, 9, 12);
  const jobs: BuildingJob[] = [];
  const facadeLamps: Point[] = [];
  let houseFacadeCount = 0;
  for (const house of houses) {
    jobs.push({
      y: Math.max(...house.footprint.map((p) => p.y)),
      shape: house.footprint,
      lift: WALL_HEIGHT + RIDGE_HEIGHT,
      draw: () => {
        const roofKey = ROOF_KEYS[Math.floor(house.seed * ROOF_KEYS.length) % ROOF_KEYS.length];
        prismWalls(rec, house.footprint, WALL_HEIGHT, (a, b) => {
          const index = house.fronts.findIndex(
            (f) =>
              (near(f.a, a) && near(f.b, b)) || (near(f.a, b) && near(f.b, a)),
          );
          if (index < 0) return null;
          const f = house.fronts[index];
          if (Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y) < (f.kind === "chaflan" ? 14 : 26)) return null;
          if (f.kind === "chaflan") return CORNER_KEYS.length ? CORNER_KEYS[Math.floor(house.seed * 97) % CORNER_KEYS.length] : null;
          if (houseFacadeCount++ % 4 === 0) facadeLamps.push({ x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 + 3 });
          return FACADE_KEYS[(Math.floor(house.seed * FACADE_KEYS.length) + index * 5) % FACADE_KEYS.length];
        });
        const lift = (p: Point): Point => ({ x: p.x, y: p.y - WALL_HEIGHT - (onEdge(p, house.footprint) ? 0 : RIDGE_HEIGHT) });
        for (const face of house.roof) {
          const o = lift(face.origin);
          const matrix: PatternMatrix = [face.eave.x, face.eave.y, -face.eave.y, face.eave.x, o.x, o.y];
          const pts = face.pts.map(lift);
          rec.fillTexture(roofKey, matrix).fillPoints(pts);
          if (face.shade) rec.fillStyle(0x1a0f0a, 0.22).fillPoints(pts);
        }
        rec.lineStyle(2.5, COLORS.tinta, 0.85);
        for (const [a, b] of house.ridges) {
          const p = lift(a);
          const q = lift(b);
          rec.lineBetween(p.x, p.y, q.x, q.y);
        }
        rec.lineStyle(3, COLORS.tinta, 1).strokePoints(house.footprint.map((p) => ({ x: p.x, y: p.y - WALL_HEIGHT })), true);
      },
    });
  }
  landmarkJobs(rec, jobs);
  jobs.sort((p, q) => p.y - q.y);
  // Los edificios detrás de los cuales puede quedar un personaje no se hornean en el suelo:
  // se guardan aparte y se colocan como sprites ordenados por profundidad (placeOccluders).
  occluders.length = 0;
  for (const job of jobs) {
    const start = rec.ops.length;
    job.draw();
    if (job.always || (job.shape && canHidePlayer(job.shape, job.lift ?? 0, job.y))) {
      const own = new DrawRecorder();
      own.ops = rec.ops.splice(start);
      if (own.ops.length) occluders.push({ rec: own, baseY: job.y, box: unionBox(own.ops) });
    }
  }
  for (const bridge of bridges) drawBridge(rec, bridge, isIronBridge(bridge));
  for (const lamp of facadeLamps) {
    rec.glow(lamp.x, lamp.y + 6, 70, 0xffcf73, 0.22);
    decorItems.push({ key: "farola", x: lamp.x, y: lamp.y });
  }

  // Árboles en los patios interiores de las manzanas (lejos de calles y zonas)
  const treeRandom = seededRandom(23);
  for (const block of blocks) {
    const box = boundsOf(block);
    for (let y = box.y0 + 60; y < box.y1 - 30; y += 150) {
      for (let x = box.x0 + 60; x < box.x1 - 30; x += 160) {
        const tx = x + (treeRandom() - 0.5) * 70;
        const ty = y + (treeRandom() - 0.5) * 70;
        if (
          treeRandom() < 0.35 ||
          !pointInPolygon(tx, ty, block) ||
          inArea(tx, ty) ||
          nearestOnNetwork({ x: tx, y: ty }).distance < halfWidth + LOT_DEPTH + 26 ||
          // ni el tronco ni la copa (que sube unos 60 px) encima de las vías
          railLines.some((line) => Math.min(distToPolyline(tx, ty, line, false), distToPolyline(tx, ty - 60, line, false)) < RAIL_BED_WIDTH + 40)
        ) {
          continue;
        }
        decorItems.push({ key: treeRandom() < 0.6 ? "naranjo" : "olivo", x: tx, y: ty, flip: treeRandom() < 0.5 });
        if (treeRandom() < 0.5) decorItems.push({ key: "arbusto", x: tx + 34, y: ty + 10, flip: treeRandom() < 0.5 });
      }
    }
  }
  drawCountryside(rec, blocks, inArea);
  // Bruma en los bordes: el mapa se funde en la oscuridad en lugar de acabar en seco
  rec.edgeFade(WORLD_SIZE.width, WORLD_SIZE.height, 900, 0x120c10, 1);
  const fogRandom = seededRandom(77);
  const perimeter = [
    ...Array.from({ length: 18 }, (_, i) => ({ x: (i + fogRandom()) * (WORLD_SIZE.width / 18), y: 120 + fogRandom() * 260 })),
    ...Array.from({ length: 18 }, (_, i) => ({ x: (i + fogRandom()) * (WORLD_SIZE.width / 18), y: WORLD_SIZE.height - 120 - fogRandom() * 260 })),
    ...Array.from({ length: 18 }, (_, i) => ({ x: 120 + fogRandom() * 260, y: (i + fogRandom()) * (WORLD_SIZE.height / 18) })),
    ...Array.from({ length: 18 }, (_, i) => ({ x: WORLD_SIZE.width - 120 - fogRandom() * 260, y: (i + fogRandom()) * (WORLD_SIZE.height / 18) })),
  ];
  for (const p of perimeter) rec.glow(p.x, p.y, 220 + fogRandom() * 200, 0x8d8aa0, 0.28 + fogRandom() * 0.12);
  return rec;
}

/**
 * Campo alrededor del pueblo: olivares en hileras (lo típico de la campiña sevillana) y
 * matorral, horneados en el suelo (no cuestan nada por fotograma). Nunca encima de calles,
 * manzanas, zonas, río ni vías, para no tapar nada jugable.
 */
function drawCountryside(rec: DrawRecorder, blocks: Point[][], inArea: (x: number, y: number) => boolean): void {
  const random = seededRandom(91);
  const clear = (x: number, y: number) =>
    !blocks.some((b) => pointInPolygon(x, y, b) || pointInPolygon(x, y - 60, b)) &&
    !inArea(x, y) &&
    !inArea(x, y - 60) &&
    nearestOnNetwork({ x, y }).distance > STREET_HALF_WIDTH + 70 &&
    nearestOnNetwork({ x, y: y - 70 }).distance > STREET_HALF_WIDTH + 40 &&
    !riverLines.some((line) => distToPolyline(x, y, line, false) < RIVER_WIDTH + 70) &&
    !railLines.some((line) => Math.min(distToPolyline(x, y, line, false), distToPolyline(x, y - 60, line, false)) < RAIL_BED_WIDTH + 50);
  // Olivar: hileras al tresbolillo con huecos (fincas distintas)
  const dx = 118;
  const dy = 96;
  for (let row = 0, y = 60; y < WORLD_SIZE.height + 60; row++, y += dy) {
    for (let x = 40 + (row % 2) * (dx / 2); x < WORLD_SIZE.width + 60; x += dx) {
      // fincas: manchas sin olivos
      if (Math.sin(x * 0.0021 + 1.3) * Math.cos(y * 0.0017) > 0.55) continue;
      const tx = x + (random() - 0.5) * 18;
      const ty = y + (random() - 0.5) * 14;
      if (random() < 0.08 || !clear(tx, ty)) continue;
      const k = 0.78 + random() * 0.3;
      rec.fillStyle(COLORS.tinta, 0.22).fillEllipse(tx + 6, ty + 2, 58 * k, 18 * k);
      rec.image("olivo", tx, ty, 72 * k, 84 * k, 0.53, 0.93, random() < 0.5);
    }
  }
  // Matorral suelto entre las fincas
  for (let i = 0; i < 900; i++) {
    const x = random() * WORLD_SIZE.width;
    const y = random() * WORLD_SIZE.height;
    if (!clear(x, y)) continue;
    const k = 0.7 + random() * 0.5;
    rec.image("arbusto", x, y, 44 * k, 32 * k, 0.52, 0.84, random() < 0.5);
  }
}

/**
 * Río con vida: agua pintada (si hay textura), ondas que siguen la corriente, piedras y cañas
 * en las orillas. Todo horneado en el suelo.
 */
function drawRiverDetails(rec: DrawRecorder): void {
  const random = seededRandom(57);
  if (artCanvas("suelo-agua")) {
    for (const line of riverLines) rec.lineTexture(RIVER_WIDTH - 2, "suelo-agua").strokePoints(line, false);
    for (const line of riverLines) rec.lineStyle(RIVER_WIDTH * 0.25, COLORS.aguaClara, 0.18).strokePoints(line, false);
  }
  for (const line of riverLines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1) continue;
      const tx = (b.x - a.x) / len;
      const ty = (b.y - a.y) / len;
      const nx = -ty;
      const ny = tx;
      for (let d = random() * 30; d < len; d += 34 + random() * 30) {
        const px = a.x + tx * d;
        const py = a.y + ty * d;
        // Ondas: trazos cortos en la dirección de la corriente
        const off = (random() - 0.5) * RIVER_WIDTH * 0.6;
        rec.lineStyle(2.5, 0xe2f4f7, 0.75).lineBetween(px + nx * off, py + ny * off, px + nx * off + tx * 16, py + ny * off + ty * 16);
        // Orillas: piedras y matas a uno y otro lado
        for (const side of [-1, 1]) {
          const r = RIVER_WIDTH / 2 + 9 + random() * 6;
          const sx = px + nx * r * side;
          const sy = py + ny * r * side;
          const pick = random();
          if (pick < 0.35) {
            rec.fillStyle(COLORS.tinta, 0.8).fillEllipse(sx, sy + 1, 11, 7);
            rec.fillStyle(random() < 0.5 ? 0x9a948a : 0xb8ad98, 1).fillEllipse(sx, sy, 9, 5.5);
          } else if (pick < 0.5) {
            rec.image(artCanvas("canas") ? "canas" : "arbusto", sx, sy + 6, 30, 26, 0.5, 0.9, random() < 0.5);
          }
        }
      }
    }
  }
}

/** El puente es de hierro si el lugar más cercano lo dice en su nombre. */
function isIronBridge(bridge: Point): boolean {
  let nearest = { d: Infinity, name: "" };
  for (const poi of pointsOfInterest) {
    if (!poi.trace) continue;
    const p = traceToWorld(poi.trace);
    const d = Math.hypot(p.x - bridge.x, p.y - bridge.y);
    if (d < nearest.d) nearest = { d, name: poi.name };
  }
  return /hierro/i.test(nearest.name);
}

/**
 * Puente sobre el río en vista cenital con algo de alzado: estribos, cara frontal
 * (vigas y arcos de hierro, o bóvedas de piedra), tablero y pretiles.
 * Coordenadas locales: `along` a lo largo del puente, `across` de un pretil a otro.
 */
function drawBridge(rec: DrawRecorder, bridge: Parameters<typeof bridgeFrame>[0], iron: boolean): void {
  const { at, n: normal } = bridgeFrame(bridge);
  const halfDeck = BRIDGE.deck / 2;
  const half = BRIDGE.half;
  const abutment = BRIDGE.abutment;
  const drop = BRIDGE.drop;
  /** Lado del puente que mira hacia abajo en pantalla (se ve su cara frontal). */
  const side = normal.y >= 0 ? half : -half;
  const down = (p: Point, dy: number): Point => ({ x: p.x, y: p.y + dy });
  const mainColor = iron ? 0x7d776f : 0xb59a76;
  const darkColor = iron ? 0x4d4a46 : 0x8a7058;
  const ironDark = 0x2b2f33;
  /** Puntos a lo largo del puente, de `from` a `to`, a la distancia `across`. */
  const alongLine = (from: number, to: number, across: number, steps = 12) =>
    Array.from({ length: steps + 1 }, (_, i) => at(from + ((to - from) * i) / steps, across));
  /** Canto de las vigas de hierro. */
  const GIRDER = 12;

  rec.softShadow([at(-halfDeck, -half), at(halfDeck, -half), at(halfDeck, half), at(-halfDeck, half)], 12, 0.5, 8, drop + 4);

  // Estribos en las dos orillas
  for (const dir of [-1, 1]) {
    const pts = [
      at(dir * halfDeck, -half - 4),
      at(dir * (halfDeck + abutment), -half - 12),
      at(dir * (halfDeck + abutment), half + 12),
      at(dir * halfDeck, half + 4),
    ];
    rec.fillStyle(darkColor, 1).fillPoints(pts.map((p) => down(p, 12)));
    rec.lineStyle(2.5, COLORS.tinta, 1).strokePoints(
      pts.map((p) => down(p, 12)),
      true,
    );
    rec.fillStyle(mainColor, 1).fillPoints(pts);
    rec
      .fillTexture("suelo-losas")
      .fillPoints([at(dir * halfDeck, -half + 6), at(dir * (halfDeck + abutment), -half + 2), at(dir * (halfDeck + abutment), half - 2), at(dir * halfDeck, half - 6)]);
    rec.lineStyle(3, COLORS.tinta, 1).strokePoints(pts, true);
  }

  // Cara frontal
  const front = alongLine(-halfDeck, halfDeck, side, 24);
  const frontFace = [...front, ...front.slice().reverse().map((p) => down(p, drop))];
  rec.fillStyle(iron ? ironDark : darkColor, 1).fillPoints(frontFace);
  /** Arco (semielipse) entre `from` y `to` que sube `height` desde el agua. */
  const archPoints = (from: number, to: number, height: number) => {
    const pts: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const k = -1 + (2 * i) / 12;
      const along = (from + to) / 2 + ((to - from) / 2) * k;
      pts.push(down(at(along, side), drop - height * Math.sqrt(Math.max(0, 1 - k * k))));
    }
    return pts;
  };
  if (iron) {
    // Viga de celosía
    rec.fillStyle(0x3a3f44, 1).fillPoints([...front, ...front.slice().reverse().map((p) => down(p, GIRDER))]);
    rec.lineStyle(1.6, 0x7d8790, 0.8);
    for (let u = -halfDeck; u < halfDeck; u += 12) {
      const p = at(u, side);
      const q = at(Math.min(halfDeck, u + 12), side);
      rec.lineBetween(p.x, p.y + 1, q.x, q.y + GIRDER - 1).lineBetween(p.x, p.y + GIRDER - 1, q.x, q.y + 1);
    }
    rec.fillStyle(0x1b2930, 1).fillPoints([...front.map((p) => down(p, GIRDER)), ...front.slice().reverse().map((p) => down(p, drop))]);
    // Tres arcos con montantes
    for (const [from, to] of [
      [-halfDeck, -halfDeck / 3],
      [-halfDeck / 3, halfDeck / 3],
      [halfDeck / 3, halfDeck],
    ]) {
      const arch = archPoints(from, to, drop - GIRDER - 2);
      rec.lineStyle(4, COLORS.tinta, 1).strokePoints(arch, false);
      rec.lineStyle(2, 0x56606a, 1).strokePoints(arch, false);
      rec.lineStyle(1.2, 0x56606a, 1);
      for (let i = 2; i < arch.length - 2; i += 2) {
        const top = down(at((from + to) / 2 + ((to - from) / 2) * (-1 + (2 * i) / 12), side), GIRDER);
        rec.lineBetween(arch[i].x, arch[i].y, top.x, top.y);
      }
    }
    // Pilares
    for (const u of [-halfDeck / 3, halfDeck / 3]) {
      const p = at(u, side);
      rec.fillStyle(ironDark, 1).fillRect(p.x - 3.5, p.y + GIRDER, 7, drop - GIRDER + 4);
      rec.lineStyle(1.5, COLORS.tinta, 1).strokeRect(p.x - 3.5, p.y + GIRDER, 7, drop - GIRDER + 4);
    }
    rec.lineStyle(2.5, COLORS.tinta, 1).strokePoints(
      front.map((p) => down(p, GIRDER)),
      false,
    );
  } else {
    // Sillería de piedra con dos bóvedas
    rec.fillStyle(mainColor, 1).fillPoints(frontFace);
    rec.lineStyle(1.2, COLORS.tinta, 0.45);
    for (let u = 6; u < drop; u += 6) {
      const row = front.map((p) => down(p, u));
      rec.strokePoints(row, false);
    }
    for (let u = -halfDeck + 6, k = 0; u < halfDeck; u += 9, k++) {
      const p = down(at(u, side), 6 * (k % 4) + 1);
      rec.lineBetween(p.x, p.y, p.x, p.y + 5);
    }
    for (const [from, to] of [
      [-halfDeck + 8, -7],
      [7, halfDeck - 8],
    ]) {
      const arch = archPoints(from, to, drop - 6);
      rec.fillStyle(0x1b2930, 1).fillPoints(arch);
      rec.lineStyle(1.5, COLORS.aguaClara, 0.5).lineBetween(arch[2].x, arch[2].y - 3, arch[10].x, arch[10].y - 3);
      rec.lineStyle(3, COLORS.tinta, 1).strokePoints(arch, false);
      // Dovelas
      rec.lineStyle(1.2, COLORS.tinta, 0.6);
      for (let i = 1; i < arch.length - 1; i += 2) {
        const p = arch[i];
        const center = down(at((from + to) / 2, side), drop);
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        const length = Math.hypot(dx, dy) || 1;
        rec.lineBetween(p.x, p.y, p.x + (dx / length) * 6, p.y + (dy / length) * 6);
      }
    }
    // Tajamar central
    const cutwater = down(at(0, side), drop);
    rec.fillStyle(mainColor, 1).fillTriangle(cutwater.x - 8, cutwater.y - 2, cutwater.x + 8, cutwater.y - 2, cutwater.x, cutwater.y + 9);
    rec.lineStyle(2.5, COLORS.tinta, 1).strokePoints(
      [
        { x: cutwater.x - 8, y: cutwater.y - 2 },
        { x: cutwater.x, y: cutwater.y + 9 },
        { x: cutwater.x + 8, y: cutwater.y - 2 },
      ],
      false,
    );
  }
  // Ondas en el agua al pie de los apoyos
  for (const u of iron ? [-halfDeck / 3, halfDeck / 3] : [0]) {
    const p = down(at(u, side), drop + 3);
    rec.lineStyle(1.5, 0xe8f2f4, 0.7).strokeCircle(p.x, p.y, 6);
  }
  rec.lineStyle(3, COLORS.tinta, 1).strokePoints(frontFace, true);

  // Tablero
  const deck = [at(-halfDeck, -half), at(halfDeck, -half), at(halfDeck, half), at(-halfDeck, half)];
  rec.fillTexture(iron ? "suelo-asfalto" : "suelo-losas").fillPoints(deck);
  if (iron) {
    for (const across of [-half + 7, half - 7]) {
      const a = at(-halfDeck, across);
      const b = at(halfDeck, across);
      rec.lineStyle(5, COLORS.acera, 1).lineBetween(a.x, a.y, b.x, b.y);
    }
  }
  rec.lineStyle(3, COLORS.tinta, 1).strokePoints(deck, true);

  // Pretiles (barandilla de hierro o muro de piedra)
  const railHeight = iron ? 13 : 11;
  for (const edge of [-side, side]) {
    const inner = edge - Math.sign(edge) * 6;
    const rail = alongLine(-halfDeck, halfDeck, edge === side ? edge : inner, 12);
    if (iron) {
      const top = rail.map((p) => down(p, -railHeight));
      const bottom = rail.map((p) => down(p, -3));
      rec.lineStyle(4.5, COLORS.tinta, 1).strokePoints(top, false);
      rec.lineStyle(2.5, 0x4a535b, 1).strokePoints(top, false);
      rec.lineStyle(3, COLORS.tinta, 1).strokePoints(bottom, false);
      const posts = alongLine(-halfDeck, halfDeck, edge === side ? edge : inner, 16);
      rec.lineStyle(2, ironDark, 1);
      for (const p of posts) rec.lineBetween(p.x, p.y - 3, p.x, p.y - railHeight);
      for (let i = 0; i < posts.length - 1; i++) {
        const a = posts[i];
        const b = posts[i + 1];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - railHeight + 1;
        rec
          .lineStyle(1.4, ironDark, 1)
          .beginPath()
          .arc(mx, my, Math.hypot(b.x - a.x, b.y - a.y) / 2, 0, Math.PI, false)
          .strokePath();
      }
      // Machones de piedra en los extremos
      for (const along of [-halfDeck, halfDeck]) {
        const p = at(along, (edge + inner) / 2);
        rec.fillStyle(mainColor, 1).fillRect(p.x - 5, p.y - railHeight - 6, 10, railHeight + 8);
        rec.lineStyle(2, COLORS.tinta, 1).strokeRect(p.x - 5, p.y - railHeight - 6, 10, railHeight + 8);
        rec.fillStyle(COLORS.piedra, 1).fillRect(p.x - 6.5, p.y - railHeight - 9, 13, 4);
        rec.lineStyle(1.5, COLORS.tinta, 1).strokeRect(p.x - 6.5, p.y - railHeight - 9, 13, 4);
      }
    } else {
      const wall = [...rail, ...rail.slice().reverse().map((p) => down(p, -railHeight))];
      rec.fillStyle(edge === side ? darkColor : mainColor, 1).fillPoints(wall);
      rec.lineStyle(1, COLORS.tinta, 0.5);
      for (let i = 1; i < rail.length - 1; i++) {
        rec.lineBetween(rail[i].x, rail[i].y - (i % 2 ? 0 : railHeight / 2), rail[i].x, rail[i].y - (i % 2 ? railHeight / 2 : railHeight));
      }
      rec.strokePoints(
        rail.map((p) => down(p, -railHeight / 2)),
        false,
      );
      rec.lineStyle(2.5, COLORS.tinta, 1).strokePoints(wall, true);
      // Albardilla
      const coping = [...alongLine(-halfDeck - 2, halfDeck + 2, edge, 12), ...alongLine(-halfDeck - 2, halfDeck + 2, inner, 12).reverse()].map((p) =>
        down(p, -railHeight),
      );
      rec.fillStyle(COLORS.piedra, 1).fillPoints(coping);
      rec.lineStyle(2, COLORS.tinta, 1).strokePoints(coping, true);
    }
  }
  // Farolas en el pretil trasero
  for (const along of [-halfDeck + 4, halfDeck - 4]) {
    const p = at(along, -side - Math.sign(-side) * 4);
    rec.glow(p.x, p.y + 6, 70, 0xffcf73, 0.22);
    decorItems.push({ key: "farola", x: p.x, y: p.y });
  }
}

const near = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y) < 1;

/** ¿Está el punto sobre el contorno del polígono? (las cumbreras quedan dentro) */
function onEdge(p: Point, poly: Point[]): boolean {
  return distToPolyline(p.x, p.y, poly, true) < 0.6;
}

/**
 * Muros de un prisma de altura `height` sobre la huella: solo los lados que miran a la
 * cámara (normal hacia abajo). `facadeFor` da la imagen de fachada de un lado o null
 * para un muro encalado liso, más oscuro cuanto más mira a la derecha (luz de la izquierda).
 */
function prismWalls(rec: DrawRecorder, poly: Point[], height: number, facadeFor: (a: Point, b: Point) => string | null): void {
  const c = polygonCentroid(poly);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.5) continue;
    let n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (n.x * (m.x - c.x) + n.y * (m.y - c.y) < 0) n = { x: -n.x, y: -n.y };
    if (n.y <= 0.02) continue;
    const [l, r] = a.x <= b.x ? [a, b] : [b, a];
    const up = (p: Point) => ({ x: p.x, y: p.y - height });
    const key = facadeFor(a, b);
    if (key) {
      rec.imageQuad(key, up(l), up(r), l);
      rec.fillStyle(0x1a0f0a, Math.max(0, n.x) * 0.18).fillPoints([l, r, up(r), up(l)]);
    } else {
      rec.fillStyle(0xeee6d3, 1).fillPoints([l, r, up(r), up(l)]);
      rec.fillStyle(0xc9a24a, 0.85).fillPoints([l, r, { x: r.x, y: r.y - 6 }, { x: l.x, y: l.y - 6 }]);
      rec.fillStyle(0x1a0f0a, 0.06 + Math.max(0, n.x) * 0.2).fillPoints([l, r, up(r), up(l)]);
    }
    rec.lineStyle(2.5, COLORS.tinta, 0.9).strokePoints([l, r, up(r), up(l)], true);
  }
}

/** Tejado a cuatro aguas sobre un cuadrado (torres): caras hasta un vértice levantado. */
function pyramidRoof(rec: DrawRecorder, base: Point[], lift: number, apex: number): Point {
  const c = polygonCentroid(base);
  const top = { x: c.x, y: c.y - lift - apex };
  const raised = base.map((p) => ({ x: p.x, y: p.y - lift }));
  raised.forEach((p, i) => {
    const q = raised[(i + 1) % raised.length];
    const face = [p, q, top];
    const shadeAmount = (q.x - p.x) < 0 ? 0.28 : 0.05;
    rec.fillStyle(0xb35a3a, 1).fillPoints(face);
    rec.fillStyle(0x1a0f0a, shadeAmount).fillPoints(face);
    rec.lineStyle(2, COLORS.tinta, 0.9).strokePoints(face, true);
  });
  return top;
}

/**
 * Edificios singulares en 3/4, igual que las casas: sombra, muros visibles con sus fachadas
 * (lado largo o corto), tejado a dos aguas levantado y torres como prismas con su tejado.
 */
function landmarkJobs(rec: DrawRecorder, jobs: BuildingJob[]): void {
  for (const l of landmarks) {
    const H = LANDMARK_HEIGHT[l.kind];
    const [fl, fr, br, bl] = l.footprint;
    rec.softShadow(l.footprint, 16, 0.5, 12, 14);
    const y = Math.max(...l.footprint.map((p) => p.y));
    const longKey = `edificio-${l.kind}-largo`;
    const shortKey = `edificio-${l.kind}-corto`;
    jobs.push({
      y,
      always: true,
      draw: () => {
        prismWalls(rec, l.footprint, H, (a, b) => {
          const isLong = (near(a, fl) && near(b, fr)) || (near(a, fr) && near(b, fl)) || (near(a, br) && near(b, bl)) || (near(a, bl) && near(b, br));
          return isLong ? longKey : shortKey;
        });
        // Tejado a dos aguas con la cumbrera a lo largo de la calle
        const up = (p: Point, extra = 0) => ({ x: p.x, y: p.y - H - extra });
        const ml = { x: (fl.x + bl.x) / 2, y: (fl.y + bl.y) / 2 };
        const mr = { x: (fr.x + br.x) / 2, y: (fr.y + br.y) / 2 };
        const roofKey = ROOF_KEYS[l.poi % ROOF_KEYS.length];
        const o = up(fl);
        const front = [up(fl), up(fr), up(mr, 18), up(ml, 18)];
        const back = [up(ml, 18), up(mr, 18), up(br), up(bl)];
        rec.fillTexture(roofKey, [l.u.x, l.u.y, -l.u.y, l.u.x, o.x, o.y]).fillPoints(front);
        rec.fillTexture(roofKey, [l.u.x, l.u.y, -l.u.y, l.u.x, o.x, o.y]).fillPoints(back);
        rec.fillStyle(0x1a0f0a, 0.22).fillPoints(l.v.y > 0 ? front : back);
        const a = up(ml, 18);
        const b = up(mr, 18);
        rec.lineStyle(3, COLORS.tinta, 0.9).lineBetween(a.x, a.y, b.x, b.y);
        rec.lineStyle(3.5, COLORS.tinta, 1).strokePoints([up(fl), up(fr), up(br), up(bl)], true);
      },
    });
    // Torre: prisma cuadrado alineado con el edificio que sale por encima del tejado
    if (l.kind === "iglesia" || l.kind === "ayuntamiento") {
      const size = l.kind === "iglesia" ? 36 : 30;
      const tower = LANDMARK_ART[l.kind].torre;
      const height = l.kind === "iglesia" ? H + 70 : H + 44;
      const centre =
        l.kind === "iglesia"
          ? { x: fl.x + l.u.x * (size / 2 + 4) + l.v.x * (size / 2 + 4), y: fl.y + l.u.y * (size / 2 + 4) + l.v.y * (size / 2 + 4) }
          : l.center;
      const hu = { x: (l.u.x * size) / 2, y: (l.u.y * size) / 2 };
      const hv = { x: (l.v.x * size) / 2, y: (l.v.y * size) / 2 };
      const base = [
        { x: centre.x - hu.x - hv.x, y: centre.y - hu.y - hv.y },
        { x: centre.x + hu.x - hv.x, y: centre.y + hu.y - hv.y },
        { x: centre.x + hu.x + hv.x, y: centre.y + hu.y + hv.y },
        { x: centre.x - hu.x + hv.x, y: centre.y - hu.y + hv.y },
      ];
      jobs.push({
        y: y + 0.01,
        always: true,
        draw: () => {
          // Solo la parte que asoma por encima del tejado: el muro arranca a la altura del alero
          const raisedBase = base.map((p) => ({ x: p.x, y: p.y - H }));
          prismWalls(rec, raisedBase, height - H, () => `torre-${l.kind}-muro`);
          const top = pyramidRoof(rec, raisedBase, height - H, l.kind === "iglesia" ? 26 : 18);
          rec.lineStyle(2.6, COLORS.tinta, 1).lineBetween(top.x, top.y, top.x, top.y - (l.kind === "iglesia" ? 14 : 22));
          if (l.kind === "iglesia") rec.lineBetween(top.x - 5, top.y - 9, top.x + 5, top.y - 9);
          else {
            rec.fillStyle(0xc8402e, 1).fillRect(top.x + 1, top.y - 22, 16, 4);
            rec.fillStyle(0xe7c03a, 1).fillRect(top.x + 1, top.y - 18, 16, 4);
            rec.fillStyle(0xc8402e, 1).fillRect(top.x + 1, top.y - 14, 16, 4);
          }
          void tower;
        },
      });
    }
  }
}

/** Distancia de un punto a una polilínea (cerrada o no). */
function distToPolyline(x: number, y: number, pts: Point[], closed: boolean): number {
  let best = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
  }
  return best;
}

/** ¿Está el punto dentro del polígono o a menos de `margin` de su borde? */
const nearPolygon = (x: number, y: number, pts: Point[], margin: number) =>
  pointInPolygon(x, y, pts) || distToPolyline(x, y, pts, true) < margin;

/** Centroide (por área) de un polígono. */
function polygonCentroid(pts: Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return Math.abs(a) < 1e-9 ? pts[0] : { x: cx / (3 * a), y: cy / (3 * a) };
}

function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) a += pts[i].x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * pts[i].y;
  return Math.abs(a) / 2;
}

/** Polígono desplazado `d` px hacia dentro (d < 0: hacia fuera), con esquinas en inglete. */
function offsetPolygon(pts: Point[], d: number): Point[] {
  const n = pts.length;
  let signed = 0;
  for (let i = 0; i < n; i++) signed += pts[i].x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * pts[i].y;
  // Con y hacia abajo, área positiva = sentido horario en pantalla: el interior queda a la derecha.
  const side = signed > 0 ? 1 : -1;
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const nrm = { x: -dir.y * side, y: dir.x * side };
    return { p: { x: a.x + nrm.x * d, y: a.y + nrm.y * d }, dir, nrm };
  });
  return pts.map((v, i) => {
    const l0 = lines[(i - 1 + n) % n];
    const l1 = lines[i];
    const den = l0.dir.x * l1.dir.y - l0.dir.y * l1.dir.x;
    if (Math.abs(den) < 1e-6) return { x: v.x + l1.nrm.x * d, y: v.y + l1.nrm.y * d };
    const t = ((l1.p.x - l0.p.x) * l1.dir.y - (l1.p.y - l0.p.y) * l1.dir.x) / den;
    return { x: l0.p.x + l0.dir.x * t, y: l0.p.y + l0.dir.y * t };
  });
}

/** Punto del borde de la zona más cercano a una calle transitable (por donde se entra). */
function entryPoint(pts: Point[]): Point {
  let best = { p: pts[0], d: Infinity };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
    for (let s = 0; s <= steps; s++) {
      const p = { x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps };
      const d = nearestOnNetwork(p).distance;
      if (d < best.d) best = { p, d };
    }
  }
  return best.p;
}

/** Templete del parque (planta octogonal y tejado de cinc). */
function drawBandstand(rec: DrawRecorder, c: Point, r: number): void {
  const octagon = (cx: number, cy: number, radius: number, squash = 1) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius * squash };
    });
  rec.softShadow(octagon(c.x, c.y, r + 8), 12, 0.5, 8, 10);
  rec.fillStyle(COLORS.tinta, 1).fillPoints(octagon(c.x, c.y, r + 7));
  rec.fillTexture("suelo-losas").fillPoints(octagon(c.x, c.y, r + 4));
  // Columnas
  const base = octagon(c.x, c.y, r);
  rec.lineStyle(4, COLORS.tinta, 1);
  for (const p of base) rec.lineBetween(p.x, p.y, p.x, p.y - 20);
  rec.lineStyle(2, 0xe9e2d0, 1);
  for (const p of base) rec.lineBetween(p.x, p.y - 1, p.x, p.y - 19);
  // Tejado
  const roof = octagon(c.x, c.y - 24, r + 10, 0.92);
  rec.fillStyle(COLORS.tinta, 1).fillPoints(octagon(c.x, c.y - 24, r + 13, 0.92));
  rec.fillStyle(0x9aa3a6, 1).fillPoints(roof);
  rec.fillStyle(0x1a0f0a, 0.18).fillPoints([roof[0], roof[1], roof[2], { x: c.x, y: c.y - 30 }]);
  rec.lineStyle(1.5, COLORS.tinta, 0.8);
  for (const p of roof) rec.lineBetween(c.x, c.y - 30, p.x, p.y);
  rec.fillStyle(COLORS.tinta, 1).fillCircle(c.x, c.y - 31, 4);
  rec.fillStyle(0xd9b34a, 1).fillCircle(c.x, c.y - 32, 2.5);
}

/** Piscina municipal: recinto encalado, césped, vasos con playa de losas y vestuarios. */
function drawPool(rec: DrawRecorder, id: string, pts: Point[]): void {
  rec.lineStyle(16, COLORS.tinta, 1).strokePoints(pts, true);
  rec.lineStyle(10, 0xece4d2, 1).strokePoints(pts, true);
  rec.fillTexture("suelo-cesped").fillPoints(pts);
  const own = worldObstacles.filter((o) => o.area === id && o.pts);
  for (const o of own) {
    const shape = o.pts!;
    if (o.tipo === "vaso") {
      rec.fillStyle(COLORS.tinta, 0.9).fillPoints(offsetPolygon(shape, -17));
      rec.fillTexture("suelo-losas").fillPoints(offsetPolygon(shape, -14));
      rec.fillStyle(COLORS.tinta, 1).fillPoints(offsetPolygon(shape, -2.5));
      rec.fillStyle(0xf3efe6, 1).fillPoints(offsetPolygon(shape, -1));
      rec.fillStyle(0x2f9cc7, 1).fillPoints(offsetPolygon(shape, 1.5));
      rec.fillStyle(0x7fd3ec, 0.45).fillPoints(offsetPolygon(shape, 7));
      // Calles de nado a lo largo del lado largo
      const box = boundsOf(shape);
      const w = box.x1 - box.x0;
      const h = box.y1 - box.y0;
      if (w * h > 8000) {
        const lanes = 5;
        rec.lineStyle(2, 0x1d6f93, 0.7);
        for (let i = 1; i < lanes; i++) {
          if (h >= w) {
            const x = box.x0 + (w * i) / lanes;
            rec.lineBetween(x, box.y0 + 10, x, box.y1 - 10);
          } else {
            const y = box.y0 + (h * i) / lanes;
            rec.lineBetween(box.x0 + 10, y, box.x1 - 10, y);
          }
        }
        // Corcheras de colores en los extremos y escalerillas
        rec.lineStyle(2.5, 0xffffff, 0.9);
        for (const [x, y] of [
          [box.x0 + 6, box.y0 + 8],
          [box.x1 - 6, box.y1 - 8],
        ]) {
          rec.lineBetween(x - 3, y - 4, x - 3, y + 4).lineBetween(x + 3, y - 4, x + 3, y + 4);
        }
      }
    } else if (o.tipo === "edificio") {
      rec.softShadow(shape, 12, 0.5, 8, 10);
      rec.fillStyle(COLORS.tinta, 1).fillPoints(offsetPolygon(shape, -3));
      rec.fillTexture(ROOF_KEYS[0]).fillPoints(shape);
      const box = boundsOf(shape);
      rec.lineStyle(2.5, COLORS.tinta, 0.85).lineBetween(box.x0 + 4, (box.y0 + box.y1) / 2, box.x1 - 4, (box.y0 + box.y1) / 2);
    }
  }
  // Árboles de sombra junto a la tapia, lejos de los vasos y de la entrada
  const random = seededRandom(31);
  const inner = offsetPolygon(pts, 26);
  const trees: Point[] = [];
  for (let attempt = 0; attempt < 300 && trees.length < 14; attempt++) {
    const i = Math.floor(random() * inner.length);
    const a = inner[i];
    const b = inner[(i + 1) % inner.length];
    const t = random();
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (
      !pointInPolygon(p.x, p.y, pts) ||
      own.some((o) => nearPolygon(p.x, p.y, o.pts!, 48)) ||
      nearestOnNetwork(p).distance < STREET_HALF_WIDTH + 40 ||
      trees.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 50)
    ) {
      continue;
    }
    trees.push(p);
  }
  trees.forEach((t, i) => decorItems.push({ key: i % 3 ? "olivo" : "naranjo", x: t.x, y: t.y, flip: i % 2 === 0, size: 0.85 }));
}

/** Zonas especiales: plazas (círculos), entradas, campo de deportes, piscina y parques. */
function drawAreas(rec: DrawRecorder): void {
  const parkRandom = seededRandom(11);
  const nearObstacle = (x: number, y: number, margin: number) =>
    worldObstacles.some((o) => (o.pts ? nearPolygon(x, y, o.pts, margin) : Math.hypot(x - o.c.x, y - o.c.y) < o.r + margin));
  for (const area of worldAreas) {
    const def = AREAS.find((a) => a.id === area.id)!;
    const courts = (def.pistas ?? []).map((court) => ({
      tipo: court.tipo,
      pts: courtPolygon(court).map(([x, y]) => traceToWorld({ x, y })),
    }));
    const inCourt = (x: number, y: number, margin = 0) => courts.some((c) => nearPolygon(x, y, c.pts, margin));

    if (area.kind === "circulo") {
      // Plaza redonda con anillos de losas y árboles alrededor
      rec.fillStyle(COLORS.tinta, 1).fillCircle(area.c.x, area.c.y, area.r + 6);
      rec.fillStyle(COLORS.piedraOscura, 1).fillCircle(area.c.x, area.c.y, area.r + 3);
      rec.fillTexture("suelo-losas").fillCircle(area.c.x, area.c.y, area.r);
      if (def.tipo !== "entrada") {
        rec.lineStyle(3, COLORS.piedraOscura, 0.6);
        for (let r = 26; r < area.r - 10; r += 26) rec.strokeCircle(area.c.x, area.c.y, r);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + 0.5;
          decorItems.push({
            key: i % 3 === 1 ? "buganvilla" : "naranjo",
            x: area.c.x + Math.cos(angle) * (area.r - 22),
            y: area.c.y + Math.sin(angle) * (area.r - 22),
            size: 0.8,
            flip: i % 2 === 0,
          });
        }
      }
      continue;
    }

    if (def.tipo === "entrada") {
      rec.fillStyle(COLORS.albero, 1).fillPoints(area.pts);
      rec.lineStyle(2.5, COLORS.tinta, 0.6).strokePoints(area.pts, true);
      continue;
    }
    if (def.tipo === "campo") {
      rec.fillTexture("suelo-cesped").fillPoints(area.pts);
      rec.fillStyle(0x24501f, 0.25).fillPoints(area.pts);
      for (const court of courts) drawCourt(rec, court.tipo, court.pts);
      rec.lineStyle(4, COLORS.tinta, 1).strokePoints(area.pts, true);
      continue;
    }
    if (def.tipo === "piscina") {
      drawPool(rec, def.id, area.pts);
      continue;
    }

    // Parque: seto, césped, paseo de albero que sigue la forma y camino desde la entrada
    rec.lineStyle(20, COLORS.tinta, 1).strokePoints(area.pts, true);
    rec.lineStyle(15, COLORS.cespedOscuro, 1).strokePoints(area.pts, true);
    rec.fillTexture("suelo-cesped").fillPoints(area.pts);
    const center = polygonCentroid(area.pts);
    const ring = offsetPolygon(area.pts, 34);
    const ringOk = polygonArea(ring) > 4000 && ring.every((p) => pointInPolygon(p.x, p.y, area.pts));
    const entry = entryPoint(area.pts);
    const walk: Point[][] = [[entry, center]];
    if (ringOk) {
      rec.lineStyle(17, COLORS.tinta, 0.45).strokePoints(ring, true);
      rec.lineStyle(13, COLORS.albero, 1).strokePoints(ring, true);
    }
    rec.lineStyle(15, COLORS.tinta, 0.45).lineBetween(entry.x, entry.y, center.x, center.y);
    rec.lineStyle(11, COLORS.albero, 1).lineBetween(entry.x, entry.y, center.x, center.y);
    rec.fillStyle(COLORS.tinta, 0.45).fillCircle(center.x, center.y, 20);
    rec.fillTexture("suelo-losas").fillCircle(center.x, center.y, 17);
    for (const court of courts) drawCourt(rec, court.tipo, court.pts);
    for (const obstacle of worldObstacles) {
      if (obstacle.area !== def.id) continue;
      if (obstacle.tipo === "banco") {
        decorItems.push({ key: "banco", x: obstacle.c.x, y: obstacle.c.y + 6 });
        decorItems.push({ key: "papelera", x: obstacle.c.x + 34, y: obstacle.c.y + 4 });
      } else if (obstacle.tipo === "templete") {
        drawBandstand(rec, obstacle.c, obstacle.r);
      }
    }
    for (const pond of worldObstacles) {
      if (pond.area !== def.id || pond.tipo !== "estanque") continue;
      // Estanque con borde de losas, peces y nenúfares
      rec.fillStyle(COLORS.tinta, 1).fillCircle(pond.c.x, pond.c.y, pond.r + 9);
      rec.fillTexture("suelo-losas").fillCircle(pond.c.x, pond.c.y, pond.r + 6);
      rec.fillStyle(COLORS.tinta, 1).fillCircle(pond.c.x, pond.c.y, pond.r + 1.5);
      rec.fillStyle(COLORS.agua, 1).fillCircle(pond.c.x, pond.c.y, pond.r);
      rec.fillStyle(COLORS.aguaClara, 0.6).fillCircle(pond.c.x - pond.r * 0.3, pond.c.y - pond.r * 0.3, pond.r * 0.35);
      for (let i = 0; i < 5; i++) {
        const angle = i * 1.3 + 0.4;
        rec.fillStyle(0xf08a24, 1).fillEllipse(pond.c.x + Math.cos(angle) * pond.r * 0.55, pond.c.y + Math.sin(angle) * pond.r * 0.55, 9, 5);
      }
      rec
        .fillStyle(0x6fae4a, 1)
        .fillCircle(pond.c.x + pond.r * 0.5, pond.c.y - pond.r * 0.4, 5)
        .fillCircle(pond.c.x - pond.r * 0.6, pond.c.y + pond.r * 0.3, 4);
    }

    // Árboles: dentro, lejos del seto, paseos, pistas, obstáculos y calles; separados entre sí
    const box = boundsOf(area.pts);
    const maxTrees = Math.min(30, Math.round(polygonArea(area.pts) / 8000));
    const trees: Point[] = [];
    for (let attempt = 0; attempt < 900 && trees.length < maxTrees; attempt++) {
      const x = box.x0 + parkRandom() * (box.x1 - box.x0);
      const y = box.y0 + parkRandom() * (box.y1 - box.y0);
      if (
        !pointInPolygon(x, y, area.pts) ||
        distToPolyline(x, y, area.pts, true) < 18 ||
        (ringOk && distToPolyline(x, y, ring, true) < 20) ||
        walk.some((w) => distToPolyline(x, y, w, false) < 20) ||
        Math.hypot(x - center.x, y - center.y) < 36 ||
        inCourt(x, y, 18) ||
        nearObstacle(x, y, 34) ||
        nearestOnNetwork({ x, y }).distance < STREET_HALF_WIDTH + 24 ||
        trees.some((t) => Math.hypot(t.x - x, t.y - y) < 46)
      ) {
        continue;
      }
      trees.push({ x, y });
    }
    trees.forEach((t, i) =>
      decorItems.push({ key: i % 4 === 3 ? "arbusto" : i % 3 ? "olivo" : "naranjo", x: t.x, y: t.y, flip: i % 2 === 0, size: 0.85 }),
    );
  }
}

/** Vías del tren: banqueta de balasto, traviesas y carriles. */
function drawRailways(rec: DrawRecorder): void {
  const GAUGE = 7;
  const offsetLine = (line: Point[], d: number) =>
    line.map((p, i) => {
      const a = line[Math.max(0, i - 1)];
      const b = line[Math.min(line.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d };
    });
  // Balasto de todas las vías primero (así los empalmes quedan limpios)
  for (const line of railLines) rec.lineStyle(RAIL_BED_WIDTH + 6, COLORS.tinta, 0.55).strokePoints(line, false);
  for (const line of railLines) rec.lineStyle(RAIL_BED_WIDTH, 0x8d857a, 1).strokePoints(line, false);
  for (const line of railLines) rec.lineStyle(RAIL_BED_WIDTH - 12, 0x9f978b, 1).strokePoints(line, false);
  // Traviesas cada 11 px
  rec.lineStyle(4, 0x5e4330, 1);
  for (const line of railLines) {
    let carry = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      let s = carry;
      for (; s < len; s += 11) {
        const x = a.x + ux * s;
        const y = a.y + uy * s;
        rec.lineBetween(x + uy * 11, y - ux * 11, x - uy * 11, y + ux * 11);
      }
      carry = s - len;
    }
  }
  // Carriles
  for (const line of railLines) {
    for (const side of [-GAUGE, GAUGE]) {
      const rail = offsetLine(line, side);
      rec.lineStyle(3.5, 0x2e2a27, 1).strokePoints(rail, false);
      rec.lineStyle(1.5, 0xc9ccd0, 1).strokePoints(rail, false);
    }
  }
  // Topera al final de la vía de la estación (la captura no muestra más allá)
  const end = railLines[1];
  if (end.length > 1) {
    const a = end[0];
    const b = end[1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const p = { x: a.x + ux * 10, y: a.y + uy * 10 };
    const nx = -uy * 13;
    const ny = ux * 13;
    rec.lineStyle(9, COLORS.tinta, 1).lineBetween(p.x - nx, p.y - ny, p.x + nx, p.y + ny);
    rec.lineStyle(6, 0xc8402e, 1).lineBetween(p.x - nx, p.y - ny, p.x + nx, p.y + ny);
    rec.lineStyle(6, 0xf1ece0, 1).lineBetween(p.x - nx * 0.33, p.y - ny * 0.33, p.x + nx * 0.33, p.y + ny * 0.33);
  }
}

/** Pasos a nivel: los carriles se ven sobre el asfalto, con líneas de detención. */
function drawLevelCrossings(rec: DrawRecorder): void {
  const GAUGE = 7;
  for (const c of levelCrossings) {
    const ux = Math.cos(c.railAngle);
    const uy = Math.sin(c.railAngle);
    const half = STREET_HALF_WIDTH + 6;
    for (const side of [-GAUGE, GAUGE]) {
      const ox = -uy * side;
      const oy = ux * side;
      rec.lineStyle(3.5, 0x2e2a27, 1).lineBetween(c.x + ox - ux * half, c.y + oy - uy * half, c.x + ox + ux * half, c.y + oy + uy * half);
      rec.lineStyle(1.5, 0xc9ccd0, 1).lineBetween(c.x + ox - ux * half, c.y + oy - uy * half, c.x + ox + ux * half, c.y + oy + uy * half);
    }
    // Líneas de detención a ambos lados de la vía, a lo ancho de la calle
    const sx = Math.cos(c.streetAngle);
    const sy = Math.sin(c.streetAngle);
    rec.lineStyle(3, 0xf1ece0, 0.9);
    for (const k of [-1, 1]) {
      const cx = c.x + sx * k * 22;
      const cy = c.y + sy * k * 22;
      rec.lineBetween(cx - sy * (half - 8), cy + sx * (half - 8), cx + sy * (half - 8), cy - sx * (half - 8));
    }
  }
}

/** Trozo horneado en una textura. */
interface BakedChunk {
  img: Phaser.GameObjects.Image;
  tex: string;
  /** Último fotograma en que se necesitó (para reciclar los más antiguos). */
  used: number;
}

/** Trozo en preparación: su canvas se va dibujando poco a poco. */
interface PendingChunk {
  key: string;
  cx: number;
  cy: number;
  /** px de textura por px de mundo. */
  resolution: number;
  /** Margen (px de mundo) alrededor del trozo para que no se vean costuras. */
  margin: number;
  canvas: HTMLCanvasElement;
  job: ReturnType<DrawRecorder["job"]>;
  ms: number;
  t0: number;
}

/**
 * Hornea el mapa grabado en texturas por trozos. Solo existen los trozos cercanos
 * a la cámara: los visibles se hornean al momento y uno de los cercanos se va
 * preparando en segundo plano con un presupuesto de tiempo por fotograma.
 */
export class TownRenderer {
  /** px de mundo por trozo. */
  static CHUNK = 1024;
  static MAX_CHUNKS = 16;
  /** ms por fotograma para preparar el trozo pendiente. */
  static BUDGET_MS = 4;

  private vector: DrawRecorder;
  private chunks = new Map<string, BakedChunk>();
  private frame = 0;
  private serial = 0;
  private pending: PendingChunk | null = null;
  /** Duración (ms) de los últimos horneados (se muestran en pruebas). */
  bakeTimes: number[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.vector = buildTownDrawing();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Asegura que los trozos visibles (más un margen) están horneados. */
  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.frame++;
    const size = TownRenderer.CHUNK;
    const view = camera.worldView;
    const cx0 = Math.max(0, Math.floor((view.x - size / 2) / size));
    const cy0 = Math.max(0, Math.floor((view.y - size / 2) / size));
    const cx1 = Math.min(Math.ceil(WORLD_SIZE.width / size) - 1, Math.floor((view.right + size / 2) / size));
    const cy1 = Math.min(Math.ceil(WORLD_SIZE.height / size) - 1, Math.floor((view.bottom + size / 2) / size));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = `${cx},${cy}`;
        const chunk = this.chunks.get(key);
        if (chunk) {
          chunk.used = this.frame;
          continue;
        }
        const visible = (cx + 1) * size > view.x && cx * size < view.right && (cy + 1) * size > view.y && cy * size < view.bottom;
        if (visible) this.finish(this.start(cx, cy, key, camera.zoom));
        else if (!this.pending) this.pending = this.start(cx, cy, key, camera.zoom);
      }
    }
    if (this.pending && this.pending.job.step(TownRenderer.BUDGET_MS)) {
      const done = this.pending;
      this.pending = null;
      this.finish(done);
    }
    if (this.chunks.size > TownRenderer.MAX_CHUNKS) {
      const oldest = [...this.chunks.entries()].sort((a, b) => a[1].used - b[1].used);
      for (const [key] of oldest.slice(0, this.chunks.size - TownRenderer.MAX_CHUNKS)) this.drop(key);
    }
  }

  get chunkCount(): number {
    return this.chunks.size;
  }

  /** Prepara el canvas de un trozo (o recupera el pendiente si es el mismo). */
  private start(cx: number, cy: number, key: string, zoom: number): PendingChunk {
    if (this.pending?.key === key) {
      const pending = this.pending;
      this.pending = null;
      return pending;
    }
    const size = TownRenderer.CHUNK;
    const resolution = Phaser.Math.Clamp(zoom * Math.min(window.devicePixelRatio || 1, 1.5), 0.5, 1);
    const margin = 2;
    const px = Math.ceil((size + 2 * margin) * resolution);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(resolution, 0, 0, resolution, -(cx * size - margin) * resolution, -(cy * size - margin) * resolution);
    const job = this.vector.job(ctx, { x0: cx * size - margin, y0: cy * size - margin, x1: (cx + 1) * size + margin, y1: (cy + 1) * size + margin });
    return { key, cx, cy, resolution, margin, canvas, job, ms: 0, t0: performance.now() };
  }

  /** Termina de dibujar el trozo y lo convierte en imagen. */
  private finish(pending: PendingChunk): void {
    const t0 = performance.now();
    pending.job.step(Infinity);
    const size = TownRenderer.CHUNK;
    const tex = `trozo-${this.serial++}`;
    this.scene.textures.addCanvas(tex, pending.canvas);
    const img = this.scene.add
      .image(pending.cx * size - pending.margin, pending.cy * size - pending.margin, tex)
      .setOrigin(0)
      .setScale(1 / pending.resolution)
      .setDepth(0);
    this.chunks.set(pending.key, { img, tex, used: this.frame });
    this.bakeTimes.push(performance.now() - t0);
    if (this.bakeTimes.length > 50) this.bakeTimes.shift();
  }

  private drop(key: string): void {
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.img.destroy();
      this.scene.textures.remove(chunk.tex);
      this.chunks.delete(key);
    }
  }

  destroy(): void {
    for (const key of [...this.chunks.keys()]) this.drop(key);
  }
}

/**
 * Coloca como sprites los edificios que pueden tapar a un personaje (ver canHidePlayer).
 * Cada uno se pinta una vez en su propio lienzo y se ordena por la base, como los árboles.
 */
export function placeOccluders(scene: Phaser.Scene): { image: Phaser.GameObjects.Image; baseY: number }[] {
  const res = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  return occluders.map((o, i) => {
    const pad = 4;
    const x0 = Math.floor(o.box.x0 - pad);
    const y0 = Math.floor(o.box.y0 - pad);
    const w = Math.ceil(o.box.x1 + pad) - x0;
    const h = Math.ceil(o.box.y1 + pad) - y0;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w * res);
    canvas.height = Math.ceil(h * res);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    o.rec.job(ctx, { x0, y0, x1: x0 + w, y1: y0 + h }).step(Infinity);
    const key = `edificio-sprite-${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    const image = scene.add.image(x0, y0, key).setOrigin(0).setScale(1 / res).setDepth(20 + o.baseY / 1e5);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.textures.exists(key) && scene.textures.remove(key));
    return { image, baseY: o.baseY };
  });
}

/** Coloca la decoración reunida al grabar el mapa (y las estatuas). Devuelve los sprites. */
export function placeDecor(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const objects: Phaser.GameObjects.Image[] = [];
  for (const item of decorItems) {
    const obj = addProp(scene, item.key, item.x, item.y, item.size ?? 1)
      .setFlipX(!!item.flip)
      .setDepth(20 + item.y / 1e5);
    objects.push(obj);
  }
  for (const obstacle of worldObstacles) {
    if (obstacle.tipo === "estatua") objects.push(addProp(scene, "estatua", obstacle.c.x, obstacle.c.y + 10, 1).setDepth(20 + (obstacle.c.y + 10) / 1e5));
  }
  return objects;
}
