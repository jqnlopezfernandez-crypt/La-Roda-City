/**
 * Puntos de interés de La Roda.
 *
 * Coordenadas en PÍXELES DEL TRAZADO ORIGINAL
 * (public/referencias/trazado-fondo-negro-original.jpeg, 1100x1081).
 * El juego las convierte a coordenadas de mundo con la misma escala que las calles.
 *
 * Estado de cada posición:
 *  - "referencia": centro del punto rojo que el usuario dibujó junto al número.
 *                  Es fiel al dibujo, pero NO está confirmado sobre el terreno.
 *  - "aproximada": colocado según una indicación del usuario o la posición del número.
 *  - "pendiente":  sin posición; el lugar no está en el dibujo.
 *  `verified` solo pasa a true cuando el usuario confirma el lugar.
 *
 * `metodo` documenta cómo se obtuvo cada posición para poder revisarla.
 */
export type PoiStatus = "referencia" | "aproximada" | "pendiente";

export type PointOfInterest = {
  number: number;
  name: string;
  /** Posición en píxeles del trazado; null si está pendiente de ubicar. */
  trace: { x: number; y: number } | null;
  status: PoiStatus;
  verified: boolean;
  metodo: string;
};

const auto = "punto rojo detectado automáticamente (centroide)";
const leido = "punto rojo leído a mano sobre la imagen ampliada (±2 px): está pegado al número o a la calle";

export const pointsOfInterest: PointOfInterest[] = [
  { number: 1, name: "Parque Peces", trace: { x: 307, y: 618 }, status: "referencia", verified: false, metodo: "punto tras el número '1.'" },
  { number: 2, name: "Maskom supermercados", trace: { x: 495.3, y: 770.3 }, status: "aproximada", verified: false, metodo: "indicación del usuario: enfrente del Ayuntamiento, pegado a la esquina con la calle que baja al sur (10 px al otro lado del eje de la calle)" },
  { number: 3, name: "Kebab Marihuan", trace: { x: 436.7, y: 695 }, status: "referencia", verified: false, metodo: leido },
  { number: 4, name: "Martín Cocina de Mercado", trace: { x: 443.3, y: 677.3 }, status: "referencia", verified: false, metodo: leido },
  { number: 5, name: "Taberna Monforte", trace: { x: 433.6, y: 655.1 }, status: "referencia", verified: false, metodo: auto + "; coincide con la etiqueta 'Taberna Monforte' de Apple Maps" },
  { number: 6, name: "Autoescuela", trace: { x: 473.4, y: 609.5 }, status: "referencia", verified: false, metodo: auto },
  { number: 7, name: "Casa Empresa", trace: { x: 505.7, y: 522.3 }, status: "referencia", verified: false, metodo: leido },
  { number: 8, name: "Casa Pelosblancos", trace: { x: 517.7, y: 525.7 }, status: "referencia", verified: false, metodo: leido },
  { number: 9, name: "Leiva", trace: { x: 525, y: 727.3 }, status: "referencia", verified: false, metodo: leido },
  { number: 10, name: "Campo de fútbol Carmelita", trace: { x: 316.2, y: 421.6 }, status: "referencia", verified: false, metodo: auto + "; junto al campo verde de la captura" },
  { number: 11, name: "Ayuntamiento", trace: { x: 498, y: 751.8 }, status: "referencia", verified: false, metodo: auto },
  { number: 12, name: "Estanco", trace: { x: 515.6, y: 745.7 }, status: "referencia", verified: false, metodo: auto },
  { number: 13, name: "Iglesia", trace: { x: 436.8, y: 903.4 }, status: "referencia", verified: false, metodo: auto },
  { number: 14, name: "Supermercados Día", trace: { x: 435.7, y: 982.9 }, status: "referencia", verified: false, metodo: auto },
  { number: 15, name: "Gimnasio El Gallito", trace: { x: 641.5, y: 501 }, status: "referencia", verified: false, metodo: auto },
  { number: 16, name: "Puente Erillas", trace: { x: 716.3, y: 489.5 }, status: "referencia", verified: false, metodo: auto },
  { number: 17, name: "Sagrado Corazón", trace: { x: 374.9, y: 829.6 }, status: "referencia", verified: false, metodo: auto },
  { number: 18, name: "Cuartel de Policía", trace: { x: 857.1, y: 752.6 }, status: "referencia", verified: false, metodo: auto },
  { number: 19, name: "Bar Los Cazadores", trace: { x: 361.8, y: 764.7 }, status: "referencia", verified: false, metodo: auto },
  { number: 20, name: "Tiendas Olmedo", trace: { x: 555.3, y: 698.3 }, status: "referencia", verified: false, metodo: leido },
  { number: 22, name: "Puente de Hierro", trace: { x: 665.3, y: 783.6 }, status: "referencia", verified: false, metodo: auto },
  { number: 23, name: "Farmacia", trace: { x: 591.1, y: 637.3 }, status: "referencia", verified: false, metodo: auto },
  { number: 24, name: "Farmacia", trace: { x: 354.6, y: 888 }, status: "aproximada", verified: false, metodo: "indicación del usuario: está en la acera contraria al punto rojo (348,1, 880,1); reflejado al otro lado del eje de la calle a 6,5 px" },
  { number: 25, name: "Parque Chicocos", trace: { x: 846.9, y: 530.1 }, status: "referencia", verified: false, metodo: auto },
  { number: 26, name: "Estación", trace: { x: 695.5, y: 350.9 }, status: "referencia", verified: false, metodo: auto },
  { number: 27, name: "Parque Europa", trace: { x: 946.4, y: 754.2 }, status: "referencia", verified: false, metodo: auto },
  { number: 28, name: "Jiami", trace: { x: 385.9, y: 811.3 }, status: "aproximada", verified: false, metodo: "indicación del usuario: está en la acera contraria al punto rojo (394,2, 807,5); reflejado al otro lado del eje de la calle a 6,5 px" },
  { number: 29, name: "Madishon", trace: { x: 448.9, y: 639.7 }, status: "referencia", verified: false, metodo: auto + "; el usuario indica que el 29 es Madishon (no Autoescuela 2)" },
  { number: 30, name: "Peluquería Adri", trace: { x: 786.5, y: 620.6 }, status: "referencia", verified: false, metodo: auto },
  { number: 31, name: "Piscina Municipal", trace: { x: 386, y: 345 }, status: "aproximada", verified: false, metodo: "captura de satélite del usuario (21-10-2026, perímetro en naranja); junto a la entrada desde la calle de Pablo Estepa" },
];

/**
 * Lugares que aparecen en las misiones pero NO están en el dibujo.
 * No se colocan en el mapa hasta que el usuario indique dónde están.
 */
export const pendingPlaces: { name: string; nota: string }[] = [
  { name: "Calle Rosa 4", nota: "Misión de limpiar puertas. Falta saber qué calle del trazado es Calle Rosa." },
  { name: "Calle Rosa 5", nota: "Misión de limpiar puertas. Falta saber qué calle del trazado es Calle Rosa." },
  { name: "Casa de la Juventud", nota: "Misión de cámaras de seguridad. Falta su posición." },
];
