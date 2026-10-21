import { describe, expect, it } from "vitest";
import { findPath } from "../shared/map/pathfinding";
import { PLAYER_RADIUS, PLAYER_SPEED } from "../shared/net/protocol";
import { accessPoint, defaultSpawn, isWalkable, segmentWalkable, traceToWorld, validateMove } from "../shared/map/townMap";
import { pointsOfInterest } from "../shared/data/pointsOfInterest";

/** Recorre una ruta con pasos legales de 50 ms, como haría un jugador. */
export function walk(path: { x: number; y: number }[], from: { x: number; y: number }) {
  let p = from;
  let steps = 0;
  for (const target of path) {
    for (let i = 0; i < 2000 && Math.hypot(target.x - p.x, target.y - p.y) > 1; i++) {
      const d = Math.hypot(target.x - p.x, target.y - p.y);
      const k = Math.min(1, (PLAYER_SPEED * 0.05) / d);
      const r = validateMove(p, { x: p.x + (target.x - p.x) * k, y: p.y + (target.y - p.y) * k }, 50, PLAYER_SPEED, PLAYER_RADIUS);
      if (!r.accepted) return { ok: false, at: p, steps };
      p = r.position;
      steps++;
    }
  }
  return { ok: true, at: p, steps };
}

describe("rutas por las calles", () => {
  const spawn = defaultSpawn();
  const targets = pointsOfInterest.filter((p) => p.trace).map((p) => ({ n: p.number, w: accessPoint(traceToWorld(p.trace!), PLAYER_RADIUS) }));

  it("hay ruta desde el inicio hasta cada lugar y se puede recorrer andando sin trampas", () => {
    for (const t of targets) {
      const { points, length } = findPath(spawn, t.w);
      expect(Number.isFinite(length), `lugar ${t.n}`).toBe(true);
      for (let i = 1; i < points.length; i++) expect(segmentWalkable(points[i - 1], points[i], PLAYER_RADIUS - 2), `lugar ${t.n} tramo ${i}`).toBe(true);
      const r = walk(points, spawn);
      expect(r.ok, `lugar ${t.n}`).toBe(true);
      expect(Math.hypot(r.at.x - t.w.x, r.at.y - t.w.y)).toBeLessThan(2);
    }
  });

  it("la ruta por calles nunca es más corta que la línea recta", () => {
    for (const t of targets) {
      const { length } = findPath(spawn, t.w);
      expect(length + 1).toBeGreaterThanOrEqual(Math.hypot(t.w.x - spawn.x, t.w.y - spawn.y) - 2 * 45);
    }
  });

  it("ida y vuelta miden lo mismo", () => {
    const a = targets[0].w, b = targets[10].w;
    expect(findPath(a, b).length).toBeCloseTo(findPath(b, a).length, 0);
    expect(isWalkable(a, PLAYER_RADIUS)).toBe(true);
  });
});
