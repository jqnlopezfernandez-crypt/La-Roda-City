import { MOVE_SEND_INTERVAL_MS, ROOM_NAME, normalizeCode } from "../../shared/net/protocol";
import { Callbacks, Client, type Room } from "@colyseus/sdk";

// ---------------------------------------------------------------------------
// Tipos mínimos del estado sincronizado y de los mensajes del servidor.
// (Reflejan los esquemas de shared/net/protocol.ts; se definen aquí para no
// depender de cómo se tipen allí.)

/** Colección sincronizada (MapSchema) tal como la usa el cliente. */
export interface SyncedMap<V> {
  get(key: string): V | undefined;
  forEach(cb: (value: V, key: string) => void): void;
}

/** Misión asignada (secreta: solo la ve su jugador). */
export interface TaskStateView {
  missionId: string;
  /** Lugares (n.º del dibujo) de cada paso, separados por comas. */
  lugares: string;
  step: number;
  steps: number;
  done: boolean;
}

export interface PlayerStateView {
  name: string;
  x: number;
  y: number;
  look: number;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  hasVoted: boolean;
  role?: string;
  killReadyAt?: number;
  specialLeft?: boolean;
  emergenciesLeft?: number;
  tasks?: Iterable<TaskStateView>;
}

export interface BodyStateView {
  x: number;
  y: number;
  victimName: string;
  look: number;
}

export interface GameStateView {
  code: string;
  phase: string;
  hostId: string;
  players: SyncedMap<PlayerStateView>;
  bodies: SyncedMap<BodyStateView>;
  meetingCaller: string;
  meetingReason: string;
  meetingVictim: string;
  phaseEndsAt: number;
  serverTime: number;
  tasksDone: number;
  tasksTotal: number;
}

export type VoteResult = {
  counts: Record<string, number>;
  ejectedId: string | null;
  ejectedName: string | null;
  ejectedWasImpostor: boolean | null;
};
export type GameOver = { winner: string; reason: string; roles: { id: string; name: string; role: string }[] };
/** Respuesta de error a una acción no permitida (para mostrar un aviso). */
export type ActionDenied = { action: string; reason: string };

// ---------------------------------------------------------------------------

/**
 * Dirección del servidor de juego. En producción viene de VITE_SERVER_URL (p. ej.
 * wss://la-roda-servidor.onrender.com); en desarrollo, el propio Vite reenvía
 * /servidor-juego al puerto 2567 (ver vite.config.ts) y se usa el mismo origen.
 */
