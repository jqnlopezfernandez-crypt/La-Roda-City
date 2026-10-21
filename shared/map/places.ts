/**
 * Zonas transitables que no son calle (plazas, parques, campo de fútbol, entradas)
 * y sus obstáculos, en PÍXELES DEL TRAZADO.
 *
 * Las calles salen del trazado del usuario; estas zonas se dibujaron a partir de sus
 * indicaciones y de las capturas de Apple Maps. `aproximada: true` significa que la
 * forma no está medida con precisión y se puede corregir sin tocar las calles.
 */
export type AreaShape = { circulo: { x: number; y: number; r: number } } | { poligono: [number, number][] };
/** Obstáculo redondo (x, y, r) o poligonal (`poligono`, entonces x/y/r se ignoran salvo para colocar decorado). */
export type AreaObstacle = {
  x: number;
  y: number;
  r: number;
  tipo: "estatua" | "estanque" | "banco" | "vaso" | "edificio" | "templete" | string;
  poligono?: [number, number][];
};
/**
 * Pista o campo dibujado dentro de la zona: rectángulo alineado (`r` = x0, y0, x1, y1) o
 * cuadrilátero girado (`q` = 4 esquinas en orden; el lado q0→q1 es el "ancho" del dibujo).
 */
export type Court = { tipo: string; r?: [number, number, number, number]; q?: [number, number][] };

export type Area = {
  id: string;
  nombre: string;
  tipo: "entrada" | "plaza" | "campo" | "parque" | "piscina" | string;
  /** Número del punto de interés al que pertenece. */
  lugar: number;
  forma: AreaShape;
  obstaculos: AreaObstacle[];
  /** Pistas o campos dibujados dentro. */
  pistas?: Court[];
  aproximada: boolean;
  metodo: string;
};

/** Rectángulo [x0, y0, x1, y1] → polígono. */
const rectPolygon = ([x0, y0, x1, y1]: [number, number, number, number]): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** Cuadrilátero de una pista como polígono (para pruebas y colisiones de decorado). */
export function courtPolygon(c: Court): [number, number][] {
  return c.q ?? rectPolygon(c.r!);
}

/** Centroide simple de un polígono del trazado. */
const centroid = (pts: [number, number][]) => ({
  x: pts.reduce((s, p) => s + p[0], 0) / pts.length,
  y: pts.reduce((s, p) => s + p[1], 0) / pts.length,
});

/** Obstáculo poligonal con su centro calculado. */
const polyObstacle = (tipo: string, pts: [number, number][]): AreaObstacle => ({ ...centroid(pts), r: 0, tipo, poligono: pts });

const SATELITE = "captura de satélite del usuario (21-10-2026) con el perímetro en naranja, registrada sobre la captura de Apple Maps";

