import { describe, expect, it } from "vitest";
import { placeHouses, BRIDGE, type House } from "../shared/map/houses";
import { RIVER_WIDTH, bridges } from "../shared/map/river";
import { AREAS, courtPolygon } from "../shared/map/places";
import { RAIL_BED_WIDTH, levelCrossings, railLines } from "../shared/map/railway";
import { defaultSpawn, isWalkable, nearestOnNetwork, traceToWorld, worldAreas, type Vec2 } from "../shared/map/townMap";
import { findPath } from "../shared/map/pathfinding";

const houses = placeHouses();

/** Solape de polígonos convexos por ejes separadores (con 0,5 px de tolerancia). */
function overlap(p: Vec2[], q: Vec2[]): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ax = { x: -(b.y - a.y), y: b.x - a.x };
      const proj = (pts: Vec2[]) => pts.map((v) => v.x * ax.x + v.y * ax.y);
      const pp = proj(p);
      const qq = proj(q);
      const len = Math.hypot(ax.x, ax.y);
      if (Math.max(...pp) <= Math.min(...qq) + 0.5 * len || Math.max(...qq) <= Math.min(...pp) + 0.5 * len) return false;
    }
  }
  return true;
}

describe("casas", () => {
  it("se colocan muchas casas, de hilera y de esquina", () => {
    expect(houses.length).toBeGreaterThan(300);
    expect(houses.some((h) => h.kind === "esquina")).toBe(true);
    expect(houses.some((h) => h.kind === "hilera")).toBe(true);
  });

  it("ninguna huella se solapa con otra", () => {
    const bad: [number, number][] = [];
    for (let i = 0; i < houses.length; i++) {
      for (let j = i + 1; j < houses.length; j++) {
        const a = houses[i];
        const b = houses[j];
        if (Math.hypot(a.mid.x - b.mid.x, a.mid.y - b.mid.y) > 250) continue;
        if (overlap(a.footprint, b.footprint)) bad.push([a.id, b.id]);
      }
    }
    expect(bad).toEqual([]);
  });

  it("ninguna casa pisa una calle ni una zona transitable", () => {
    const onWalkable = (h: House) => h.footprint.some((p) => isWalkable(p) && nearestOnNetwork(p).distance < 20);
    expect(houses.filter(onWalkable).map((h) => h.id)).toEqual([]);
  });

  it("es determinista (el pueblo es siempre el mismo)", () => {
    expect(JSON.stringify(placeHouses())).toBe(JSON.stringify(houses));
  });
});

describe("río y puentes", () => {
  it("hay dos puentes (Erillas y Hierro) y son largos", () => {
    expect(bridges.length).toBe(2);
    expect(BRIDGE.deck).toBeGreaterThanOrEqual(RIVER_WIDTH * 4);
  });
});

describe("zonas extra (plazas, parques, campo)", () => {
  it("se puede llegar andando al centro de cada zona", () => {
    const start = defaultSpawn();
    for (const a of worldAreas) {
      const c: Vec2 = a.kind === "circulo" ? a.c : { x: a.pts.reduce((s, p) => s + p.x, 0) / a.pts.length, y: a.pts.reduce((s, p) => s + p.y, 0) / a.pts.length };
      const path = findPath(start, c);
      expect(Number.isFinite(path.length), a.id).toBe(true);
    }
  });

  it("cada zona está unida a la red de calles", () => {
    for (const area of AREAS) {
      const pts = "circulo" in area.forma ? [area.forma.circulo] : area.forma.poligono.map(([x, y]) => ({ x, y }));
      const near = Math.min(...pts.map((p) => nearestOnNetwork(traceToWorld(p)).distance));
      expect(near, area.id).toBeLessThan(200);
    }
  });
});

describe("sitios marcados en las capturas de satélite (piscina, parques, vías)", () => {
  const W = (x: number, y: number) => traceToWorld({ x, y });

  it("en la piscina se anda por la playa y el césped, pero no por el agua ni por los vestuarios", () => {
    expect(isWalkable(W(424, 303), 8)).toBe(false); // vaso grande
    expect(isWalkable(W(392, 293), 8)).toBe(false); // piscina pequeña
    expect(isWalkable(W(393, 331), 8)).toBe(false); // vestuarios
    expect(isWalkable(W(445, 330), 8)).toBe(true); // césped
    expect(isWalkable(W(405, 303), 8)).toBe(true); // playa junto al vaso
    const path = findPath(defaultSpawn(), W(445, 330));
    expect(Number.isFinite(path.length)).toBe(true);
  });

  it("las pistas del Parque Europa y los obstáculos de cada parque quedan dentro de su parque", () => {
    for (const area of AREAS) {
      if (!("poligono" in area.forma)) continue;
      const poly = area.forma.poligono.map(([x, y]) => W(x, y));
      const inside = (p: Vec2) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i];
          const b = poly[j];
          if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
        }
        return c;
      };
      for (const court of area.pistas ?? []) {
        for (const [x, y] of courtPolygon(court)) expect(inside(W(x, y)), `${area.id} ${court.tipo}`).toBe(true);
      }
      for (const o of area.obstaculos) expect(inside(W(o.x, o.y)), `${area.id} ${o.tipo}`).toBe(true);
    }
  });

  it("ninguna casa pisa las vías del tren", () => {
    const segs = railLines.flatMap((l) => l.slice(1).map((b, i) => [l[i], b] as const));
    const dist = (p: Vec2, a: Vec2, b: Vec2) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    };
    const near = houses.filter((h) => h.footprint.some((p) => segs.some(([a, b]) => dist(p, a, b) < RAIL_BED_WIDTH / 2)));
    expect(near.map((h) => h.id)).toEqual([]);
  });

  it("la vía de la estación cruza la avenida con un paso a nivel", () => {
    expect(levelCrossings.length).toBeGreaterThanOrEqual(1);
  });
});
