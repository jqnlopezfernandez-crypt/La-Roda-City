import { describe, expect, it } from "vitest";
import {
  MAP_SCALE,
  STREET_HALF_WIDTH,
  WORLD_MARGIN,
  accessPoint,
  cityBlocks,
  clampToStreets,
  defaultSpawn,
  extractionReport,
  isWalkable,
  moveAlongStreets,
  nearestOnNetwork,
  streetEdges,
  streetNodes,
  traceToWorld,
  worldToTrace,
} from "../shared/map/townMap";
import { pointsOfInterest } from "../shared/data/pointsOfInterest";

const PLAYER_RADIUS = 10;

describe("fidelidad al trazado", () => {
  it("la extracción cubre todo el trazo y no se sale de él", () => {
    expect(extractionReport.piezas_conectadas).toBe(1);
    expect(extractionReport.zonas_de_trazo_sin_calle).toBe(0);
    expect(extractionReport.linea_central_fuera_del_trazo_max).toBeLessThanOrEqual(2);
  });

  it("la conversión trazado ↔ mundo es una escala uniforme sin giro", () => {
    const p = { x: 123.4, y: 567.8 };
    const w = traceToWorld(p);
    expect(w.x).toBeCloseTo(p.x * MAP_SCALE + WORLD_MARGIN);
    expect(w.y).toBeCloseTo(p.y * MAP_SCALE + WORLD_MARGIN);
    const back = worldToTrace(w);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });

  it("todas las calles forman una única red conectada", () => {
    const adj = new Map<number, number[]>();
    for (const e of streetEdges) {
      adj.set(e.a, [...(adj.get(e.a) ?? []), e.b]);
      adj.set(e.b, [...(adj.get(e.b) ?? []), e.a]);
    }
    const seen = new Set<number>([streetNodes[0].id]);
    const stack = [streetNodes[0].id];
    while (stack.length) for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
    expect(seen.size).toBe(streetNodes.length);
  });

  it("cada punto de cada calle es transitable", () => {
    for (const e of streetEdges)
      for (const [x, y] of e.points) expect(isWalkable(traceToWorld({ x, y }), PLAYER_RADIUS)).toBe(true);
  });
});

describe("manzanas", () => {
  /** Punto interior más alejado del borde (muestreo), en píxeles del trazado. */
  function deepInside(poly: [number, number][]) {
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    let best = { x: 0, y: 0, d: -1 };
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2)
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2) {
        if (!inside(x, y)) continue;
        let d = Infinity;
        for (let i = 0; i < poly.length; i++) {
          const [ax, ay] = poly[i];
          const [bx, by] = poly[(i + 1) % poly.length];
          const dx = bx - ax, dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
        }
        if (d > best.d) best = { x, y, d };
      }
    return best;
  }

  it("hay 16 manzanas cerradas y el centro de cada una NO es transitable", () => {
    expect(cityBlocks.length).toBe(16);
    for (const b of cityBlocks) {
      const c = deepInside(b.points);
      expect(isWalkable(traceToWorld(c))).toBe(false);
    }
  }, 30000);
});

describe("movimiento y colisiones", () => {
  it("clampToStreets devuelve siempre un punto transitable", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const p = traceToWorld({ x: 60 + rnd() * 980, y: 0 + rnd() * 1080 });
      expect(isWalkable(clampToStreets(p, PLAYER_RADIUS), PLAYER_RADIUS)).toBe(true);
    }
  });

  it("un paseo aleatorio largo nunca sale de las calles", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let p = defaultSpawn();
    for (let i = 0; i < 20000; i++) {
      const a = rnd() * Math.PI * 2;
      p = moveAlongStreets(p, { x: Math.cos(a) * 6, y: Math.sin(a) * 6 }, PLAYER_RADIUS);
      expect(isWalkable(p, PLAYER_RADIUS)).toBe(true);
    }
  });

  it("no se atraviesa la manzana más estrecha empujando contra ella", () => {
    const narrow = [...cityBlocks].sort((a, b) => a.anchoMax - b.anchoMax)[0];
    const xs = narrow.points.map((p) => p[0]);
    const ys = narrow.points.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const top = traceToWorld({ x: cx, y: Math.min(...ys) - 4 });
    const start = clampToStreets(top, PLAYER_RADIUS);
    // empujar hacia abajo (a través de la manzana) durante mucho tiempo
    let p = start;
    for (let i = 0; i < 200; i++) p = moveAlongStreets(p, { x: 0, y: 5 }, PLAYER_RADIUS);
    // sigue en una calle y no ha aparecido al otro lado de la manzana por dentro
    expect(isWalkable(p, PLAYER_RADIUS)).toBe(true);
  });

  it("se puede ir caminando de un extremo del pueblo al otro", () => {
    // seguir la red: de cada nodo al siguiente por sus tramos
    const edge = streetEdges.reduce((a, b) => (a.length > b.length ? a : b));
    let p = clampToStreets(traceToWorld({ x: edge.points[0][0], y: edge.points[0][1] }), PLAYER_RADIUS);
    for (let i = 1; i < edge.points.length; i++) {
      const target = traceToWorld({ x: edge.points[i][0], y: edge.points[i][1] });
      for (let k = 0; k < 400 && Math.hypot(target.x - p.x, target.y - p.y) > 3; k++) {
        const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
        p = moveAlongStreets(p, { x: (dx / d) * Math.min(5, d), y: (dy / d) * Math.min(5, d) }, PLAYER_RADIUS);
      }
      expect(Math.hypot(target.x - p.x, target.y - p.y)).toBeLessThan(STREET_HALF_WIDTH);
    }
  });
});

describe("puntos de interés", () => {
  it("todos tienen número único y estado coherente", () => {
    const nums = pointsOfInterest.map((p) => p.number);
    expect(new Set(nums).size).toBe(nums.length);
    for (const p of pointsOfInterest) {
      expect(p.verified).toBe(false); // nadie los ha confirmado todavía sobre el terreno
      if (p.status === "pendiente") expect(p.trace).toBeNull();
      else expect(p.trace).not.toBeNull();
    }
  });

  it("cada punto con posición tiene una calle a menos de 40 px del trazado", () => {
    for (const p of pointsOfInterest) {
      if (!p.trace) continue;
      const w = traceToWorld(p.trace);
      const d = nearestOnNetwork(w).distance / MAP_SCALE;
      expect(d, `${p.number} ${p.name} está a ${d.toFixed(1)} px de la calle`).toBeLessThan(40);
      expect(isWalkable(accessPoint(w, PLAYER_RADIUS), PLAYER_RADIUS)).toBe(true);
    }
  });
});