export const AREAS: Area[] = [
  {
    id: "ayuntamiento-entrada",
    nombre: "Entrada del Ayuntamiento",
    tipo: "entrada",
    lugar: 11,
    forma: { circulo: { x: 496.5, y: 749.6, r: 8 } },
    obstaculos: [],
    aproximada: true,
    metodo: "círculo de 8 px centrado algo detrás del punto 11, para que se pueda entrar unos pasos",
  },
  {
    id: "sagrado-corazon",
    nombre: "Plaza del Sagrado Corazón",
    tipo: "plaza",
    lugar: 17,
    forma: { circulo: { x: 374.9, y: 829.6, r: 24 } },
    obstaculos: [{ x: 374.9, y: 829.6, r: 2.6, tipo: "estatua" }],
    aproximada: true,
    metodo: "plaza circular centrada en el punto 17 (estatua de Cristo en medio) y unida a la calle",
  },
  {
    id: "campo-carmelita",
    nombre: "Campo de fútbol Carmelita",
    tipo: "campo",
    lugar: 10,
    forma: { poligono: rectPolygon([252, 335, 329, 439]) },
    obstaculos: [],
    pistas: [{ tipo: "futbol", r: [254, 347, 311, 437] }],
    aproximada: false,
    metodo: "campo verde medido sobre la captura de Apple Maps (±2 px); recinto ampliado hasta el perímetro naranja de la " + SATELITE,
  },
  {
    id: "campo-carmelita-entrada",
    nombre: "Entrada del campo Carmelita",
    tipo: "entrada",
    lugar: 10,
    forma: { poligono: rectPolygon([300, 410, 346, 432]) },
    obstaculos: [],
    aproximada: true,
    metodo: "camino de acceso aproximado desde la calle hasta el campo, a la altura del punto 10",
  },
  {
    id: "piscina",
    nombre: "Piscina Municipal",
    tipo: "piscina",
    lugar: 31,
    forma: { poligono: [[380.4, 352], [380.4, 265.6], [404.7, 238.4], [460.7, 279.3], [460.7, 341.4]] },
    obstaculos: [
      polyObstacle("vaso", [[413.8, 283.8], [435, 283.8], [435, 323.2], [413.8, 323.2]]),
      polyObstacle("vaso", [[386.5, 289.9], [397.1, 289.9], [397.1, 296.9], [386.5, 296.9]]),
      polyObstacle("edificio", [[385, 325], [401, 325], [401, 338], [385, 338]]),
    ],
    aproximada: true,
    metodo: "perímetro, vaso grande, piscina pequeña y vestuarios de la " + SATELITE + " (escala tomada del campo de fútbol, ±5 px)",
  },
  {
    id: "piscina-entrada",
    nombre: "Entrada de la Piscina",
    tipo: "entrada",
    lugar: 31,
    forma: { poligono: rectPolygon([347, 340, 384, 351]) },
    obstaculos: [],
    aproximada: true,
    metodo: "acceso desde el final de la calle de Pablo Estepa (nodo 351, 345) hasta la esquina de la piscina",
  },
  {
    id: "parque-europa",
    nombre: "Parque Europa",
    tipo: "parque",
    lugar: 27,
    forma: { poligono: [[927.5, 648.8], [937.8, 645.9], [957.8, 652.4], [1015.3, 710.0], [978.5, 786.2], [887.1, 750.6]] },
    obstaculos: [
      { x: 957, y: 715.3, r: 5, tipo: "templete" },
      { x: 974.1, y: 735.8, r: 4, tipo: "estanque" },
    ],
    pistas: [
      // Fútbol sala arriba, tenis en medio y baloncesto abajo, en el lado oeste (giradas con la avenida)
      { tipo: "futbol-sala", q: [[921.0, 683.3], [935.0, 649.9], [952.4, 657.2], [938.4, 690.6]] },
      { tipo: "tenis", q: [[907.1, 716.4], [917.4, 692.0], [930.4, 697.5], [920.2, 721.9]] },
      { tipo: "baloncesto", q: [[905.5, 720.3], [917.8, 725.5], [908.4, 747.9], [896.1, 742.6]] },
    ],
    aproximada: true,
    metodo: "perímetro, pistas, templete y fuente de la " + SATELITE + "; las pistas coinciden con los rectángulos verdes de Apple Maps; el lado sur va por la Avenida la Piscina",
  },
  {
    id: "parque-peces",
    nombre: "Parque Peces",
    tipo: "parque",
    lugar: 1,
    forma: { poligono: [[201.2, 500.4], [273, 500.4], [269.8, 572.5], [306.5, 598.9], [282, 636.4], [208.6, 576.6]] },
    obstaculos: [{ x: 246.6, y: 549.4, r: 5, tipo: "estanque" }],
    aproximada: true,
    metodo: "perímetro y estanque de la " + SATELITE + "; queda al oeste de la calle de Córdoba, junto al recinto ferial",
  },
  {
    id: "parque-peces-entrada",
    nombre: "Entrada del Parque Peces",
    tipo: "entrada",
    lugar: 1,
    forma: { poligono: [[283, 626], [307, 626.5], [307, 635.5], [282.5, 638]] },
    obstaculos: [],
    aproximada: true,
    metodo: "prolonga la calle del trazado que termina en (305, 631) hasta la punta sureste del parque",
  },
  {
    id: "parque-chicocos",
    nombre: "Parque Chicocos",
    tipo: "parque",
    lugar: 25,
    forma: { poligono: [[853.5, 487], [832.7, 533], [826.5, 540.5], [840, 541.5], [910.4, 577.5]] },
    obstaculos: [
      { x: 852, y: 514, r: 1.8, tipo: "banco" },
      { x: 864, y: 545, r: 1.8, tipo: "banco" },
      { x: 880, y: 552, r: 1.8, tipo: "banco" },
    ],
    aproximada: true,
    metodo: "triángulo entre las dos calles y la vía, de la " + SATELITE + "; la punta suroeste toca el cruce del trazado (826, 540)",
  },
  {
    id: "parque-chicocos-entrada",
    nombre: "Entrada del Parque Chicocos",
    tipo: "entrada",
    lugar: 25,
    forma: { poligono: [[823, 533], [838, 528], [846, 541], [828, 546]] },
    obstaculos: [],
    aproximada: true,
    metodo: "acceso desde el cruce del trazado (826, 540) hasta la punta suroeste del parque",
  },
];
