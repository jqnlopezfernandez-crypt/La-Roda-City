// Edificios singulares del pueblo (iglesia, ayuntamiento, estación, cuartel) y letreros de
// los comercios. Mismo lenguaje que las casas: tinta temblorosa, cal, teja árabe y ocre.
// Cada edificio se ve en 3/4: tejado visto desde arriba (la huella) y fachada sur debajo.
import { INK, inkShape, inkStroke, rectPts, ellipsePts, hatching, type Point } from "./svg";

const CAL = "#efe8d8";
const CAL_SOMBRA = "#d6ccb6";
const OCRE = "#c9a24a";
const PIEDRA = "#cbbd9f";
const TEJA = "#b35a3a";
const TEJA_OSCURA = "#8c4128";
const MADERA = "#6b4426";
const CRISTAL = "#3b4f5c";

/** Tejado de teja árabe visto desde arriba: hileras y cumbrera. */
function roof(x: number, y: number, w: number, h: number, seed: number, ridge: "h" | "v" = "h"): string {
  let s = inkShape(rectPts(x, y, w, h), TEJA, { seed, amp: 1, ink: 2.6 });
  const rows = ridge === "h" ? Math.max(3, Math.round(h / 7)) : Math.max(3, Math.round(w / 7));
  for (let i = 1; i < rows; i++) {
    if (ridge === "h") {
      const yy = y + (h * i) / rows;
      s += inkStroke([[x + 2, yy], [x + w - 2, yy]], 1.1, TEJA_OSCURA, seed + i, 0.8, 0.8);
    } else {
      const xx = x + (w * i) / rows;
      s += inkStroke([[xx, y + 2], [xx, y + h - 2]], 1.1, TEJA_OSCURA, seed + i, 0.8, 0.8);
    }
  }
  // Mitad en sombra y cumbrera
  if (ridge === "h") {
    s += `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h / 2 - 1}" fill="#1a0f0a" fill-opacity="0.16"/>`;
    s += inkStroke([[x + 2, y + h / 2], [x + w - 2, y + h / 2]], 2.4, INK, seed + 40);
  } else {
    s += `<rect x="${x + 1}" y="${y + 1}" width="${w / 2 - 1}" height="${h - 2}" fill="#1a0f0a" fill-opacity="0.16"/>`;
    s += inkStroke([[x + w / 2, y + 2], [x + w / 2, y + h - 2]], 2.4, INK, seed + 40);
  }
  return s;
}

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

const shadow = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}" fill-opacity="0.28"/>`;

/** Iglesia: nave con tejado a dos aguas, portada con rosetón y campanario a la izquierda. */
export function churchBuilding(): string {
  const W = 190;
  const H = 260;
  let s = shadow(W / 2 + 8, H - 8, W / 2, 10);
  // Nave: tejado (huella) y fachada
  s += roof(46, 120, 136, 76, 11, "v");
  s += wall(46, 196, 136, 56, 12);
  // Portada de piedra con frontón
  s += inkShape([[86, 252], [86, 176], [114, 160], [142, 176], [142, 252]], PIEDRA, { seed: 13, amp: 0.8, ink: 2.6 });
  s += archDoor(114, 252, 26, 44, 14);
  s += inkShape(ellipsePts(114, 182, 9, 9, 14), "#d9b25a", { seed: 15, amp: 0.4, ink: 1.8 });
  s += `<path d="M105 182 H123 M114 173 V191 M108 176 L120 188 M120 176 L108 188" stroke="${INK}" stroke-width="1"/>`;
  // Cruz sobre el frontón
  s += inkStroke([[114, 160], [114, 140]], 3, INK, 16);
  s += inkStroke([[107, 147], [121, 147]], 3, INK, 17);
  s += windowBox(58, 212, 12, 20, 18) + windowBox(158, 212, 12, 20, 19);
  // Campanario
  s += wall(8, 96, 42, 156, 20);
  s += inkShape(rectPts(4, 90, 50, 8), PIEDRA, { seed: 21, amp: 0.5, ink: 2 });
  s += inkShape(rectPts(8, 52, 42, 40), CAL, { seed: 22, amp: 0.6, ink: 2.4 });
  for (const x of [13, 33]) s += archDoor(x + 6, 86, 12, 26, 23 + x, "#2b2119");
  s += inkShape([[16, 72], [22, 72], [22, 80], [16, 80]], "#c9a24a", { seed: 30, amp: 0.3, ink: 1.2 });
  s += inkShape(rectPts(5, 46, 48, 8), PIEDRA, { seed: 24, amp: 0.5, ink: 2 });
  s += inkShape([[8, 46], [50, 46], [29, 14]], TEJA, { seed: 25, amp: 0.6, ink: 2.4 });
  s += `<path d="M29 14 L50 46 L29 46 Z" fill="#1a0f0a" fill-opacity="0.18"/>`;
  s += inkStroke([[29, 14], [29, 2]], 2.6, INK, 26);
  s += inkStroke([[24, 7], [34, 7]], 2.6, INK, 27);
  s += windowBox(22, 130, 14, 22, 28) + windowBox(22, 190, 14, 22, 29);
  return s;
}

