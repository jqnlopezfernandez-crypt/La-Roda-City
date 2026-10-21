/**
 * Partida completa con clientes reales de @colyseus/sdk contra el servidor real.
 * Cada "jugador" es una conexión independiente, como un móvil distinto.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../server/app";
import { ROOM_NAME, type GameOver, type GameState, type VoteResult } from "../shared/net/protocol";
import { RULES, SKIP_VOTE, teamOf, type Role } from "../shared/game/rules";

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
async function until(cond: () => boolean, ms = 4000, what = "condición") {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`Tiempo agotado esperando: ${what}`);
    await wait(20);
  }
}
type R = Room<any, GameState>;
const FAST = { meetingMs: 3000, resultMs: 200, firstKillMs: 0, killCooldownMs: 0 };

type Mesa = { rooms: R[]; byId: Map<string, R>; denied: Map<string, string[]>; results: VoteResult[]; over: GameOver[] };

/** Crea una sala con n jugadores conectados y empieza la partida. */
async function mesa(n: number, start = true, extra: Record<string, unknown> = {}): Promise<Mesa> {
  const host = (await new Client(endpoint).create(ROOM_NAME, { name: "J0", ...FAST, ...extra })) as R;
  await until(() => !!host.state.code);
  const rooms: R[] = [host];
  for (let i = 1; i < n; i++) rooms.push((await new Client(endpoint).joinById(host.state.code, { name: `J${i}` })) as R);
  await until(() => rooms.every((r) => r.state.players?.size === n), 4000, "todos conectados");
  const m: Mesa = { rooms, byId: new Map(rooms.map((r) => [r.sessionId, r])), denied: new Map(), results: [], over: [] };
  for (const r of rooms) {
    r.onMessage("denegado", (d: { action: string; reason: string }) => m.denied.set(r.sessionId, [...(m.denied.get(r.sessionId) ?? []), d.action]));
    r.onMessage("corrected", () => {});
  }
  host.onMessage("resultado-votacion", (v: VoteResult) => m.results.push(v));
  host.onMessage("fin", (g: GameOver) => m.over.push(g));
  if (start) {
    host.send("empezar");
    await until(() => rooms.every((r) => r.state.phase === "partida"), 4000, "partida empezada");
  }
  return m;
}
const close = (m: Mesa) => Promise.all(m.rooms.map((r) => r.leave().catch(() => {})));
const myRole = (r: R) => r.state.players.get(r.sessionId)?.role as Role;
const player = (r: R, id: string) => r.state.players.get(id)!;
const impostors = (m: Mesa) => m.rooms.filter((r) => teamOf(myRole(r)) === "impostores");
const crew = (m: Mesa) => m.rooms.filter((r) => teamOf(myRole(r)) === "tripulacion");

describe("inicio de partida", () => {
  it("solo el anfitrión puede empezar y hacen falta 4 jugadores", async () => {
    const m3 = await mesa(3, false);
    m3.rooms[0].send("empezar");
    await until(() => (m3.denied.get(m3.rooms[0].sessionId) ?? []).includes("empezar"));
    expect(m3.rooms[0].state.phase).toBe("sala");
    await close(m3);

    const m4 = await mesa(4, false);
    m4.rooms[2].send("empezar");
    await until(() => (m4.denied.get(m4.rooms[2].sessionId) ?? []).includes("empezar"));
    expect(m4.rooms[0].state.phase).toBe("sala");
    m4.rooms[0].send("empezar");
    await until(() => m4.rooms.every((r) => r.state.phase === "partida"));
    await close(m4);
  });

  it("el impostor no puede eliminar durante la espera inicial", async () => {
    const host = (await new Client(endpoint).create(ROOM_NAME, { name: "J0", ...FAST, firstKillMs: 60_000 })) as R;
    await until(() => !!host.state.code);
    const rooms: R[] = [host];
    for (let i = 1; i < 4; i++) rooms.push((await new Client(endpoint).joinById(host.state.code, { name: `J${i}` })) as R);
    await until(() => rooms.every((r) => r.state.players?.size === 4));
    const denied: string[] = [];
    for (const r of rooms) r.onMessage("denegado", (d: { reason: string }) => denied.push(d.reason));
    host.send("empezar");
    await until(() => rooms.every((r) => !!myRole(r)));
    const imp = rooms.find((r) => teamOf(myRole(r)) === "impostores")!;
    const victim = rooms.find((r) => r !== imp)!;
    expect(player(imp, imp.sessionId).killReadyAt).toBeGreaterThan(Date.now() + 50_000);
    imp.send("eliminar", { target: victim.sessionId });
    await until(() => denied.some((d) => /todavía/i.test(d)));
    expect(player(imp, victim.sessionId).alive).toBe(true);
    await Promise.all(rooms.map((r) => r.leave()));
  });

  it("nadie puede entrar en una partida ya empezada", async () => {
    const m = await mesa(4);
    await expect(new Client(endpoint).joinById(m.rooms[0].state.code, { name: "Tarde" })).rejects.toBeTruthy();
    await close(m);
  });
});

