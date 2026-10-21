/**
 * Pruebas del multijugador con clientes reales de @colyseus/sdk contra un
 * servidor real escuchando en un puerto local (sin simulaciones ni bots).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../server/app";
import { ROOM_NAME, isValidCode, type GameState } from "../shared/net/protocol";
import { isWalkable, traceToWorld } from "../shared/map/townMap";

let endpoint = "";
let stop: () => Promise<void>;

beforeAll(async () => {
  const { gameServer, httpServer } = createGameServer();
  await gameServer.listen(0, "127.0.0.1");
  const addr = httpServer.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  endpoint = `http://127.0.0.1:${port}`;
  stop = () => gameServer.gracefullyShutdown(false);
});

afterAll(async () => {
  await stop?.();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera a que se cumpla una condición sobre el estado sincronizado. */
async function until(cond: () => boolean, timeoutMs = 3000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > timeoutMs) throw new Error("Tiempo de espera agotado");
    await wait(20);
  }
}

type R = Room<any, GameState>;
const players = (room: R) => {
  const out: Record<string, { name: string; x: number; y: number; isHost: boolean; connected: boolean }> = {};
  room.state.players?.forEach((p: any, id: string) => (out[id] = { name: p.name, x: p.x, y: p.y, isHost: p.isHost, connected: p.connected }));
  return out;
};

describe("salas privadas", () => {
  it("crear sala da un código de invitación válido y el creador es anfitrión", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "Ana" })) as R;
    await until(() => !!a.state.code);
    expect(isValidCode(a.state.code)).toBe(true);
    expect(a.roomId).toBe(a.state.code);
    expect(a.state.hostId).toBe(a.sessionId);
    expect(players(a)[a.sessionId].isHost).toBe(true);
    await a.leave();
  });

  it("un segundo dispositivo entra con el código y ambos se ven", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "Ana" })) as R;
    await until(() => !!a.state.code);
    const b = (await new Client(endpoint).joinById(a.state.code, { name: "Bea" })) as R;
    await until(() => Object.keys(players(a)).length === 2 && Object.keys(players(b)).length === 2);
    expect(players(a)[b.sessionId].name).toBe("Bea");
    expect(players(b)[a.sessionId].name).toBe("Ana");
    expect(players(b)[b.sessionId].isHost).toBe(false);
    await a.leave();
    await b.leave();
  });

  it("cada jugador recibe un color de camiseta distinto aunque pidan el mismo", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "A", look: 0 })) as R;
    await until(() => !!a.state.code);
    const b = (await new Client(endpoint).joinById(a.state.code, { name: "B", look: 0 })) as R;
    const c = (await new Client(endpoint).joinById(a.state.code, { name: "C", look: 0 })) as R;
    await until(() => a.state.players.size === 3);
    const looks = [...a.state.players.values()].map((p: any) => p.look);
    expect(new Set(looks).size).toBe(3);
    await Promise.all([a.leave(), b.leave(), c.leave()]);
  });

  it("un código inexistente da error", async () => {
    await expect(new Client(endpoint).joinById("ZZZZZ", { name: "X" })).rejects.toBeTruthy();
  });

  it("los nombres repetidos se distinguen y se limpian", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "  Pepe  <b>" })) as R;
    await until(() => !!a.state.code);
    const b = (await new Client(endpoint).joinById(a.state.code, { name: "pepe b" })) as R;
    const c = (await new Client(endpoint).joinById(a.state.code, { name: "Pepe b" })) as R;
    await until(() => Object.keys(players(a)).length === 3);
    const names = Object.values(players(a)).map((p) => p.name).sort();
    // "<b>" se limpia a "b"; los repetidos (sin distinguir mayúsculas) reciben sufijo
    expect(names).toEqual(["Pepe b", "Pepe b 3", "pepe b 2"]);
    await Promise.all([a.leave(), b.leave(), c.leave()]);
  });
});

describe("movimiento sincronizado y validado", () => {
  it("un movimiento legal se ve en el otro dispositivo", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "Ana" })) as R;
    await until(() => !!a.state.code);
    const b = (await new Client(endpoint).joinById(a.state.code, { name: "Bea" })) as R;
    await until(() => Object.keys(players(b)).length === 2);
    const start = players(a)[a.sessionId];
    // pasos cortos a lo largo de la calle (como haría el cliente cada 50 ms)
    let x = start.x;
    let y = start.y;
    for (let i = 0; i < 10; i++) {
      const nx = x + 6;
      if (!isWalkable({ x: nx, y }, 10)) break;
      x = nx;
      a.send("move", { x, y });
      await wait(55);
    }
    await until(() => Math.abs(players(b)[a.sessionId].x - x) < 0.01);
    expect(players(b)[a.sessionId].x).toBeCloseTo(x);
    await a.leave();
    await b.leave();
  });

  it("el servidor rechaza teletransportes y atravesar manzanas", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "Tramposo" })) as R;
    await until(() => !!a.state.code);
    const start = players(a)[a.sessionId];
    let corrected = 0;
    a.onMessage("corrected", () => corrected++);
    // destino lejano dentro de una manzana: debe quedar en la calle y cerca del inicio
    const target = traceToWorld({ x: 560, y: 690 });
    a.send("move", target);
    await wait(150);
    const p = players(a)[a.sessionId];
    expect(isWalkable(p, 10)).toBe(true);
    expect(Math.hypot(p.x - start.x, p.y - start.y)).toBeLessThan(80);
    expect(corrected).toBeGreaterThan(0);
    // valores no numéricos: se ignoran
    a.send("move", { x: Number.NaN, y: 5 });
    await wait(100);
    expect(isWalkable(players(a)[a.sessionId], 10)).toBe(true);
    await a.leave();
  });
});

describe("anfitrión, desconexión y reconexión", () => {
  it("si el anfitrión se va, el anfitrión pasa al siguiente jugador", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "Ana" })) as R;
    await until(() => !!a.state.code);
    const b = (await new Client(endpoint).joinById(a.state.code, { name: "Bea" })) as R;
    await until(() => Object.keys(players(b)).length === 2);
    await a.leave(true);
    await until(() => b.state.hostId === b.sessionId);
    expect(players(b)[b.sessionId].isHost).toBe(true);
    expect(Object.keys(players(b))).toEqual([b.sessionId]);
    await b.leave();
  });

  it("un jugador que pierde la conexión conserva su sitio y vuelve con su token", async () => {
    const a = (await new Client(endpoint).create(ROOM_NAME, { name: "Ana" })) as R;
    await until(() => !!a.state.code);
    const b = (await new Client(endpoint).joinById(a.state.code, { name: "Bea" })) as R;
    await until(() => Object.keys(players(a)).length === 2);
    const token = b.reconnectionToken;
    const bId = b.sessionId;
    // corte brusco (sin "leave"): se cierra el socket por debajo
    b.reconnection.enabled = false;
    (b.connection as unknown as { transport: { ws: { close(): void } } }).transport.ws.close();
    await until(() => players(a)[bId]?.connected === false);
    expect(players(a)[bId].name).toBe("Bea");
    const b2 = (await new Client(endpoint).reconnect(token)) as R;
    expect(b2.sessionId).toBe(bId);
    await until(() => players(a)[bId]?.connected === true);
    await a.leave();
    await b2.leave();
  });
});