/** Ayuntamiento: dos plantas, balcón corrido, torre del reloj y bandera. */
export function townHallBuilding(): string {
  const W = 190;
  const H = 200;
  let s = shadow(W / 2, H - 8, W / 2, 10);
  s += roof(14, 64, 162, 62, 31);
  s += wall(14, 120, 162, 72, 32);
  // Torre del reloj en el centro
  s += inkShape(rectPts(76, 30, 38, 92), CAL, { seed: 33, amp: 0.6, ink: 2.4 });
  s += inkShape([[72, 30], [118, 30], [95, 6]], TEJA, { seed: 34, amp: 0.5, ink: 2.4 });
  s += inkShape(ellipsePts(95, 54, 12, 12, 16), "#f7f1e2", { seed: 35, amp: 0.3, ink: 2 });
  s += `<path d="M95 54 V45 M95 54 L101 57" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  // Bandera
  s += inkStroke([[114, 34], [114, 2]], 2, INK, 36);
  s += `<path d="M115 4 h22 v5 h-22z" fill="#c8402e"/><path d="M115 9 h22 v5 h-22z" fill="#e7c03a"/><path d="M115 14 h22 v5 h-22z" fill="#c8402e"/>`;
  s += `<path d="M115 4 h22 v15 h-22z" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
  // Portada con soportales
  for (const x of [52, 95, 138]) s += archDoor(x, 192, 26, 38, 37 + x, x === 95 ? MADERA : "#3a2c22");
  // Balcón corrido con ventanas
  s += inkShape(rectPts(26, 146, 138, 4), INK, { seed: 41, amp: 0.3, ink: 1 });
  for (let i = 0; i < 12; i++) s += `<path d="M${30 + i * 11.5} 146 V136" stroke="${INK}" stroke-width="1.3"/>`;
  s += inkStroke([[26, 136], [164, 136]], 2, INK, 42);
  for (const x of [32, 72, 108, 148]) s += windowBox(x, 124, 12, 18, 43 + x);
  // Rótulo
  s += inkShape(rectPts(66, 154, 58, 9), OCRE, { seed: 44, amp: 0.3, ink: 1.4 });
  s += `<path d="M72 158.5 H118" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 2"/>`;
  return s;
}

/** Estación: edificio alargado con marquesina, reloj y cartel. */
export function stationBuilding(): string {
  const W = 220;
  const H = 150;
  let s = shadow(W / 2, H - 6, W / 2, 9);
  s += roof(10, 30, 200, 56, 51);
  s += wall(10, 84, 200, 58, 52, "#f0e2c4");
  for (const x of [26, 62, 146, 182]) s += windowBox(x, 96, 14, 22, 53 + x);
  s += archDoor(110, 142, 30, 44, 54);
  // Marquesina de hierro
  s += inkShape([[4, 102], [216, 102], [210, 92], [10, 92]], "#5d6b70", { seed: 55, amp: 0.5, ink: 2.2 });
  for (const x of [18, 70, 150, 202]) s += inkStroke([[x, 102], [x, 140]], 2.4, INK, 56 + x);
  // Reloj y cartel
  s += inkShape(ellipsePts(110, 72, 10, 10, 14), "#f7f1e2", { seed: 57, amp: 0.3, ink: 2 });
  s += `<path d="M110 72 V65 M110 72 L115 74" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
  s += inkShape(rectPts(70, 84, 80, 9), "#2f5d7c", { seed: 58, amp: 0.3, ink: 1.4 });
  s += `<path d="M76 88.5 H144" stroke="#f3ead6" stroke-width="1.8" stroke-dasharray="5 2"/>`;
  return s;
}

/** Cuartel de la Guardia Civil / policía: sobrio, con escudo y bandera. */
export function barracksBuilding(): string {
  const W = 160;
  const H = 150;
  let s = shadow(W / 2, H - 6, W / 2, 9);
  s += roof(10, 38, 140, 52, 61);
  s += wall(10, 88, 140, 56, 62, "#e9e2d0");
  for (const x of [24, 50, 98, 124]) s += windowBox(x, 100, 12, 18, 63 + x);
  s += inkShape(rectPts(66, 104, 28, 40), "#3b4b6b", { seed: 64, amp: 0.4, ink: 2.2 });
  s += inkShape([[72, 92], [88, 92], [88, 100], [80, 104], [72, 100]], "#2f5d7c", { seed: 65, amp: 0.3, ink: 1.6 });
  s += inkStroke([[140, 40], [140, 10]], 2, INK, 66);
  s += `<path d="M141 12 h18 v4 h-18z" fill="#c8402e"/><path d="M141 16 h18 v5 h-18z" fill="#e7c03a"/><path d="M141 21 h18 v4 h-18z" fill="#c8402e"/>`;
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
