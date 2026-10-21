// Edificios singulares del pueblo (iglesia, ayuntamiento, estación, cuartel) y letreros de
// los comercios. Mismo lenguaje que las casas: tinta temblorosa, cal, teja árabe y ocre.
// Cada edificio se ve en 3/4: tejado visto desde arriba (la huella) y fachada sur debajo.
import { INK, inkShape, inkStroke, rectPts, ellipsePts, hatching, type Point } from "./svg";

const CAL = "#efe8d8";
const CAL_SOMBRA = "#d6ccb6";
const OCRE = "#c9a24a";
const PIEDRA = "#cbbd9f";
const TEJA = "#b35a3a";
const MADERA = "#6b4426";
const CRISTAL = "#3b4f5c";

/** Muro encalado con zócalo de ocre. */
function wall(x: number, y: number, w: number, h: number, seed: number, color = CAL): string {
  let s = inkShape(rectPts(x, y, w, h), color, { seed, amp: 0.9, ink: 2.6 });
  s += `<rect x="${x + 1.5}" y="${y + h - 7}" width="${w - 3}" height="6" fill="${OCRE}" fill-opacity="0.85"/>`;
  s += hatching(x + 2, y + 2, w - 4, h - 9, 7, CAL_SOMBRA, 0.35);
  return s;
}

/** Ventana con reja y marco de ocre. */
function windowBox(x: number, y: number, w: number, h: number, seed: number): string {
  let s = inkShape(rectPts(x - 2, y - 2, w + 4, h + 4), OCRE, { seed, amp: 0.5, ink: 1.6 });
  s += inkShape(rectPts(x, y, w, h), CRISTAL, { seed: seed + 1, amp: 0.4, ink: 1.4 });
  for (let i = 1; i < 3; i++) s += `<path d="M${x + (w * i) / 3} ${y} V${y + h}" stroke="${INK}" stroke-width="1.2"/>`;
  return s;
}

/** Puerta con arco de medio punto. */
function archDoor(cx: number, bottom: number, w: number, h: number, seed: number, color = MADERA): string {
  const r = w / 2;
  const pts: Point[] = [[cx - r, bottom], [cx - r, bottom - h + r], ...ellipsePts(cx, bottom - h + r, r, r, 14).filter((p) => p[1] <= bottom - h + r + 0.01).sort((a, b) => a[0] - b[0]), [cx + r, bottom - h + r], [cx + r, bottom]];
  let s = inkShape(pts, color, { seed, amp: 0.5, ink: 2.2 });
  s += `<path d="M${cx} ${bottom - h + 2} V${bottom}" stroke="${INK}" stroke-width="1.4" stroke-opacity="0.7"/>`;
  return s;
}

/*
 * Edificios singulares hechos como las casas: el tejado se pinta sobre la huella (alineada
 * con la calle) y aquí solo se dibujan las fachadas (larga y corta), que el mapa deforma
 * para seguir la calle, y las torres, que se ponen de pie como los árboles.
 * Todas las fachadas ocupan su lienzo entero: el borde inferior es el suelo.
 */
export const LANDMARK_ART = {
  iglesia: { largo: [190, 70], corto: [80, 86], torre: [54, 200] },
  ayuntamiento: { largo: [190, 64], corto: [70, 64], torre: [48, 130] },
  estacion: { largo: [220, 56], corto: [60, 56] },
  cuartel: { largo: [160, 52], corto: [60, 52] },
} as const;

/** Iglesia, lado largo: muro de la nave con contrafuertes, ventanas altas y puerta lateral. */
export function churchLong(): string {
  const [W, H] = LANDMARK_ART.iglesia.largo;
  let s = wall(1, 1, W - 2, H - 2, 101);
  for (const x of [8, 56, 104, 152]) s += inkShape(rectPts(x, 10, 10, H - 11), PIEDRA, { seed: 102 + x, amp: 0.4, ink: 1.8 });
  for (const x of [30, 78, 126, 172]) s += archDoor(x, 34, 10, 22, 110 + x, CRISTAL);
  s += archDoor(95, H - 1, 18, 34, 120);
  return s;
}

