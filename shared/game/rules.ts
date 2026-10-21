/**
 * Reglas de La Roda City (lógica pura, sin red): la usa el servidor como
 * autoridad y las pruebas para verificarla. El cliente solo la usa para mostrar
 * textos; nunca decide resultados.
 */

export type Role = "sapo" | "gitano" | "piromano" | "roeno" | "vilchez" | "conserje" | "ludopata";
export type Team = "impostores" | "tripulacion";

export const ROLE_INFO: Record<Role, { nombre: string; equipo: Team; descripcion: string }> = {
  sapo: {
    nombre: "Sapo",
    equipo: "impostores",
    descripcion: "Impostor. Elimina a los vecinos sin que te descubran.",
  },
  gitano: {
    nombre: "Gitano",
    equipo: "impostores",
    descripcion: "Impostor. Tras eliminar a alguien puedes llevarte su cuerpo para que nadie lo reporte.",
  },
  piromano: {
    nombre: "Pirómano",
    equipo: "impostores",
    descripcion: "Impostor. Prende fuego al pueblo: el humo ciega a los vecinos y puedes volver a eliminar antes.",
  },
  roeno: {
    nombre: "Roeño",
    equipo: "tripulacion",
    descripcion: "Vecino. Haz tus misiones, arregla los sabotajes y descubre a los impostores.",
  },
  vilchez: {
    nombre: "Vilchez",
    equipo: "tripulacion",
    descripcion: "Vecino. Saluda a un vecino y lo tendrás localizado en tu minimapa toda la partida.",
  },
  conserje: {
    nombre: "Conserje",
    equipo: "tripulacion",
    descripcion: "Vecino. Apagas los incendios y arreglas los sabotajes tú solo, sin ayuda de nadie.",
  },
  ludopata: {
    nombre: "Ludópata",
    equipo: "tripulacion",
    descripcion: "Vecino. Una vez por ronda juega a la tragaperras de un bar: si toca premio (15 %), sabrás de alguien que es de los buenos.",
  },
};

/** Sabotajes críticos: dónde se arreglan (n.º del dibujo) y cómo se anuncian. */
export const SABOTAGES = {
  cabeza: { lugar: 17, nombre: "Han cortado la cabeza al Sagrado Corazón", arreglo: "Vuelve a ponerle la cabeza" },
  piscina: { lugar: 31, nombre: "Alguien se ha cagado en la piscina", arreglo: "Saca las cacas con el salabre" },
  riada: { lugar: 16, nombre: "Riada en el Puente Erillas", arreglo: "Tapona el puente con sacos" },
} as const;
export type SabotageKind = keyof typeof SABOTAGES;
export const isSabotageKind = (k: string): k is SabotageKind => k in SABOTAGES;

export const IMPOSTOR_ROLES: Role[] = ["sapo", "gitano", "piromano"];
export const SPECIAL_CREW_ROLES: Role[] = ["vilchez", "conserje", "ludopata"];

export const teamOf = (r: Role): Team => ROLE_INFO[r].equipo;

export const RULES = {
  minPlayers: 4,
  /** Impostores según el número de jugadores. */
  impostorsFor: (n: number) => (n >= 7 ? 2 : 1),
  killRange: 120,
  reportRange: 120,
  carryRange: 120,
  /** Distancia al botón del Ayuntamiento para convocar reunión de emergencia. */
  emergencyRange: 90,
  killCooldownMs: 25_000,
  firstKillCooldownMs: 15_000,
  emergenciesPerPlayer: 1,
  meetingMs: 75_000,
  /** Saludar (todos pueden; Vilchez además rastrea al saludado). */
  greetRange: 140,
  greetCooldownMs: 4_000,
  /** Incendio del Pirómano. */
  fireFirstMs: 20_000,
  fireCooldownMs: 45_000,
  fireMs: 40_000,
  /** Al prender fuego, los impostores pueden volver a eliminar este tiempo antes. */
  fireKillBonusMs: 12_000,
  /** Puntos para apagar el fuego (n.º del dibujo): Plaza del Ayuntamiento y del Sagrado Corazón. */
  firePoints: [11, 17],
  fireFixRange: 120,
  /** Una pulsación de "apagar" vale este tiempo (el cliente la repite mientras se sigue apagando). */
  fireHoldMs: 1_600,
  /** Sabotajes críticos (cualquier impostor): hay que arreglarlos antes de que acabe el tiempo. */
  sabotageFirstMs: 25_000,
  sabotageCooldownMs: 35_000,
  criticalMs: 40_000,
  /** Tiempo mínimo del minijuego de arreglo (lo valida el servidor). */
  fixMinMs: 2_000,
  /** Arreglos necesarios (de jugadores distintos); el Conserje lo arregla él solo. */
  fixesNeeded: 2,
  /** Tragaperras del Ludópata: bares del dibujo y probabilidad de premio. */
  slotBars: [4, 5, 9, 19, 28, 29],
  slotChance: 0.15,
  /** Tras la reunión, pausa antes de volver a jugar (para leer el resultado). */
  resultMs: 5_000,
};

