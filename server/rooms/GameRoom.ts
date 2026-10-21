import { Room, type Client, type Delayed } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import {
  BodyState,
  TaskState,
  CODE_ALPHABET,
  CODE_LENGTH,
  GameState,
  LOOK_COUNT,
  MAX_PLAYERS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PlayerState,
  RECONNECT_SECONDS,
  sanitizeName,
  type GameOver,
  type JoinOptions,
  type Phase,
  type SlotResult,
  type VoteResult,
} from "../../shared/net/protocol.ts";
import { defaultSpawn, accessPoint, traceToWorld, validateMove, validateMoveWithin, type Vec2 } from "../../shared/map/townMap.ts";
import { RULES, SABOTAGES, SKIP_VOTE, assignRoles, checkWinner, isSabotageKind, tallyVotes, teamOf, type Role, type Team } from "../../shared/game/rules.ts";
import { pointsOfInterest } from "../../shared/data/pointsOfInterest.ts";
import { MISSION_RANGE, missionById, pickTasks } from "../../shared/game/missions.ts";

/** Punto de acceso a pie de un lugar del dibujo (por su número). */
function poiAccess(n: number): Vec2 | null {
  const poi = pointsOfInterest.find((p) => p.number === n);
  return poi?.trace ? accessPoint(traceToWorld(poi.trace), PLAYER_RADIUS) : null;
}

/** Códigos en uso en este proceso (una sala = un código). */
const activeCodes = new Set<string>();

export function generateCode(random: () => number = Math.random): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
    if (!activeCodes.has(code)) return code;
  }
  throw new Error("No quedan códigos libres");
}

/** Punto de reunión: acceso a pie del Ayuntamiento (n.º 11 del dibujo). */
function townHallAccess(): Vec2 {
  const poi = pointsOfInterest.find((p) => p.number === 11);
  return poi?.trace ? accessPoint(traceToWorld(poi.trace), PLAYER_RADIUS) : defaultSpawn();
}

/** Tiempos cortos para las pruebas automáticas (ignorados fuera de Vitest). */
export type RoomOptions = {
  meetingMs?: number;
  resultMs?: number;
  firstKillMs?: number;
  killCooldownMs?: number;
  tasksPerPlayer?: number;
  missionPool?: string[];
  /** Roles fijos por nombre de jugador (pruebas). */
  forceRoles?: Record<string, Role>;
  slotChance?: number;
  fireFirstMs?: number;
  fireFixRange?: number;
  sabotageFirstMs?: number;
  criticalMs?: number;
  fixMinMs?: number;
  fixRange?: number;
};

/**
 * Sala privada de La Roda City. TODA la lógica de juego vive aquí:
 * el cliente solo envía intenciones y el servidor las valida.
 *  - El id de la sala ES el código de invitación (`joinById(código)`); es privada.
 *  - Roles secretos con StateView: cada jugador solo recibe su propio rol
 *    (los impostores también ven a su compañero).
 *  - Eliminaciones, cuerpos, Gitano que se lleva cuerpos, reuniones (cadáver,
 *    emergencia en el Ayuntamiento, Vilchez desde cualquier sitio), votaciones
 *    y condiciones de victoria.
 *  - Anfitrión: el primero; si se va, pasa al jugador más antiguo conectado.
 *  - Desconexiones: se guarda el sitio RECONNECT_SECONDS segundos.
 */