export function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host || "localhost:5173"}/servidor-juego`;
}

const TOKEN_KEY = "laroda.reconnectionToken";
const safeStorage = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      /* navegación privada: sin persistencia */
    }
  },
};

export type RemotePlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  look: number;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  hasVoted: boolean;
  /** Vacío salvo para uno mismo (y compañeros impostores). */
  role: string;
  killReadyAt: number;
  specialLeft: boolean;
  emergenciesLeft: number;
};

export type Body = { id: string; x: number; y: number; victimName: string; look: number };

export type NetStatus = "conectado" | "reconectando" | "desconectado";

type Listener = {
  onAdd(p: RemotePlayer): void;
  onRemove(id: string): void;
  onChange(p: RemotePlayer): void;
  onCorrected(pos: { x: number; y: number }): void;
  onStatus(status: NetStatus): void;
  onPhase(phase: string): void;
  onBodyAdd(b: Body): void;
  onBodyRemove(id: string): void;
  onDenied(d: ActionDenied): void;
  onVoteResult(v: VoteResult): void;
  onGameOver(g: GameOver): void;
};

type GameRoom = Room<any, GameStateView>;

/** Parte de los callbacks de estado de Colyseus que se usa aquí (sus tipos genéricos no encajan con un estado sin esquema). */
interface StateCallbacks {
  onAdd(collection: string, handler: (value: any, key: string) => void): void;
  onRemove(collection: string, handler: (value: any, key: string) => void): void;
  onChange(instance: object, handler: () => void): void;
  listen(property: string, handler: (value: any) => void): void;
}

/** Conexión a una sala: une el estado del servidor con la escena del juego. */
export class NetSession {
  private lastSent = { x: NaN, y: NaN };
  private lastSentAt = 0;
  private listener: Partial<Listener> = {};
  /** Diferencia estimada entre el reloj del servidor y el local (ms). */
  private clockOffset = 0;
  private hasClock = false;
  readonly room: GameRoom;

  private constructor(room: GameRoom) {
    this.room = room;
    safeStorage.set(TOKEN_KEY, room.reconnectionToken);
    room.onLeave(() => this.listener.onStatus?.("desconectado"));
    room.onDrop(() => this.listener.onStatus?.("reconectando"));
    room.onReconnect(() => {
      safeStorage.set(TOKEN_KEY, room.reconnectionToken);
      this.listener.onStatus?.("conectado");
    });
    room.onMessage("corrected", (pos: { x: number; y: number }) => this.listener.onCorrected?.(pos));
    room.onMessage("denegado", (d: ActionDenied) => this.listener.onDenied?.(d));
    room.onMessage("resultado-votacion", (v: VoteResult) => this.listener.onVoteResult?.(v));
    room.onMessage("fin", (g: GameOver) => this.listener.onGameOver?.(g));
  }

  static async create(name: string, look: number) {
    const client = new Client(serverUrl());
    return new NetSession(await client.create<GameStateView>(ROOM_NAME, { name, look }));
  }

  static async join(code: string, name: string, look: number) {
    const client = new Client(serverUrl());
    return new NetSession(await client.joinById<GameStateView>(normalizeCode(code), { name, look }));
  }

  /** Tras recargar la página, intenta volver a la misma sala con el mismo jugador. */
  static async resume(): Promise<NetSession | null> {
    const token = safeStorage.get(TOKEN_KEY);
    if (!token) return null;
    try {
      const client = new Client(serverUrl());
      return new NetSession(await client.reconnect<GameStateView>(token));
    } catch {
      safeStorage.set(TOKEN_KEY, null);
      return null;
    }
  }

  get sessionId() {
    return this.room.sessionId;
  }

  get code() {
    return this.room.state.code || this.room.roomId;
  }

  /** Conecta la escena con el estado sincronizado. */
  bind(listener: Partial<Listener>) {
    this.listener = listener;
    const cb = Callbacks.get(this.room as Room<any, any>) as unknown as StateCallbacks;
    const snapshot = (p: PlayerStateView, id: string): RemotePlayer => ({
      id,
      name: p.name,
      x: p.x,
      y: p.y,
      look: p.look,
      isHost: p.isHost,
      connected: p.connected,
      alive: p.alive,
      hasVoted: p.hasVoted,
      role: p.role ?? "",
      killReadyAt: p.killReadyAt ?? 0,
      specialLeft: !!p.specialLeft,
      emergenciesLeft: p.emergenciesLeft ?? 0,
    });
    cb.onAdd("players", (p: PlayerStateView, id: string) => {
      listener.onAdd?.(snapshot(p, id));
      cb.onChange(p, () => listener.onChange?.(snapshot(p, id)));
    });
    cb.onRemove("players", (_p: PlayerStateView, id: string) => listener.onRemove?.(id));
    cb.onAdd("bodies", (b: BodyStateView, id: string) =>
      listener.onBodyAdd?.({ id, x: b.x, y: b.y, victimName: b.victimName, look: b.look }),
    );
    cb.onRemove("bodies", (_b: BodyStateView, id: string) => listener.onBodyRemove?.(id));
    cb.listen("phase", (phase: string) => listener.onPhase?.(phase));
    cb.listen("serverTime", (t: number) => {
      // Cada muestra llega con retraso (red + proceso), así que subestima la hora
      // del servidor: la MAYOR diferencia observada es la más fiable. Se deja
      // bajar despacio por si el reloj local se adelanta.
      const offset = t - Date.now();
      this.clockOffset = this.hasClock ? Math.max(this.clockOffset - 20, offset) : offset;
      this.hasClock = true;
    });
    listener.onStatus?.("conectado");
  }

  /** Envía la posición local como máximo cada MOVE_SEND_INTERVAL_MS y solo si cambió. */
  sendPosition(x: number, y: number, now: number) {
    if (now - this.lastSentAt < MOVE_SEND_INTERVAL_MS) return;
    if (Math.abs(x - this.lastSent.x) < 0.5 && Math.abs(y - this.lastSent.y) < 0.5) return;
    this.lastSent = { x, y };
    this.lastSentAt = now;
    this.room.send("move", { x, y });
  }

  /** Hora estimada del servidor. */
  serverNow() {
    return Date.now() + this.clockOffset;
  }

  get state() {
    return this.room.state;
  }

  send(type: "empezar" | "emergencia" | "volver"): void;
  send(type: "eliminar", payload: { target: string }): void;
  send(type: "llevar" | "reportar", payload: { body: string }): void;
  send(type: "votar", payload: { target: string }): void;
  send(type: "tarea-inicio" | "tarea-fin", payload: { mission: string }): void;
  send(type: string, payload?: unknown) {
    this.room.send(type, payload);
  }

  async leave() {
    safeStorage.set(TOKEN_KEY, null);
    await this.room.leave(true);
  }
}