/** Iglesia, lado corto: portada de piedra con frontón, rosetón, puerta y cruz. */
export function churchShort(): string {
  const [W, H] = LANDMARK_ART.iglesia.corto;
  let s = wall(1, 18, W - 2, H - 19, 131);
  s += inkShape([[14, H - 1], [14, 30], [W / 2, 6], [W - 14, 30], [W - 14, H - 1]], PIEDRA, { seed: 132, amp: 0.7, ink: 2.4 });
  s += archDoor(W / 2, H - 1, 22, 38, 133);
  s += inkShape(ellipsePts(W / 2, 32, 8, 8, 14), "#d9b25a", { seed: 134, amp: 0.4, ink: 1.8 });
  s += `<path d="M${W / 2 - 8} 32 H${W / 2 + 8} M${W / 2} 24 V40" stroke="${INK}" stroke-width="1"/>`;
  return s;
}

/** Campanario (de pie): fuste encalado, cuerpo de campanas, chapitel y cruz. */
export function churchTower(): string {
  const [W, H] = LANDMARK_ART.iglesia.torre;
  let s = `<ellipse cx="${W / 2}" cy="${H - 4}" rx="${W / 2}" ry="5" fill="${INK}" fill-opacity="0.3"/>`;
  s += wall(6, 92, W - 12, H - 96, 141);
  s += windowBox(W / 2 - 7, 120, 14, 22, 142) + windowBox(W / 2 - 7, 160, 14, 20, 143);
  s += inkShape(rectPts(2, 86, W - 4, 8), PIEDRA, { seed: 144, amp: 0.5, ink: 2 });
  s += inkShape(rectPts(6, 46, W - 12, 42), CAL, { seed: 145, amp: 0.6, ink: 2.4 });
  s += archDoor(W / 2 - 9, 82, 12, 28, 146, "#2b2119") + archDoor(W / 2 + 9, 82, 12, 28, 147, "#2b2119");
  s += inkShape([[W / 2 - 13, 70], [W / 2 - 5, 70], [W / 2 - 5, 78], [W / 2 - 13, 78]], OCRE, { seed: 148, amp: 0.3, ink: 1.2 });
  s += inkShape(rectPts(3, 40, W - 6, 8), PIEDRA, { seed: 149, amp: 0.5, ink: 2 });
  s += inkShape([[6, 40], [W - 6, 40], [W / 2, 12]], TEJA, { seed: 150, amp: 0.6, ink: 2.4 });
  s += `<path d="M${W / 2} 12 L${W - 6} 40 L${W / 2} 40 Z" fill="#1a0f0a" fill-opacity="0.18"/>`;
  s += inkStroke([[W / 2, 12], [W / 2, 1]], 2.6, INK, 151) + inkStroke([[W / 2 - 5, 5], [W / 2 + 5, 5]], 2.6, INK, 152);
  return s;
}

/** Ayuntamiento, lado largo: soportales, balcón corrido, ventanas y rótulo. */
export function townHallLong(): string {
  const [W, H] = LANDMARK_ART.ayuntamiento.largo;
  let s = wall(1, 1, W - 2, H - 2, 161);
  for (const x of [40, 95, 150]) s += archDoor(x, H - 1, 26, 30, 162 + x, x === 95 ? MADERA : "#3a2c22");
  s += inkShape(rectPts(14, 26, W - 28, 3), INK, { seed: 163, amp: 0.3, ink: 1 });
  for (let i = 0; i < 15; i++) s += `<path d="M${18 + i * 11} 26 V17" stroke="${INK}" stroke-width="1.2"/>`;
  s += inkStroke([[14, 17], [W - 14, 17]], 1.8, INK, 164);
  for (const x of [22, 62, 118, 158]) s += windowBox(x, 5, 11, 15, 165 + x);
  s += inkShape(rectPts(70, 29, 50, 7), OCRE, { seed: 166, amp: 0.3, ink: 1.3 });
  s += `<path d="M75 32.5 H115" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 2"/>`;
  return s;
}