export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  state = new GameState();
  private lastMoveAt = new Map<string, number>();
  private rejectedMoves = new Map<string, number>();
  /** Distancia que cada jugador puede recorrer todavía (se recarga con el tiempo). */
  private moveBudget = new Map<string, number>();
  private roles = new Map<string, Role>();
  private votes = new Map<string, string>();
  private killers = new Map<string, string>(); // cuerpo → asesino
  private phaseTimer: Delayed | null = null;
  /** Minijuego en curso por jugador: qué misión/paso y cuándo empezó (para exigir un tiempo mínimo). */
  private taskStarts = new Map<string, { missionId: string; step: number; at: number }>();
  private random: () => number = Math.random;
  private now: () => number = () => Date.now();
  private meetingMs = RULES.meetingMs;
  private resultMs = RULES.resultMs;
  private firstKillMs = RULES.firstKillCooldownMs;
  private killCooldownMs = RULES.killCooldownMs;
  private tasksPerPlayer: number | undefined;
  /** Último saludo de cada jugador (para limitar la frecuencia). */
  private lastGreet = new Map<string, number>();
  /** Puntos de apagado sujetos: punto → quién y hasta cuándo vale. */
  private fireHolds = new Map<number, { id: string; until: number }>();
  private fireTimer: Delayed | null = null;
  /** Sabotaje crítico: quién lo ha arreglado y cuándo empezó cada uno su minijuego. */
  private fixers = new Set<string>();
  private fixStarts = new Map<string, number>();
  /** Ludópata: jugadores buenos que ya le han revelado (para no repetir). */
  private revealed = new Map<string, Set<string>>();
  private missionPool: string[] | undefined;
  private forceRoles: Record<string, Role> | undefined;
  private slotChance = RULES.slotChance;
  private fireFirstMs = RULES.fireFirstMs;
  private fireFixRange = RULES.fireFixRange;
  private sabotageFirstMs = RULES.sabotageFirstMs;
  private criticalMs = RULES.criticalMs;
  private fixMinMs = RULES.fixMinMs;
  private fixRange = MISSION_RANGE;

  onCreate(options: JoinOptions & RoomOptions = {}) {
    // Opciones de prueba (azar con semilla, tiempos cortos). Solo se aceptan en pruebas.
    if (process.env.VITEST) {
      if (typeof options.meetingMs === "number") this.meetingMs = options.meetingMs;
      if (typeof options.resultMs === "number") this.resultMs = options.resultMs;
      if (typeof options.firstKillMs === "number") this.firstKillMs = options.firstKillMs;
      if (typeof options.killCooldownMs === "number") this.killCooldownMs = options.killCooldownMs;
      if (typeof options.tasksPerPlayer === "number") this.tasksPerPlayer = options.tasksPerPlayer;
      if (Array.isArray(options.missionPool)) this.missionPool = options.missionPool;
      if (options.forceRoles && typeof options.forceRoles === "object") this.forceRoles = options.forceRoles;
      if (typeof options.slotChance === "number") this.slotChance = options.slotChance;
      if (typeof options.fireFirstMs === "number") this.fireFirstMs = options.fireFirstMs;
      if (typeof options.fireFixRange === "number") this.fireFixRange = options.fireFixRange;
      if (typeof options.sabotageFirstMs === "number") this.sabotageFirstMs = options.sabotageFirstMs;
      if (typeof options.criticalMs === "number") this.criticalMs = options.criticalMs;
      if (typeof options.fixMinMs === "number") this.fixMinMs = options.fixMinMs;
      if (typeof options.fixRange === "number") this.fixRange = options.fixRange;
    }
    const code = generateCode();
    activeCodes.add(code);
    this.roomId = code;
    this.state.code = code;
    this.state.phase = "sala";
    void this.setPrivate(true);
    void this.setMetadata({ code });

    this.state.serverTime = this.now();
    this.clock.setInterval(() => (this.state.serverTime = this.now()), 1000);

    this.onMessage("move", (client, msg: { x: number; y: number }) => this.handleMove(client, msg));
    this.onMessage("rename", (client, msg: { name: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (p && this.state.phase === "sala") p.name = this.uniqueName(sanitizeName(msg?.name), client.sessionId);
    });
    this.onMessage("look", (client, msg: { look: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (p && this.state.phase === "sala" && Number.isInteger(msg?.look) && msg.look >= 0 && msg.look < LOOK_COUNT) p.look = this.freeLook(msg.look, client.sessionId);
    });
    this.onMessage("empezar", (client) => this.startGame(client));
    this.onMessage("eliminar", (client, msg: { target: string }) => this.kill(client, msg?.target));
    this.onMessage("llevar", (client, msg: { body: string }) => this.carryBody(client, msg?.body));
    this.onMessage("reportar", (client, msg: { body: string }) => this.report(client, msg?.body));
    this.onMessage("emergencia", (client) => this.emergency(client));
    this.onMessage("votar", (client, msg: { target: string }) => this.vote(client, msg?.target));
    this.onMessage("volver", (client) => this.backToLobby(client));
    this.onMessage("tarea-inicio", (client, msg: { mission: string }) => this.taskStart(client, msg?.mission));
    this.onMessage("tarea-fin", (client, msg: { mission: string }) => this.taskFinish(client, msg?.mission));
    this.onMessage("saludar", (client, msg: { target: string }) => this.greet(client, msg?.target));
    this.onMessage("incendio", (client) => this.startFire(client));
    this.onMessage("apagar", (client, msg: { punto: number }) => this.holdFirePoint(client, Number(msg?.punto)));
    this.onMessage("tragaperras", (client) => this.playSlot(client));
    this.onMessage("sabotear", (client, msg: { kind: string }) => this.sabotage(client, String(msg?.kind ?? "")));
    this.onMessage("arreglar-inicio", (client, msg: { kind: string }) => this.fixStart(client, String(msg?.kind ?? "")));
    this.onMessage("arreglar", (client, msg: { kind: string }) => this.fix(client, String(msg?.kind ?? "")));
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const spawn = this.ringPoint(defaultSpawn(), this.state.players.size);
    const player = new PlayerState();
    player.name = this.uniqueName(sanitizeName(options.name), client.sessionId);
    player.x = spawn.x;
    player.y = spawn.y;
    const wanted = Number.isInteger(options.look) && options.look! >= 0 && options.look! < LOOK_COUNT ? options.look! : 0;
    player.look = this.freeLook(wanted, client.sessionId);
    player.connected = true;
    player.joinedAt = this.now();
    player.isHost = false;
    player.alive = true;
    player.role = "";
    this.state.players.set(client.sessionId, player);
    this.lastMoveAt.set(client.sessionId, this.now());
    client.view = new StateView();
    client.view.add(player);
    if (!this.state.hostId) this.setHost(client.sessionId);
  }

  async onDrop(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;
    await this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = true;
    this.lastMoveAt.set(client.sessionId, this.now());
    this.refreshView(client);
  }

  onLeave(client: Client) {
    // las misiones pendientes de un vecino que se va dejan de contar para la victoria
    const leaving = this.state.players.get(client.sessionId);
    const leavingRole = this.roles.get(client.sessionId);
    if (leaving && leavingRole && teamOf(leavingRole) === "tripulacion" && this.inGame()) {
      let pending = 0;
      for (const t of leaving.tasks) pending += t.steps - t.step;
      this.state.tasksTotal = Math.max(this.state.tasksDone, this.state.tasksTotal - pending);
    }
    this.state.players.delete(client.sessionId);
    this.lastMoveAt.delete(client.sessionId);
    this.rejectedMoves.delete(client.sessionId);
    this.moveBudget.delete(client.sessionId);
    this.roles.delete(client.sessionId);
    this.votes.delete(client.sessionId);
    if (this.state.hostId === client.sessionId) this.pickNewHost();
    if (this.inGame()) {
      // irse cuenta como quedar fuera de la partida
      if (this.state.phase === "reunion") this.maybeCloseVoting();
      this.checkEnd();
    }
  }

  onDispose() {
    activeCodes.delete(this.state.code);
  }

  /** Número de movimientos corregidos por jugador (diagnóstico y pruebas). */
  getRejectedMoves(sessionId: string) {
    return this.rejectedMoves.get(sessionId) ?? 0;
  }

  // ------------------------------------------------------------------ partida

  private startGame(client: Client) {
    if (this.state.phase !== "sala") return this.deny(client, "empezar", "La partida ya ha empezado.");
    if (client.sessionId !== this.state.hostId) return this.deny(client, "empezar", "Solo el anfitrión puede empezar.");
    const ids = [...this.state.players.keys()].filter((id) => this.state.players.get(id)!.connected);
    if (ids.length < RULES.minPlayers) return this.deny(client, "empezar", `Hacen falta al menos ${RULES.minPlayers} jugadores.`);

    this.roles = assignRoles(ids, this.random);
    if (this.forceRoles) for (const id of ids) {
      const forced = this.forceRoles[this.state.players.get(id)!.name];
      if (forced) this.roles.set(id, forced);
    }
    const now = this.now();
    let i = 0;
    let total = 0;
    this.taskStarts.clear();
    for (const [id, p] of this.state.players) {
      const role = this.roles.get(id);
      if (!role) continue; // desconectado en este momento: no juega
      p.role = role;
      p.alive = true;
      p.hasVoted = false;
      p.tasksDone = 0;
      p.emergenciesLeft = RULES.emergenciesPerPlayer;
      p.specialLeft = false;
      p.trackedId = "";
      p.slotUsed = false;
      p.fireReadyAt = role === "piromano" ? now + this.fireFirstMs : 0;
      p.sabotageReadyAt = teamOf(role) === "impostores" ? now + this.sabotageFirstMs : 0;
      p.killReadyAt = teamOf(role) === "impostores" ? now + this.firstKillMs : 0;
      const pos = this.ringPoint(defaultSpawn(), i++);
      p.x = pos.x;
      p.y = pos.y;
      // misiones: los vecinos cuentan para la victoria; los impostores reciben tapadera
      p.tasks.clear();
      for (const t of pickTasks(this.random, this.tasksPerPlayer, this.missionPool)) {
        const ts = new TaskState();
        ts.missionId = t.missionId;
        ts.lugares = t.lugares.join(",");
        ts.step = 0;
        ts.steps = t.lugares.length;
        ts.done = false;
        p.tasks.push(ts);
        if (teamOf(role) === "tripulacion") total += ts.steps;
      }
    }
    this.state.tasksTotal = total;
    this.state.tasksDone = 0;
    this.state.bodies.clear();
    this.killers.clear();
    this.revealed.clear();
    this.lastGreet.clear();
    this.extinguish();
    this.state.winner = "";
    this.state.endReason = "";
    for (const c of this.clients) this.refreshView(c);
    void this.lock();
    this.setPhase("partida");
  }

  private kill(client: Client, targetId: string) {
    const killer = this.state.players.get(client.sessionId);
    const target = this.state.players.get(targetId);
    const role = this.roles.get(client.sessionId);
    if (this.state.phase !== "partida" || !killer?.alive || !role || teamOf(role) !== "impostores")
      return this.deny(client, "eliminar", "No puedes eliminar ahora.");
    if (!target?.alive || teamOf(this.roles.get(targetId) ?? "roeno") === "impostores")
      return this.deny(client, "eliminar", "Objetivo no válido.");
    if (this.now() < killer.killReadyAt) return this.deny(client, "eliminar", "Todavía no puedes volver a eliminar.");
    if (Math.hypot(killer.x - target.x, killer.y - target.y) > RULES.killRange) return this.deny(client, "eliminar", "Está demasiado lejos.");

    target.alive = false;
    const body = new BodyState();
    body.x = target.x;
    body.y = target.y;
    body.victimId = targetId;
    body.victimName = target.name;
    body.look = target.look;
    this.state.bodies.set(targetId, body);
    this.killers.set(targetId, client.sessionId);
    killer.killReadyAt = this.now() + this.killCooldownMs;
    // el asesino se coloca sobre la víctima (como en el género)
    killer.x = target.x;
    killer.y = target.y;
    this.checkEnd();
  }

  /** Gitano: se lleva el cuerpo de SU víctima; desaparece y ya no se puede reportar. */
  private carryBody(client: Client, bodyId: string) {
    const p = this.state.players.get(client.sessionId);
    const body = this.state.bodies.get(bodyId);
    if (this.state.phase !== "partida" || !p?.alive || this.roles.get(client.sessionId) !== "gitano")
      return this.deny(client, "llevar", "Solo el Gitano puede llevarse cuerpos.");
    if (!body || this.killers.get(bodyId) !== client.sessionId) return this.deny(client, "llevar", "Solo puedes llevarte a tus víctimas.");
    if (Math.hypot(p.x - body.x, p.y - body.y) > RULES.carryRange) return this.deny(client, "llevar", "Está demasiado lejos.");
    this.state.bodies.delete(bodyId);
  }

  private report(client: Client, bodyId: string) {
    const p = this.state.players.get(client.sessionId);
    const body = this.state.bodies.get(bodyId);
    if (this.state.phase !== "partida" || !p?.alive) return this.deny(client, "reportar", "No puedes reportar ahora.");
    if (!body) return this.deny(client, "reportar", "Ese cuerpo ya no está.");
    if (Math.hypot(p.x - body.x, p.y - body.y) > RULES.reportRange) return this.deny(client, "reportar", "Está demasiado lejos.");
    this.startMeeting(p.name, "cadaver", body.victimName);
  }

  private emergency(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (this.state.phase !== "partida" || !p?.alive) return this.deny(client, "emergencia", "No puedes convocar ahora.");
    if (this.state.sabotage) return this.deny(client, "emergencia", "Hay un incendio: apágalo antes de convocar.");
    const hall = townHallAccess();
    const nearHall = Math.hypot(p.x - hall.x, p.y - hall.y) <= RULES.emergencyRange;
    if (nearHall && p.emergenciesLeft > 0) {
      p.emergenciesLeft--;
      return this.startMeeting(p.name, "emergencia", "");
    }
    this.deny(client, "emergencia", nearHall ? "Ya has usado tu reunión de emergencia." : "Ve al Ayuntamiento para convocar una reunión.");
  }

  // ------------------------------------------------------ roles especiales

  /** Saludar a un jugador cercano (todos). Vilchez además lo deja rastreado para siempre. */
  private greet(client: Client, targetId: string) {
    const p = this.state.players.get(client.sessionId);
    const target = this.state.players.get(targetId);
    if (this.state.phase !== "partida" || !p?.alive || !target?.alive || targetId === client.sessionId)
      return this.deny(client, "saludar", "No puedes saludar ahora.");
    if (Math.hypot(p.x - target.x, p.y - target.y) > RULES.greetRange) return this.deny(client, "saludar", "Está demasiado lejos.");
    const now = this.now();
    if (now - (this.lastGreet.get(client.sessionId) ?? -Infinity) < RULES.greetCooldownMs) return;
    this.lastGreet.set(client.sessionId, now);
    this.broadcast("saludo", { from: client.sessionId, to: targetId });
    if (this.roles.get(client.sessionId) === "vilchez" && !p.trackedId) p.trackedId = targetId;
  }

  /** Pirómano: prende fuego al pueblo. */
  private startFire(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (this.state.phase !== "partida" || !p?.alive || this.roles.get(client.sessionId) !== "piromano")
      return this.deny(client, "incendio", "Solo el Pirómano puede prender fuego.");
    if (this.state.sabotage) return this.deny(client, "incendio", "Ya hay un sabotaje en marcha.");
    const now = this.now();
    if (now < p.fireReadyAt) return this.deny(client, "incendio", "Todavía no puedes prender otro fuego.");
    this.state.sabotage = "incendio";
    this.state.sabotageEndsAt = now + RULES.fireMs;
    this.fireHolds.clear();
    this.state.fireHeld = "";
    p.fireReadyAt = now + RULES.fireMs + RULES.fireCooldownMs;
    for (const [id, pl] of this.state.players) {
      const role = this.roles.get(id);
      if (role && teamOf(role) === "impostores") pl.killReadyAt = Math.max(now, pl.killReadyAt - RULES.fireKillBonusMs);
    }
    this.fireTimer?.clear();
    this.fireTimer = this.clock.setTimeout(() => this.extinguish(), RULES.fireMs);
  }

  /**
   * Apagar: hay que sujetar a la vez los dos puntos (Ayuntamiento y Sagrado Corazón) entre
   * dos jugadores. El Conserje lo apaga él solo desde cualquiera de los dos.
   */
  private holdFirePoint(client: Client, punto: number) {
    const p = this.state.players.get(client.sessionId);
    if (this.state.sabotage !== "incendio" || this.state.phase !== "partida" || !p?.alive) return;
    if (!RULES.firePoints.includes(punto)) return this.deny(client, "apagar", "Ahí no se puede apagar el fuego.");
    const at = poiAccess(punto);
    if (!at || Math.hypot(p.x - at.x, p.y - at.y) > this.fireFixRange) return this.deny(client, "apagar", "Acércate más al punto de agua.");
    if (this.roles.get(client.sessionId) === "conserje") return this.extinguish();
    const now = this.now();
    this.fireHolds.set(punto, { id: client.sessionId, until: now + RULES.fireHoldMs });
    const active = [...this.fireHolds.entries()].filter(([, h]) => h.until > now);
    this.state.fireHeld = active.map(([n]) => n).join(",");
    const holders = new Set(active.map(([, h]) => h.id));
    if (active.length >= RULES.firePoints.length && holders.size >= 2) this.extinguish();
  }

  private extinguish() {
    this.fireTimer?.clear();
    this.fireTimer = null;
    this.fireHolds.clear();
    this.fixers.clear();
    this.fixStarts.clear();
    this.state.sabotageFixes = 0;
    this.state.sabotage = "";
    this.state.sabotageEndsAt = 0;
    this.state.fireHeld = "";
  }

  /** Cualquier impostor: sabotaje crítico. Si no se arregla a tiempo, ganan los impostores. */
  private sabotage(client: Client, kind: string) {
    const p = this.state.players.get(client.sessionId);
    const role = this.roles.get(client.sessionId);
    if (this.state.phase !== "partida" || !p?.alive || !role || teamOf(role) !== "impostores")
      return this.deny(client, "sabotear", "Solo los impostores pueden sabotear.");
    if (!isSabotageKind(kind)) return this.deny(client, "sabotear", "Sabotaje desconocido.");
    if (this.state.sabotage) return this.deny(client, "sabotear", "Ya hay un sabotaje en marcha.");
    const now = this.now();
    if (now < p.sabotageReadyAt) return this.deny(client, "sabotear", "Todavía no puedes sabotear.");
    this.extinguish();
    this.state.sabotage = kind;
    this.state.sabotageEndsAt = now + this.criticalMs;
    for (const [id, pl] of this.state.players) {
      const r = this.roles.get(id);
      if (r && teamOf(r) === "impostores") pl.sabotageReadyAt = now + this.criticalMs + RULES.sabotageCooldownMs;
    }
    this.fireTimer?.clear();
    this.fireTimer = this.clock.setTimeout(() => {
      if (this.state.sabotage !== kind || this.state.phase !== "partida") return;
      this.endGame("impostores", `${SABOTAGES[kind].nombre} y nadie lo arregló a tiempo.`);
    }, this.criticalMs);
  }

  private nearSabotage(p: PlayerState, kind: keyof typeof SABOTAGES) {
    const at = poiAccess(SABOTAGES[kind].lugar);
    return !!at && Math.hypot(p.x - at.x, p.y - at.y) <= this.fixRange;
  }

  private fixStart(client: Client, kind: string) {
    const p = this.state.players.get(client.sessionId);
    if (this.state.phase !== "partida" || !p?.alive || this.state.sabotage !== kind || !isSabotageKind(kind)) return;
    if (!this.nearSabotage(p, kind)) return this.deny(client, "arreglar", "Tienes que estar en el sitio del sabotaje.");
    this.fixStarts.set(client.sessionId, this.now());
  }

  private fix(client: Client, kind: string) {
    const p = this.state.players.get(client.sessionId);
    const started = this.fixStarts.get(client.sessionId);
    if (this.state.phase !== "partida" || !p?.alive || this.state.sabotage !== kind || !isSabotageKind(kind) || started === undefined)
      return this.deny(client, "arreglar", "No hay nada que arreglar.");
    if (this.now() - started < this.fixMinMs * 0.9) return this.deny(client, "arreglar", "Demasiado rápido.");
    if (!this.nearSabotage(p, kind)) return this.deny(client, "arreglar", "Te has alejado del sitio.");
    this.fixStarts.delete(client.sessionId);
    this.fixers.add(client.sessionId);
    this.state.sabotageFixes = this.fixers.size;
    if (this.roles.get(client.sessionId) === "conserje" || this.fixers.size >= RULES.fixesNeeded) {
      this.broadcast("arreglado", { kind, by: p.name });
      this.extinguish();
    }
  }

  /** Ludópata: una tirada por ronda en un bar; con premio se le revela un jugador bueno. */
  private playSlot(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (this.state.phase !== "partida" || !p?.alive || this.roles.get(client.sessionId) !== "ludopata")
      return this.deny(client, "tragaperras", "Solo el Ludópata juega a la tragaperras.");
    if (p.slotUsed) return this.deny(client, "tragaperras", "Ya has jugado esta ronda.");
    const nearBar = RULES.slotBars.some((n) => {
      const at = poiAccess(n);
      return !!at && Math.hypot(p.x - at.x, p.y - at.y) <= MISSION_RANGE;
    });
    if (!nearBar) return this.deny(client, "tragaperras", "La tragaperras está en los bares.");
    p.slotUsed = true;
    const result: SlotResult = { won: false, id: null, name: null };
    if (this.random() < this.slotChance) {
      const seen = this.revealed.get(client.sessionId) ?? new Set<string>();
      const good = [...this.roles.entries()].filter(
        ([id, role]) => id !== client.sessionId && teamOf(role) === "tripulacion" && !seen.has(id) && this.state.players.has(id),
      );
      if (good.length) {
        const [id] = good[Math.floor(this.random() * good.length)];
        seen.add(id);
        this.revealed.set(client.sessionId, seen);
        Object.assign(result, { won: true, id, name: this.state.players.get(id)!.name });
      }
    }
    client.send("premio", result);
  }

  // ----------------------------------------------------------------- misiones

  private findTask(sessionId: string, missionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p) return null;
    for (const t of p.tasks) if (t.missionId === missionId) return { p, t };
    return null;
  }

  private nearStep(p: PlayerState, t: TaskState) {
    const n = Number(t.lugares.split(",")[t.step]);
    const target = poiAccess(n);
    return !!target && Math.hypot(p.x - target.x, p.y - target.y) <= MISSION_RANGE;
  }

  private taskStart(client: Client, missionId: string) {
    const found = this.findTask(client.sessionId, missionId);
    if (this.state.phase !== "partida" || !found || found.t.done) return this.deny(client, "tarea", "No tienes esa misión pendiente.");
    if (!this.nearStep(found.p, found.t)) return this.deny(client, "tarea", "Tienes que estar en el lugar de la misión.");
    this.taskStarts.set(client.sessionId, { missionId, step: found.t.step, at: this.now() });
  }

  private taskFinish(client: Client, missionId: string) {
    const found = this.findTask(client.sessionId, missionId);
    const started = this.taskStarts.get(client.sessionId);
    if (this.state.phase !== "partida" || !found || found.t.done || !started || started.missionId !== missionId || started.step !== found.t.step)
      return this.deny(client, "tarea", "Esa misión no estaba en marcha.");
    const step = missionById(missionId)?.pasos[found.t.step];
    if (!step) return this.deny(client, "tarea", "Misión desconocida.");
    if (this.now() - started.at < step.minMs * 0.9) return this.deny(client, "tarea", "Demasiado rápido.");
    if (!this.nearStep(found.p, found.t)) return this.deny(client, "tarea", "Te has alejado del lugar.");
    this.taskStarts.delete(client.sessionId);
    found.t.step++;
    if (found.t.step >= found.t.steps) found.t.done = true;
    const role = this.roles.get(client.sessionId);
    if (role && teamOf(role) === "tripulacion") {
      found.p.tasksDone++;
      this.state.tasksDone++;
      this.checkEnd();
    }
  }

  private startMeeting(caller: string, reason: string, victim: string) {
    this.taskStarts.clear();
    this.extinguish();
    this.state.meetingCaller = caller;
    this.state.meetingReason = reason;
    this.state.meetingVictim = victim;
    this.state.bodies.clear();
    this.votes.clear();
    const hall = townHallAccess();
    let i = 0;
    for (const p of this.state.players.values()) {
      p.hasVoted = false;
      if (!p.alive) continue;
      const pos = this.ringPoint(hall, i++);
      p.x = pos.x;
      p.y = pos.y;
    }
    this.setPhase("reunion", this.meetingMs, () => this.endMeeting());
  }

  private vote(client: Client, target: string) {
    const p = this.state.players.get(client.sessionId);
    if (this.state.phase !== "reunion" || !p?.alive) return this.deny(client, "votar", "No puedes votar ahora.");
    if (p.hasVoted) return this.deny(client, "votar", "Ya has votado.");
    if (target !== SKIP_VOTE && !this.state.players.get(target)?.alive) return this.deny(client, "votar", "Voto no válido.");
    this.votes.set(client.sessionId, target);
    p.hasVoted = true;
    this.maybeCloseVoting();
  }

  private maybeCloseVoting() {
    const alive = [...this.state.players.values()].filter((p) => p.alive);
    if (alive.length > 0 && alive.every((p) => p.hasVoted)) this.endMeeting();
  }

  private endMeeting() {
    if (this.state.phase !== "reunion") return;
    const aliveIds = new Set([...this.state.players.entries()].filter(([, p]) => p.alive).map(([id]) => id));
    const { ejected, counts } = tallyVotes(this.votes, aliveIds);
    let result: VoteResult = { counts, ejectedId: null, ejectedName: null, ejectedWasImpostor: null };
    if (ejected) {
      const p = this.state.players.get(ejected)!;
      p.alive = false;
      result = { counts, ejectedId: ejected, ejectedName: p.name, ejectedWasImpostor: teamOf(this.roles.get(ejected)!) === "impostores" };
    }
    this.broadcast("resultado-votacion", result);
    this.setPhase("resultado", this.resultMs, () => {
      if (this.checkEnd()) return;
      const now = this.now();
      for (const [id, p] of this.state.players) {
        const role = this.roles.get(id);
        if (role && teamOf(role) === "impostores") p.killReadyAt = now + this.killCooldownMs;
        p.slotUsed = false; // nueva ronda: el Ludópata puede volver a jugar
      }
      this.setPhase("partida");
    });
  }

  /** Comprueba la victoria; si hay ganador, termina la partida. */
  private checkEnd(): boolean {
    if (!this.inGame()) return false;
    const players = [...this.state.players.entries()]
      .filter(([id]) => this.roles.has(id))
      .map(([id, p]) => ({ id, role: this.roles.get(id)!, alive: p.alive }));
    const res = checkWinner(players, this.state.tasksDone, this.state.tasksTotal || Infinity);
    if (!res) return false;
    this.endGame(res.winner, res.reason);
    return true;
  }

  private endGame(winner: Team, reason: string) {
    this.state.winner = winner;
    this.state.endReason = reason;
    const over: GameOver = {
      winner,
      reason,
      roles: [...this.roles.entries()].map(([id, role]) => ({ id, name: this.state.players.get(id)?.name ?? "?", role })),
    };
    this.extinguish();
    this.broadcast("fin", over);
    this.setPhase("fin");
  }

  private backToLobby(client: Client) {
    if (this.state.phase !== "fin") return this.deny(client, "volver", "La partida no ha terminado.");
    if (client.sessionId !== this.state.hostId) return this.deny(client, "volver", "Solo el anfitrión puede volver a la sala.");
    this.roles.clear();
    this.votes.clear();
    this.killers.clear();
    this.state.bodies.clear();
    this.extinguish();
    let i = 0;
    this.state.tasksDone = 0;
    this.state.tasksTotal = 0;
    for (const p of this.state.players.values()) {
      p.tasks.clear();
      p.role = "";
      p.alive = true;
      p.hasVoted = false;
      p.killReadyAt = 0;
      p.specialLeft = false;
      p.trackedId = "";
      p.slotUsed = false;
      p.fireReadyAt = 0;
      p.sabotageReadyAt = 0;
      const pos = this.ringPoint(defaultSpawn(), i++);
      p.x = pos.x;
      p.y = pos.y;
    }
    for (const c of this.clients) this.refreshView(c);
    void this.unlock();
    this.setPhase("sala");
  }

  // ------------------------------------------------------------- utilidades

  private inGame() {
    return this.state.phase === "partida" || this.state.phase === "reunion" || this.state.phase === "resultado";
  }

  private setPhase(phase: Phase, durationMs = 0, onEnd?: () => void) {
    this.phaseTimer?.clear();
    this.phaseTimer = null;
    this.state.phase = phase;
    this.state.phaseEndsAt = durationMs ? this.now() + durationMs : 0;
    if (durationMs && onEnd) this.phaseTimer = this.clock.setTimeout(onEnd, durationMs);
  }

  /** Qué datos secretos ve cada cliente: su rol, y los impostores el de su compañero. */
  private refreshView(client: Client) {
    const view = new StateView();
    const me = this.state.players.get(client.sessionId);
    if (me) view.add(me);
    const myRole = this.roles.get(client.sessionId);
    if (myRole && teamOf(myRole) === "impostores") {
      for (const [id, role] of this.roles) {
        const p = this.state.players.get(id);
        if (p && id !== client.sessionId && teamOf(role) === "impostores") view.add(p);
      }
    }
    client.view = view;
  }

  private deny(client: Client, action: string, reason: string) {
    client.send("denegado", { action, reason });
  }

  private handleMove(client: Client, msg: { x: number; y: number }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || typeof msg?.x !== "number" || typeof msg?.y !== "number") return;
    const now = this.now();
    const elapsed = now - (this.lastMoveAt.get(client.sessionId) ?? now);
    this.lastMoveAt.set(client.sessionId, now);
    // durante reuniones y resultados nadie se mueve
    if (this.state.phase === "reunion" || this.state.phase === "resultado") {
      client.send("corrected", { x: p.x, y: p.y });
      return;
    }
    // Saldo de distancia: se recarga a un 30 % más de la velocidad máxima y se guarda hasta
    // 1 s de recorrido, para absorber mensajes que la red entrega a trompicones.
    const cap = PLAYER_SPEED * 1.0 + 16;
    const budget = Math.min(cap, (this.moveBudget.get(client.sessionId) ?? 24) + (PLAYER_SPEED * 1.3 * Math.max(0, elapsed)) / 1000);
    const result = validateMoveWithin({ x: p.x, y: p.y }, { x: msg.x, y: msg.y }, budget, PLAYER_RADIUS);
    this.moveBudget.set(client.sessionId, Math.max(0, budget - result.used));
    p.x = result.position.x;
    p.y = result.position.y;
    if (!result.accepted) {
      this.rejectedMoves.set(client.sessionId, (this.rejectedMoves.get(client.sessionId) ?? 0) + 1);
      client.send("corrected", { x: p.x, y: p.y });
    }
  }

  private setHost(sessionId: string) {
    this.state.players.forEach((pl, id) => (pl.isHost = id === sessionId));
    this.state.hostId = sessionId;
  }

  private pickNewHost() {
    let best: string | null = null;
    let bestAt = Infinity;
    this.state.players.forEach((pl, id) => {
      const score = pl.joinedAt + (pl.connected ? 0 : 1e13);
      if (score < bestAt) {
        bestAt = score;
        best = id;
      }
    });
    if (best) this.setHost(best);
    else this.state.hostId = "";
  }

  /** Color de camiseta: el pedido si está libre; si no, el siguiente libre (para distinguir a todos). */
  private freeLook(wanted: number, sessionId: string) {
    const taken = new Set<number>();
    this.state.players.forEach((pl, id) => id !== sessionId && taken.add(pl.look));
    for (let i = 0; i < LOOK_COUNT; i++) {
      const look = (wanted + i) % LOOK_COUNT;
      if (!taken.has(look)) return look;
    }
    return wanted; // más de 8 jugadores: se repiten colores
  }

  private uniqueName(name: string, sessionId: string) {
    const taken = new Set<string>();
    this.state.players.forEach((pl, id) => id !== sessionId && taken.add(pl.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 100; i++) {
      const candidate = `${name.slice(0, 13)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return name;
  }

  /** Reparte posiciones en corro alrededor de un punto, siempre sobre la calle. */
  private ringPoint(center: Vec2, index: number): Vec2 {
    if (index === 0) return center;
    const ring = 1 + Math.floor((index - 1) / 8);
    const angle = (index * 2 * Math.PI) / 8 + ring * 0.4;
    const candidate = { x: center.x + Math.cos(angle) * 30 * ring, y: center.y + Math.sin(angle) * 30 * ring };
    return validateMove(center, candidate, 1000, PLAYER_SPEED, PLAYER_RADIUS).position;
  }
}