/** Generador pseudoaleatorio con semilla (mulberry32), reproducible en pruebas. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Reparte roles en secreto.
 *  - 1 impostor hasta 6 jugadores, 2 desde 7; cada uno con un rol distinto (Sapo, Gitano, Pirómano).
 *  - Entre los vecinos, hasta 3 roles especiales distintos (Vilchez, Conserje, Ludópata),
 *    dejando siempre al menos un Roeño básico.
 */
export function assignRoles(playerIds: string[], random: () => number = Math.random): Map<string, Role> {
  if (playerIds.length < RULES.minPlayers) throw new Error(`Hacen falta al menos ${RULES.minPlayers} jugadores`);
  const order = shuffle(playerIds, random);
  const nImp = RULES.impostorsFor(playerIds.length);
  const roles = new Map<string, Role>();
  const impostorRoles = shuffle(IMPOSTOR_ROLES, random);
  order.slice(0, nImp).forEach((id, i) => roles.set(id, impostorRoles[i % impostorRoles.length]));
  const crew = order.slice(nImp);
  const specials = shuffle(SPECIAL_CREW_ROLES, random).slice(0, Math.max(0, Math.min(SPECIAL_CREW_ROLES.length, crew.length - 1)));
  crew.forEach((id, i) => roles.set(id, specials[i] ?? "roeno"));
  return roles;
}

export type Alive = { id: string; role: Role; alive: boolean };

/**
 * Comprueba si alguien ha ganado.
 *  - Vecinos: no queda ningún impostor vivo, o se han completado todas las misiones.
 *  - Impostores: hay tantos impostores vivos como vecinos vivos (o más).
 */
export function checkWinner(players: Alive[], tasksDone = 0, tasksTotal = Infinity): { winner: Team; reason: string } | null {
  const alive = players.filter((p) => p.alive);
  const imp = alive.filter((p) => teamOf(p.role) === "impostores").length;
  const crew = alive.length - imp;
  if (imp === 0) return { winner: "tripulacion", reason: "Todos los impostores han sido descubiertos." };
  if (imp >= crew) return { winner: "impostores", reason: "Los impostores ya son tantos como los vecinos." };
  if (tasksTotal > 0 && tasksDone >= tasksTotal) return { winner: "tripulacion", reason: "Los vecinos han completado todas las misiones." };
  return null;
}

export const SKIP_VOTE = "saltar";

/**
 * Recuento de votos. Solo cuentan los votos de jugadores vivos hacia jugadores
 * vivos (o "saltar"). Sale expulsado el más votado si supera estrictamente a
 * cualquier otra opción, incluida "saltar". Empate o mayoría de "saltar": nadie.
 */
export function tallyVotes(votes: Map<string, string>, aliveIds: Set<string>): { ejected: string | null; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const [voter, target] of votes) {
    if (!aliveIds.has(voter)) continue;
    if (target !== SKIP_VOTE && !aliveIds.has(target)) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return { ejected: null, counts };
  const [top, n] = sorted[0];
  const tie = sorted.length > 1 && sorted[1][1] === n;
  if (tie || top === SKIP_VOTE) return { ejected: null, counts };
  return { ejected: top, counts };
}
