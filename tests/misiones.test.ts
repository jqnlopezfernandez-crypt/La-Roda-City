/**
 * Misiones con clientes reales que CAMINAN hasta el lugar (movimientos legales
 * cada 50 ms, validados por el servidor). Sin teletransportes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../server/app";
import { ROOM_NAME, PLAYER_SPEED, type GameOver, type GameState } from "../shared/net/protocol";
import { ACTIVE_MISSIONS, MISSIONS, missionById } from "../shared/game/missions";
import { teamOf, type Role } from "../shared/game/rules";
import { findPath } from "../shared/map/pathfinding";
import { accessPoint, traceToWorld } from "../shared/map/townMap";
import { pointsOfInterest } from "../shared/data/pointsOfInterest";

let endpoint = "";
let stop: () => Promise<void>;
beforeAll(async () => {
  const { gameServer, httpServer } = createGameServer();
  await gameServer.listen(0, "127.0.0.1");
  const addr = httpServer.address();
  endpoint = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  stop = () => gameServer.gracefullyShutdown(false);
});
afterAll(async () => stop?.());

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 5000, what = "condición") {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`Tiempo agotado: ${what}`);
    await wait(20);
  }
}
type R = Room<any, GameState>;
const me = (r: R) => r.state.players.get(r.sessionId)!;
const role = (r: R) => me(r).role as Role;
const poiWorld = (n: number) => accessPoint(traceToWorld(pointsOfInterest.find((p) => p.number === n)!.trace!), 10);

/** Camina por las calles hasta un lugar enviando posiciones legales cada 50 ms. */
async function walkTo(r: R, n: number) {
  const target = poiWorld(n);
  const { points } = findPath({ x: me(r).x, y: me(r).y }, target);
  let p = { x: me(r).x, y: me(r).y };
  for (const q of points) {
    while (Math.hypot(q.x - p.x, q.y - p.y) > 1) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      const k = Math.min(1, (PLAYER_SPEED * 0.05 * 0.9) / d);
      p = { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
      r.send("move", p);
      await wait(50);
    }
  }
  await until(() => Math.hypot(me(r).x - target.x, me(r).y - target.y) < 5, 3000, `llegar al lugar ${n}`);
}

async function table(n: number, opts: Record<string, unknown>) {
  const host = (await new Client(endpoint).create(ROOM_NAME, { name: "J0", meetingMs: 3000, resultMs: 200, firstKillMs: 60_000, ...opts })) as R;
  await until(() => !!host.state.code);
  const rooms: R[] = [host];
  for (let i = 1; i < n; i++) rooms.push((await new Client(endpoint).joinById(host.state.code, { name: `J${i}` })) as R);
  await until(() => rooms.every((r) => r.state.players?.size === n));
  const denied = new Map<string, string[]>();
  const over: GameOver[] = [];
  for (const r of rooms) {
    r.onMessage("denegado", (d: { reason: string }) => denied.set(r.sessionId, [...(denied.get(r.sessionId) ?? []), d.reason]));
    r.onMessage("corrected", () => {});
  }
  host.onMessage("fin", (g: GameOver) => over.push(g));
  host.send("empezar");
  await until(() => rooms.every((r) => !!role(r) && me(r).tasks?.length > 0), 5000, "roles y misiones");
  return { rooms, denied, over };
}

describe("definición de misiones", () => {
  it("solo se reparten misiones con todos sus lugares en el dibujo", () => {
    const numbers = new Set(pointsOfInterest.filter((p) => p.trace).map((p) => p.number));
    for (const m of ACTIVE_MISSIONS) for (const s of m.pasos) for (const l of s.lugares) expect(numbers.has(l), `${m.id} → ${l}`).toBe(true);
    // las que dependen de lugares sin ubicar quedan fuera
    expect(MISSIONS.filter((m) => m.pendiente).map((m) => m.id).sort()).toEqual(["camaras", "puertas"]);
  });
});

describe("misiones en partida", () => {
  it("cada jugador recibe sus misiones en secreto", async () => {
    const { rooms } = await table(4, {});
    for (const r of rooms) {
      expect(me(r).tasks.length).toBe(4);
      for (const [id, p] of r.state.players) if (id !== r.sessionId) expect(p.tasks?.length ?? 0).toBe(0);
    }
    await Promise.all(rooms.map((r) => r.leave()));
  });

  it("una misión exige estar en el sitio y tardar un mínimo; al completarla sube el progreso", async () => {
    const { rooms, denied } = await table(4, { tasksPerPlayer: 1, missionPool: ["platos"] });
    const crew = rooms.find((r) => teamOf(role(r)) === "tripulacion")!;
    const task = me(crew).tasks[0];
    const place = Number(task.lugares.split(",")[0]);
    // lejos del sitio: denegado
    crew.send("tarea-inicio", { mission: "platos" });
    const far = Math.hypot(me(crew).x - poiWorld(place).x, me(crew).y - poiWorld(place).y) > 95;
    if (far) await until(() => (denied.get(crew.sessionId) ?? []).some((d) => /lugar/.test(d)));
    await walkTo(crew, place);
    crew.send("tarea-inicio", { mission: "platos" });
    await wait(100);
    crew.send("tarea-fin", { mission: "platos" });
    await until(() => (denied.get(crew.sessionId) ?? []).some((d) => /rápido/.test(d)), 3000, "rechazo por rapidez");
    crew.send("tarea-inicio", { mission: "platos" });
    await wait(missionById("platos")!.pasos[0].minMs + 100);
    crew.send("tarea-fin", { mission: "platos" });
    await until(() => me(crew).tasks[0].done === true, 3000, "misión completada");
    expect(crew.state.tasksDone).toBe(1);
    expect(crew.state.tasksTotal).toBe(3); // 3 vecinos × 1 paso
    await Promise.all(rooms.map((r) => r.leave()));
  }, 30000);

  it("las misiones del impostor no cuentan; cuando los vecinos terminan todas, ganan", async () => {
    const { rooms, over } = await table(4, { tasksPerPlayer: 1, missionPool: ["platos"] });
    const imp = rooms.find((r) => teamOf(role(r)) === "impostores")!;
    const crew = rooms.filter((r) => r !== imp);
    // todos van a la vez a su restaurante
    await Promise.all(rooms.map((r) => walkTo(r, Number(me(r).tasks[0].lugares))));
    for (const r of rooms) r.send("tarea-inicio", { mission: "platos" });
    await wait(missionById("platos")!.pasos[0].minMs + 150);
    imp.send("tarea-fin", { mission: "platos" });
    await until(() => me(imp).tasks[0].done === true);
    expect(imp.state.tasksDone).toBe(0); // la tapadera del impostor no suma
    for (const r of crew) r.send("tarea-fin", { mission: "platos" });
    await until(() => over.length === 1, 5000, "victoria por misiones");
    expect(over[0].winner).toBe("tripulacion");
    expect(over[0].reason).toMatch(/misiones/);
    await Promise.all(rooms.map((r) => r.leave()));
  }, 40000);
});
