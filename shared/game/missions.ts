/**
 * Misiones de La Roda City. Cada paso ocurre en un lugar numerado del dibujo
 * del usuario (pointsOfInterest). Las misiones cuyo lugar no está en el dibujo
 * se definen con `pendiente` y NO se asignan hasta que se ubique ese lugar.
 *
 * El servidor valida: estar cerca del lugar (MISSION_RANGE) y haber dedicado al
 * minijuego al menos `minMs`. El minijuego en sí ocurre en el cliente.
 */
export type MiniGame =
  | "mantener"
  | "deslizar"
  | "frotar"
  | "tocar"
  | "lanzar"
  | "penalti"
  | "estanco"
  | "contar"
  | "cortar"
  | "cubata";

export type MissionStep = {
  /** Número del lugar en el dibujo. Si hay varios, se elige uno al azar para cada jugador. */
  lugares: number[];
  texto: string;
  juego: MiniGame;
  minMs: number;
};

export type Mission = {
  id: string;
  nombre: string;
  pasos: MissionStep[];
  /** Si existe, la misión no se asigna: falta ubicar un lugar. */
  pendiente?: string;
};

export const MISSION_RANGE = 95;

export const MISSIONS: Mission[] = [
  {
    id: "rezar",
    nombre: "Rezar ante la estatua",
    pasos: [{ lugares: [17], texto: "Mantén pulsado para rezar ante la estatua del Sagrado Corazón.", juego: "mantener", minMs: 3000 }],
  },
  {
    id: "tren",
    nombre: "Pasar la tarjeta del tren",
    pasos: [{ lugares: [26], texto: "Desliza la tarjeta por el lector a velocidad constante.", juego: "deslizar", minMs: 1500 }],
  },
  {
    id: "pelo",
    nombre: "Barrer el pelo",
    pasos: [{ lugares: [30], texto: "Barre todos los mechones del suelo de la Peluquería Adri.", juego: "frotar", minMs: 2500 }],
  },
  {
    id: "parque",
    nombre: "Peces y canasta en los parques",
    pasos: [
      // los peces están en el estanque del Parque Peces (corrección de Joaquín, 22-10-2026)
      { lugares: [1], texto: "Echa comida a los peces del Parque Peces (toca el estanque 6 veces).", juego: "tocar", minMs: 1500 },
      { lugares: [27], texto: "En el Parque Europa, encesta: suelta cuando la barra esté en la zona verde.", juego: "lanzar", minMs: 1000 },
    ],
  },
  {
    id: "penalti",
    nombre: "Tirar penaltis en Carmelita",
    pasos: [
      {
        lugares: [10],
        texto: "Marca 3 penaltis: tira cuando el portero esté lejos del sitio al que apuntas.",
        juego: "penalti",
        minMs: 2500,
      },
    ],
  },
  {
    id: "tabaco",
    nombre: "Atender el estanco",
    pasos: [
      {
        lugares: [12],
        texto: "Busca en el expositor el tabaco que pide el cliente y cóbrale el importe exacto.",
        juego: "estanco",
        minMs: 2500,
      },
    ],
  },
  {
    id: "pastillas",
    nombre: "Las pastillas",
    pasos: [
      { lugares: [23], texto: "Recoge la receta en esta farmacia y cuenta las pastillas.", juego: "contar", minMs: 2000 },
      { lugares: [24], texto: "Lleva la receta a la otra farmacia y cuenta las pastillas.", juego: "contar", minMs: 2000 },
    ],
  },
  {
    id: "platos",
    nombre: "Fregar platos",
    pasos: [{ lugares: [4, 5, 9], texto: "Frota el plato hasta dejarlo limpio.", juego: "frotar", minMs: 2500 }],
  },
  {
    id: "kebab",
    nombre: "Cortar kebab",
    pasos: [{ lugares: [3], texto: "Corta el kebab de arriba abajo (4 cortes).", juego: "cortar", minMs: 1500 }],
  },
  {
    id: "cubata",
    nombre: "El cubata",
    pasos: [
      {
        lugares: [28],
        texto: "Prepara el cubata en Jiami: hielo, ron hasta la primera marca y refresco hasta la segunda.",
        juego: "cubata",
        minMs: 2500,
      },
      {
        lugares: [29],
        texto: "Desliza el cubata por la barra de Madishon hasta el cliente, sin derramarlo.",
        juego: "deslizar",
        minMs: 1500,
      },
    ],
  },
  {
    id: "puertas",
    nombre: "Limpiar las puertas de Calle Rosa",
    pasos: [],
    pendiente: "Falta saber qué calle del trazado es Calle Rosa (números 4 y 5).",
  },
  {
    id: "camaras",
    nombre: "Cámaras de seguridad",
    pasos: [],
    pendiente: "Falta ubicar la Casa de la Juventud.",
  },
];

export const ACTIVE_MISSIONS = MISSIONS.filter((m) => !m.pendiente && m.pasos.length > 0);
export const TASKS_PER_PLAYER = 4;

/** Paso concreto asignado a un jugador (el lugar ya elegido). */
export type AssignedTask = { missionId: string; lugares: number[]; step: number };

/** Elige misiones distintas para un jugador y fija el lugar de cada paso. */
export function pickTasks(random: () => number, count = TASKS_PER_PLAYER, only?: string[]): AssignedTask[] {
  const pool = ACTIVE_MISSIONS.filter((m) => !only || only.includes(m.id));
  const out: AssignedTask[] = [];
  while (out.length < count && pool.length) {
    const m = pool.splice(Math.floor(random() * pool.length), 1)[0];
    out.push({ missionId: m.id, lugares: m.pasos.map((p) => p.lugares[Math.floor(random() * p.lugares.length)]), step: 0 });
  }
  return out;
}

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
