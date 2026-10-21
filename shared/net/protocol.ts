/**
 * Protocolo de red compartido entre el servidor Colyseus y el cliente.
 * El estado se define con el "builder" de @colyseus/schema (sin decoradores).
 */
import { schema, t, type SchemaType } from "@colyseus/schema";

export const ROOM_NAME = "partida";
export const MAX_PLAYERS = 12;
/** Segundos que se guarda el sitio a un jugador que pierde la conexión. */
export const RECONNECT_SECONDS = 45;
/** Velocidad máxima de movimiento (px de mundo por segundo). Debe coincidir con el cliente. */
export const PLAYER_SPEED = 230;
export const PLAYER_RADIUS = 10;
/** Número de aspectos (colores de chaqueta y boina) disponibles. */
export const LOOK_COUNT = 12;
/** Frecuencia con la que el cliente envía su posición (ms). */
export const MOVE_SEND_INTERVAL_MS = 50;

/**
 * Fases de la sala:
 *  sala      → esperando jugadores (el anfitrión puede empezar)
 *  partida   → jugando
 *  reunion   → discusión y votación
 *  resultado → se muestra el resultado de la votación unos segundos
 *  fin       → partida terminada (el anfitrión puede volver a la sala)
 */
export type Phase = "sala" | "partida" | "reunion" | "resultado" | "fin";

/** Misión asignada a un jugador (secreta: solo la ve él). */
export const TaskState = schema(
  {
    missionId: t.string(),
    /** Lugares (n.º del dibujo) de cada paso, separados por comas. */
    lugares: t.string(),
    step: t.uint8(),
    steps: t.uint8(),
    done: t.boolean(),
  },
  "TaskState",
);
export type TaskState = SchemaType<typeof TaskState>;

export const PlayerState = schema(
  {
    name: t.string(),
    x: t.number(),
    y: t.number(),
    look: t.uint8(),
    isHost: t.boolean(),
    connected: t.boolean(),
    joinedAt: t.number(),
    alive: t.boolean(),
    hasVoted: t.boolean(),
    /** SECRETO: solo lo recibe el propio jugador (y sus compañeros impostores). */
    role: t.string().view(),
    /** SECRETO: momento (ms del servidor) en que el impostor puede volver a eliminar. */
    killReadyAt: t.number().view(),
    /** SECRETO: le queda la reunión especial (ya no se usa; se mantiene por compatibilidad). */
    specialLeft: t.boolean().view(),
    /** SECRETO (Vilchez): jugador saludado que sigue localizado en el minimapa. */
    trackedId: t.string().view(),
    /** SECRETO (Pirómano): cuándo puede volver a prender fuego. */
    fireReadyAt: t.number().view(),
    /** SECRETO (impostores): cuándo pueden volver a sabotear. */
    sabotageReadyAt: t.number().view(),
    /** SECRETO (Ludópata): ya ha jugado a la tragaperras esta ronda. */
    slotUsed: t.boolean().view(),
    emergenciesLeft: t.uint8(),
    tasksDone: t.uint8(),
    /** SECRETO: misiones del jugador. Los impostores reciben misiones falsas de tapadera. */
    tasks: t.array(TaskState).view(),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const BodyState = schema(
  {
    x: t.number(),
    y: t.number(),
    victimId: t.string(),
    victimName: t.string(),
    look: t.uint8(),
  },
  "BodyState",
);
export type BodyState = SchemaType<typeof BodyState>;

export const GameState = schema(
  {
    code: t.string(),
    phase: t.string(),
    hostId: t.string(),
    players: t.map(PlayerState),
    bodies: t.map(BodyState),
    /** Reunión en curso */
    meetingCaller: t.string(),
    meetingReason: t.string(),
    meetingVictim: t.string(),
    phaseEndsAt: t.number(),
    /** Hora del servidor (ms), actualizada cada segundo: el cliente calcula cuentas atrás sin fiarse de su reloj. */
    serverTime: t.number(),
    /** Fin de partida */
    winner: t.string(),
    endReason: t.string(),
    /** Sabotaje en curso ("" o "incendio") y cuándo se apaga solo. */
    sabotage: t.string(),
    sabotageEndsAt: t.number(),
    /** Arreglos hechos del sabotaje crítico en curso (hacen falta 2, o 1 del Conserje). */
    sabotageFixes: t.uint8(),
    /** Puntos de apagado que alguien está sujetando ahora (n.º del dibujo, separados por comas). */
    fireHeld: t.string(),
    /** Misiones (fase 5) */
    tasksDone: t.uint16(),
    tasksTotal: t.uint16(),
  },
  "GameState",
);
export type GameState = SchemaType<typeof GameState>;

/** Mensajes cliente → servidor. El servidor valida cada uno. */
export type ClientMessages = {
  move: { x: number; y: number };
  rename: { name: string };
  look: { look: number };
  empezar: void;
  eliminar: { target: string };
  llevar: { body: string };
  reportar: { body: string };
  emergencia: void;
  votar: { target: string };
  volver: void;
  "tarea-inicio": { mission: string };
  "tarea-fin": { mission: string };
  saludar: { target: string };
  incendio: void;
  apagar: { punto: number };
  tragaperras: void;
  sabotear: { kind: string };
  "arreglar-inicio": { kind: string };
  arreglar: { kind: string };
};

/** Saludo entre dos jugadores (lo ven todos). */
export type Greeting = { from: string; to: string };
/** Resultado de la tragaperras (solo al Ludópata). */
export type SlotResult = { won: boolean; id: string | null; name: string | null };

/** Mensajes servidor → cliente. */
export type VoteResult = {
  counts: Record<string, number>;
  ejectedId: string | null;
  ejectedName: string | null;
  ejectedWasImpostor: boolean | null;
};
export type GameOver = { winner: string; reason: string; roles: { id: string; name: string; role: string }[] };
/** Respuesta de error a una acción no permitida (para mostrar un aviso). */
export type ActionDenied = { action: string; reason: string };

/** Opciones al crear o unirse a una sala. */
export type JoinOptions = { name?: string; look?: number };

/** Códigos de invitación: sin letras ni números que se confundan (0/O, 1/I/L). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** Limpia el nombre visible: 1–16 caracteres imprimibles, sin espacios repetidos. */
export function sanitizeName(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  return s || "Vecino";
}