export function townHallShort(): string {
  const [W, H] = LANDMARK_ART.ayuntamiento.corto;
  let s = wall(1, 1, W - 2, H - 2, 171);
  s += windowBox(14, 10, 11, 15, 172) + windowBox(W - 25, 10, 11, 15, 173);
  s += archDoor(W / 2, H - 1, 16, 26, 174);
  return s;
}

/** Torre del reloj con bandera (de pie). */
export function townHallTower(): string {
  const [W, H] = LANDMARK_ART.ayuntamiento.torre;
  let s = `<ellipse cx="${W / 2}" cy="${H - 4}" rx="${W / 2 - 2}" ry="4" fill="${INK}" fill-opacity="0.3"/>`;
  s += wall(6, 40, W - 12, H - 44, 181);
  s += inkShape([[3, 42], [W - 3, 42], [W / 2, 18]], TEJA, { seed: 182, amp: 0.5, ink: 2.4 });
  s += inkShape(ellipsePts(W / 2, 62, 11, 11, 16), "#f7f1e2", { seed: 183, amp: 0.3, ink: 2 });
  s += `<path d="M${W / 2} 62 V54 M${W / 2} 62 L${W / 2 + 6} 65" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  s += windowBox(W / 2 - 6, 86, 12, 18, 184);
  s += inkStroke([[W / 2, 20], [W / 2, 1]], 2, INK, 185);
  s += `<path d="M${W / 2 + 1} 2 h18 v4 h-18z" fill="#c8402e"/><path d="M${W / 2 + 1} 6 h18 v4 h-18z" fill="#e7c03a"/><path d="M${W / 2 + 1} 10 h18 v4 h-18z" fill="#c8402e"/>`;
  return s;
}

/** Estación, lado largo: marquesina de hierro, ventanas, puerta, reloj y cartel. */
export function stationLong(): string {
  const [W, H] = LANDMARK_ART.estacion.largo;
  let s = wall(1, 1, W - 2, H - 2, 191, "#f0e2c4");
  for (const x of [18, 54, 152, 188]) s += windowBox(x, 18, 13, 20, 192 + x);
  s += archDoor(W / 2, H - 1, 26, 34, 193);
  s += inkShape([[0, 16], [W, 16], [W - 6, 8], [6, 8]], "#5d6b70", { seed: 194, amp: 0.5, ink: 2 });
  for (const x of [12, 70, 150, 208]) s += inkStroke([[x, 16], [x, H - 2]], 2.2, INK, 195 + x);
  s += inkShape(rectPts(82, 1, 56, 7), "#2f5d7c", { seed: 196, amp: 0.3, ink: 1.2 });
  s += `<path d="M86 4.5 H134" stroke="#f3ead6" stroke-width="1.6" stroke-dasharray="5 2"/>`;
  return s;
}

export function stationShort(): string {
  const [W, H] = LANDMARK_ART.estacion.corto;
  let s = wall(1, 1, W - 2, H - 2, 201, "#f0e2c4");
  s += windowBox(W / 2 - 7, 14, 14, 20, 202);
  s += inkShape(ellipsePts(W / 2, 7, 5, 5, 12), "#f7f1e2", { seed: 203, amp: 0.2, ink: 1.4 });
  return s;
}

/** Cuartel, lado largo: sobrio, con puerta azul, escudo y bandera. */
export function barracksLong(): string {
  const [W, H] = LANDMARK_ART.cuartel.largo;
  let s = wall(1, 1, W - 2, H - 2, 211, "#e9e2d0");
  for (const x of [16, 42, 106, 132]) s += windowBox(x, 12, 11, 17, 212 + x);
  s += inkShape(rectPts(W / 2 - 13, 16, 26, H - 17), "#3b4b6b", { seed: 213, amp: 0.4, ink: 2 });
  s += inkShape([[W / 2 - 7, 3], [W / 2 + 7, 3], [W / 2 + 7, 10], [W / 2, 14], [W / 2 - 7, 10]], "#2f5d7c", { seed: 214, amp: 0.3, ink: 1.4 });
  s += `<path d="M${W - 26} 4 h18 v4 h-18z" fill="#c8402e"/><path d="M${W - 26} 8 h18 v4 h-18z" fill="#e7c03a"/><path d="M${W - 26} 12 h18 v4 h-18z" fill="#c8402e"/>`;
  return s;
}

export function barracksShort(): string {
  const [W, H] = LANDMARK_ART.cuartel.corto;
  let s = wall(1, 1, W - 2, H - 2, 221, "#e9e2d0");
  s += windowBox(W / 2 - 6, 12, 12, 17, 222);
  return s;
}

export type SignKind = "farmacia" | "super" | "bar" | "kebab" | "peluqueria" | "estanco" | "gimnasio" | "autoescuela" | "tienda" | "piscina";

/** Letrero de comercio colgado de un poste, con un icono reconocible (sin texto). */
export function shopSign(kind: SignKind): string {
  // Lienzo 44×70: poste a la izquierda y panel colgado
  let s = `<ellipse cx="12" cy="67" rx="9" ry="3" fill="${INK}" fill-opacity="0.3"/>`;
  s += inkStroke([[10, 67], [10, 8]], 3.2, INK, 71);
  s += inkStroke([[10, 10], [38, 10]], 2.6, INK, 72);
  const board = (fill: string) => inkShape(rectPts(14, 14, 26, 26), fill, { seed: 73, amp: 0.5, ink: 2.2 });
  switch (kind) {
    case "farmacia":
      s += board("#2f7d4e");
      s += `<path d="M24 19 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6z" fill="#7be08f" stroke="${INK}" stroke-width="1.2"/>`;
      break;
    case "super":
      s += board("#d8a23a");
      s += `<path d="M18 22 h4 l3 10 h10 l2 -7 h-14" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="26" cy="35" r="1.8" fill="${INK}"/><circle cx="33" cy="35" r="1.8" fill="${INK}"/>`;
      break;
    case "bar":
      s += board("#8a3b2a");
      s += `<path d="M21 20 h12 l-1.5 14 h-9z" fill="#f2c14e" stroke="${INK}" stroke-width="1.4"/><path d="M21.5 23 h11" stroke="#fff6dc" stroke-width="2.4"/>`;
      break;
    case "kebab":
      s += board("#b5532a");
      s += `<path d="M27 18 V37" stroke="${INK}" stroke-width="1.6"/><path d="M22 21 q5 -3 10 0 l-1 13 q-4 2 -8 0z" fill="#c98a4a" stroke="${INK}" stroke-width="1.3"/>`;
      break;
    case "peluqueria":
      s += board("#efe8d8");
      s += `<circle cx="21" cy="33" r="3" fill="none" stroke="${INK}" stroke-width="1.6"/><circle cx="33" cy="33" r="3" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M23 31 L33 18 M31 31 L21 18" stroke="${INK}" stroke-width="1.6"/>`;
      break;
    case "estanco":
      s += board("#7a3b1f");
      s += `<path d="M19 21 h16 M27 21 v14" stroke="#e7c03a" stroke-width="4" stroke-linecap="square"/>`;
      break;
    case "gimnasio":
      s += board("#2f5d7c");
      s += `<path d="M20 27 h14" stroke="#f3ead6" stroke-width="2.4"/><rect x="17" y="22" width="4" height="10" fill="#f3ead6" stroke="${INK}"/><rect x="33" y="22" width="4" height="10" fill="#f3ead6" stroke="${INK}"/>`;
      break;
    case "autoescuela":
      s += board("#2f5d7c");
      s += `<path d="M22 19 v15 h11" stroke="#f3ead6" stroke-width="3.6" fill="none"/>`;
      break;
    case "piscina":
      s += board("#2f9cc7");
      s += `<path d="M18 30 q3 -3 6 0 t6 0 t6 0 M18 35 q3 -3 6 0 t6 0 t6 0" stroke="#f3ead6" stroke-width="1.8" fill="none"/>`;
      break;
    default:
      s += board("#6b4426");
      s += `<path d="M20 24 h14 l-2 10 h-10z" fill="#e7c03a" stroke="${INK}" stroke-width="1.3"/>`;
  }
  return s;
}