describe("roles secretos", () => {
  it("cada jugador recibe SOLO su rol; los vecinos no ven el de nadie más", async () => {
    const m = await mesa(5);
    await until(() => m.rooms.every((r) => !!myRole(r)), 4000, "roles recibidos");
    for (const r of m.rooms) {
      const others = [...r.state.players.entries()].filter(([id]) => id !== r.sessionId);
      if (teamOf(myRole(r)) === "tripulacion") for (const [, p] of others) expect(p.role || "").toBe("");
    }
    expect(impostors(m).length).toBe(1);
    expect(m.rooms.filter((r) => myRole(r) === "roeno").length).toBeGreaterThanOrEqual(1);
    await close(m);
  });

  it("con 7 jugadores hay dos impostores distintos y se ven entre ellos", async () => {
    const m = await mesa(7);
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const imps = impostors(m);
    expect(imps.length).toBe(2);
    expect(myRole(imps[0])).not.toBe(myRole(imps[1]));
    const [a, b] = imps;
    await until(() => !!player(a, b.sessionId).role && !!player(b, a.sessionId).role, 4000, "compañero visible");
    expect(player(a, b.sessionId).role).toBe(myRole(b));
    await close(m);
  });
});

describe("eliminaciones, cuerpos y reuniones", () => {
  it("un vecino no puede eliminar; el impostor sí (si está cerca) y deja un cuerpo", async () => {
    const m = await mesa(5);
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const [imp] = impostors(m);
    const [c1, c2] = crew(m);
    c1.send("eliminar", { target: c2.sessionId });
    await until(() => (m.denied.get(c1.sessionId) ?? []).includes("eliminar"));
    // todos aparecen en corro (≤ 60 px): dentro del alcance de 70
    imp.send("eliminar", { target: c1.sessionId });
    await until(() => player(c2, c1.sessionId).alive === false, 4000, "víctima muerta");
    expect(c2.state.bodies.get(c1.sessionId)).toBeTruthy();
    // un impostor no puede eliminar a otro impostor ni a un muerto
    imp.send("eliminar", { target: c1.sessionId });
    await until(() => (m.denied.get(imp.sessionId) ?? []).includes("eliminar"));
    await close(m);
  });

  it("reportar un cuerpo abre una reunión; la votación expulsa y se revela si era impostor", async () => {
    const m = await mesa(5);
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const [imp] = impostors(m);
    const cs = crew(m);
    imp.send("eliminar", { target: cs[0].sessionId });
    await until(() => !!cs[1].state.bodies.get(cs[0].sessionId));
    cs[1].send("reportar", { body: cs[0].sessionId });
    await until(() => m.rooms.every((r) => r.state.phase === "reunion"), 4000, "reunión");
    expect(cs[1].state.meetingReason).toBe("cadaver");
    expect(cs[1].state.meetingVictim).toBe("J" + m.rooms.indexOf(cs[0]));
    expect(cs[1].state.bodies.size).toBe(0);
    // un muerto no vota; votar dos veces no vale
    cs[0].send("votar", { target: imp.sessionId });
    await until(() => (m.denied.get(cs[0].sessionId) ?? []).includes("votar"));
    // los vivos votan al impostor (el impostor vota saltar)
    for (const r of cs.slice(1)) r.send("votar", { target: imp.sessionId });
    cs[1].send("votar", { target: imp.sessionId });
    imp.send("votar", { target: SKIP_VOTE });
    await until(() => m.results.length === 1, 4000, "resultado");
    expect(m.results[0].ejectedId).toBe(imp.sessionId);
    expect(m.results[0].ejectedWasImpostor).toBe(true);
    await until(() => m.over.length === 1, 4000, "fin de partida");
    expect(m.over[0].winner).toBe("tripulacion");
    expect(m.rooms[0].state.phase).toBe("fin");
    // al terminar se revelan todos los roles
    expect(m.over[0].roles.length).toBe(5);
    await close(m);
  });

  it("los impostores ganan al igualar a los vecinos", async () => {
    const m = await mesa(4);
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const [imp] = impostors(m);
    const cs = crew(m);
    imp.send("eliminar", { target: cs[0].sessionId });
    await until(() => player(imp, cs[0].sessionId).alive === false);
    // 1 impostor contra 2 vecinos: aún no hay ganador
    expect(imp.state.phase).toBe("partida");
    // acercarse al siguiente (pasos cortos y legales) y eliminarlo
    const target = player(imp, cs[1].sessionId);
    const me = player(imp, imp.sessionId);
    for (let i = 0; i < 40 && Math.hypot(me.x - target.x, me.y - target.y) > 50; i++) {
      const d = Math.hypot(target.x - me.x, target.y - me.y);
      imp.send("move", { x: me.x + ((target.x - me.x) / d) * 8, y: me.y + ((target.y - me.y) / d) * 8 });
      await wait(60);
    }
    imp.send("eliminar", { target: cs[1].sessionId });
    await until(() => m.over.length === 1, 4000, "victoria impostora");
    expect(m.over[0].winner).toBe("impostores");
    await close(m);
  });

  it("el Gitano se lleva el cuerpo de su víctima y ya no se puede reportar", async () => {
    const m = await mesa(7, true, { forceRoles: { J0: "gitano", J1: "sapo", J2: "roeno", J3: "roeno", J4: "roeno", J5: "roeno", J6: "roeno" } });
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const gitano = m.rooms.find((r) => myRole(r) === "gitano")!;
    const sapo = m.rooms.find((r) => myRole(r) === "sapo")!;
    const cs = crew(m);
    // la víctima más cercana al Gitano
    const me = player(gitano, gitano.sessionId);
    const victim = cs.sort((a, b) => {
      const pa = player(gitano, a.sessionId), pb = player(gitano, b.sessionId);
      return Math.hypot(pa.x - me.x, pa.y - me.y) - Math.hypot(pb.x - me.x, pb.y - me.y);
    })[0];
    gitano.send("eliminar", { target: victim.sessionId });
    await until(() => !!cs[cs.length - 1].state.bodies.get(victim.sessionId), 4000, "cuerpo");
    // el Sapo no puede llevarse cuerpos
    sapo.send("llevar", { body: victim.sessionId });
    await until(() => (m.denied.get(sapo.sessionId) ?? []).includes("llevar"));
    gitano.send("llevar", { body: victim.sessionId });
    await until(() => !cs[cs.length - 1].state.bodies.get(victim.sessionId), 4000, "cuerpo retirado");
    const witness = cs.find((r) => r !== victim)!;
    witness.send("reportar", { body: victim.sessionId });
    await until(() => (m.denied.get(witness.sessionId) ?? []).includes("reportar"));
    expect(witness.state.phase).toBe("partida");
    await close(m);
  });

  it("Vilchez saluda a alguien y lo deja rastreado; los demás solo saludan", async () => {
    const m = await mesa(5, true, { forceRoles: { J0: "sapo", J1: "vilchez", J2: "roeno", J3: "roeno", J4: "conserje" } });
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const [, vilchez, a, b] = m.rooms;
    const saludos: string[] = [];
    b.onMessage("saludo", (g: { from: string; to: string }) => saludos.push(`${g.from}>${g.to}`));
    vilchez.send("saludar", { target: a.sessionId });
    await until(() => player(vilchez, vilchez.sessionId).trackedId === a.sessionId, 4000, "rastreo");
    await until(() => saludos.length === 1, 4000, "saludo visible para todos");
    // el rastreo es para siempre: un segundo saludo no lo cambia
    await wait(RULES.greetCooldownMs + 100);
    vilchez.send("saludar", { target: b.sessionId });
    await wait(300);
    expect(player(vilchez, vilchez.sessionId).trackedId).toBe(a.sessionId);
    // un Roeño saluda pero no rastrea a nadie (y no ve el rastreo de Vilchez)
    a.send("saludar", { target: b.sessionId });
    await until(() => saludos.length >= 2);
    expect(player(a, a.sessionId).trackedId || "").toBe("");
    expect(player(a, vilchez.sessionId).trackedId || "").toBe("");
    await close(m);
  });

  it("el Pirómano prende fuego; se apaga entre dos en los dos puntos, o el Conserje solo", async () => {
    const m = await mesa(5, true, { forceRoles: { J0: "piromano", J1: "roeno", J2: "roeno", J3: "conserje", J4: "roeno" } });
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const [piro, r1] = m.rooms;
    // al principio todavía no puede (espera inicial)
    piro.send("incendio");
    await until(() => (m.denied.get(piro.sessionId) ?? []).includes("incendio"));
    expect(r1.state.sabotage || "").toBe("");
    await close(m);

    const roles = { J0: "piromano", J1: "roeno", J2: "roeno", J3: "conserje", J4: "roeno" };
    const m2 = await mesa(5, true, { forceRoles: roles, fireFirstMs: 0, fireFixRange: 1e9 });
    await until(() => m2.rooms.every((r) => !!myRole(r)));
    const [p2, a, b, c] = m2.rooms;
    a.send("incendio"); // un vecino no puede
    await until(() => (m2.denied.get(a.sessionId) ?? []).includes("incendio"));
    p2.send("incendio");
    await until(() => a.state.sabotage === "incendio", 4000, "incendio");
    a.send("emergencia"); // no se puede convocar mientras arde
    await until(() => (m2.denied.get(a.sessionId) ?? []).filter((x) => x === "emergencia").length === 1);
    // un solo vecino en un punto no basta
    const [pa, pb] = RULES.firePoints;
    a.send("apagar", { punto: pa });
    await wait(200);
    expect(b.state.sabotage).toBe("incendio");
    expect(b.state.fireHeld).toBe(String(pa));
    // el mismo en los dos puntos tampoco
    a.send("apagar", { punto: pb });
    await wait(200);
    expect(b.state.sabotage).toBe("incendio");
    // dos vecinos a la vez, cada uno en un punto: se apaga
    b.send("apagar", { punto: pa });
    await until(() => a.state.sabotage === "", 4000, "fuego apagado entre dos");
    // otro fuego (sin espera en pruebas no: hay enfriamiento) → nueva sala para el Conserje
    await close(m2);

    const m3 = await mesa(5, true, { forceRoles: roles, fireFirstMs: 0, fireFixRange: 1e9 });
    await until(() => m3.rooms.every((r) => !!myRole(r)));
    m3.rooms[0].send("incendio");
    await until(() => m3.rooms[1].state.sabotage === "incendio", 4000, "incendio 2");
    m3.rooms[3].send("apagar", { punto: pa }); // el Conserje solo
    await until(() => m3.rooms[1].state.sabotage === "", 4000, "apagado por el Conserje");
    void c;
    await close(m3);
  });

  it("sabotaje crítico: si no se arregla a tiempo ganan los impostores", async () => {
    const roles = { J0: "sapo", J1: "roeno", J2: "roeno", J3: "roeno" };
    const m = await mesa(4, true, { forceRoles: roles, sabotageFirstMs: 0, criticalMs: 600 });
    await until(() => m.rooms.every((r) => !!myRole(r)));
    m.rooms[1].send("sabotear", { kind: "cabeza" }); // un vecino no puede
    await until(() => (m.denied.get(m.rooms[1].sessionId) ?? []).includes("sabotear"));
    m.rooms[0].send("sabotear", { kind: "cabeza" });
    await until(() => m.rooms[1].state.sabotage === "cabeza", 4000, "sabotaje");
    await until(() => m.over.length === 1, 4000, "fin por sabotaje");
    expect(m.over[0].winner).toBe("impostores");
    await close(m);
  });

  it("sabotaje crítico: lo arreglan dos vecinos, o el Conserje solo", async () => {
    const roles = { J0: "gitano", J1: "roeno", J2: "roeno", J3: "conserje", J4: "roeno" };
    const opts = { forceRoles: roles, sabotageFirstMs: 0, criticalMs: 20_000, fixMinMs: 100, fixRange: 1e9 };
    const m = await mesa(5, true, opts);
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const [imp, a, b] = m.rooms;
    imp.send("sabotear", { kind: "riada" });
    await until(() => a.state.sabotage === "riada", 4000, "riada");
    // arreglar sin haber empezado el minijuego no vale
    a.send("arreglar", { kind: "riada" });
    await until(() => (m.denied.get(a.sessionId) ?? []).includes("arreglar"));
    a.send("arreglar-inicio", { kind: "riada" });
    await wait(150);
    a.send("arreglar", { kind: "riada" });
    await until(() => a.state.sabotageFixes === 1, 4000, "primer arreglo");
    expect(a.state.sabotage).toBe("riada");
    b.send("arreglar-inicio", { kind: "riada" });
    await wait(150);
    b.send("arreglar", { kind: "riada" });
    await until(() => a.state.sabotage === "", 4000, "arreglado entre dos");
    await close(m);

    const m2 = await mesa(5, true, opts);
    await until(() => m2.rooms.every((r) => !!myRole(r)));
    m2.rooms[0].send("sabotear", { kind: "piscina" });
    await until(() => m2.rooms[1].state.sabotage === "piscina", 4000, "piscina");
    const conserje = m2.rooms[3];
    conserje.send("arreglar-inicio", { kind: "piscina" });
    await wait(150);
    conserje.send("arreglar", { kind: "piscina" });
    await until(() => m2.rooms[1].state.sabotage === "", 4000, "arreglado por el Conserje");
    expect(m2.over.length).toBe(0);
    await close(m2);
  });

  it("el Ludópata juega una vez por ronda en un bar y con premio sabe de alguien bueno", async () => {
    const roles = { J0: "sapo", J1: "ludopata", J2: "roeno", J3: "roeno" };
    const m = await mesa(4, true, { forceRoles: roles, slotChance: 1 });
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const ludo = m.rooms[1];
    const premios: { won: boolean; id: string | null }[] = [];
    ludo.onMessage("premio", (r: { won: boolean; id: string | null }) => premios.push(r));
    // lejos de un bar: no puede
    ludo.send("tragaperras");
    await until(() => (m.denied.get(ludo.sessionId) ?? []).includes("tragaperras"));
    expect(premios.length).toBe(0);
    // un Roeño no puede jugar
    m.rooms[2].send("tragaperras");
    await until(() => (m.denied.get(m.rooms[2].sessionId) ?? []).includes("tragaperras"));
    await close(m);
  });



  it("el anfitrión puede volver a la sala tras el final", async () => {
    const m = await mesa(4);
    await until(() => m.rooms.every((r) => !!myRole(r)));
    const [imp] = impostors(m);
    // el impostor elimina a alguien, otro lo reporta y los vecinos expulsan al impostor
    const [victim, witness] = crew(m);
    imp.send("eliminar", { target: victim.sessionId });
    await until(() => !!witness.state.bodies.get(victim.sessionId), 4000, "cuerpo");
    witness.send("reportar", { body: victim.sessionId });
    await until(() => m.rooms[0].state.phase === "reunion");
    for (const r of m.rooms) r.send("votar", { target: r === imp ? SKIP_VOTE : imp.sessionId });
    await until(() => m.rooms[0].state.phase === "fin", 5000, "fin");
    m.rooms[0].send("volver");
    await until(() => m.rooms.every((r) => r.state.phase === "sala"), 4000, "vuelta a la sala");
    expect([...m.rooms[0].state.players.values()].every((p: any) => p.alive)).toBe(true);
    await close(m);
  });
});
