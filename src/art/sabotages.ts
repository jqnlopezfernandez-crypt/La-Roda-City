/**
 * Ilustraciones de los sabotajes y sus minijuegos de arreglo: cabeza del Sagrado Corazón,
 * cacas en la piscina y riada en el Puente Erillas. Tinta temblorosa, rayados y manchas
 * para el aire artesano del resto del juego (nada de formas planas).
 */
import { mgFondo, mgPieza, mgUrl } from "./pintadoMg";
import { INK, ellipsePts, hatching, inkShape, inkStroke, jitterLine, linearGradient, radialGradient, rectPts, seededRng, smoothPath, speckles, wobble, type Point } from "./svg";

const sceneSvg = (width: number, height: number, content: string, className = "") =>
  `<svg class="mg-scene ${className}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
const spriteSvg = (width: number, height: number, content: string) =>
  `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

/** Viñeta oscura en los bordes (encuadre de ilustración). */
const vignette = (w: number, h: number, id: string) =>
  `<defs>${radialGradient(id, [[0.55, "#000", 0], [1, "#0b0705", 0.75]], 0.5, 0.5, 0.75)}</defs><rect width="${w}" height="${h}" fill="url(#${id})" pointer-events="none"/>`;

/** Silueta de casas del pueblo con ventanas encendidas. */
function townSilhouette(y: number, w: number, seed: number): string {
  const rng = seededRng(seed);
  let s = "";
  let x = -10;
  while (x < w) {
    const hw = 34 + rng() * 40;
    const hh = 26 + rng() * 34;
    const roof = rng() < 0.5;
    const pts: Point[] = roof
      ? [[x, y], [x, y - hh], [x + hw / 2, y - hh - 14], [x + hw, y - hh], [x + hw, y]]
      : [[x, y], [x, y - hh], [x + hw, y - hh], [x + hw, y]];
    s += inkShape(pts, "#2b2230", { seed: seed + x, amp: 1.2, ink: 2.2, inkColor: "#150f14" });
    for (let i = 0; i < 2; i++) {
      if (rng() < 0.45) continue;
      const wx = x + 8 + rng() * (hw - 20);
      const wy = y - hh + 8 + rng() * (hh - 18);
      s += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="7" height="9" fill="#f2c45a" opacity="0.85"/>`;
    }
    x += hw - 2;
  }
  return s;
}

/** Empedrado: cantos redondeados con contorno de tinta. */
function cobbles(x: number, y: number, w: number, h: number, seed: number, color = "#6d6157"): string {
  const rng = seededRng(seed);
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#4a4038"/>`;
  for (let row = 0; row < h / 12 + 1; row++) {
    for (let col = 0; col < w / 18 + 1; col++) {
      const cx = x + col * 18 + (row % 2) * 9 + (rng() - 0.5) * 3;
      const cy = y + row * 12 + (rng() - 0.5) * 2;
      const shade = rng() < 0.5 ? color : "#7b6e62";
      s += `<path d="${smoothPath(wobble(ellipsePts(cx, cy, 8, 5, 8), 1.2, seed + row * 50 + col))}" fill="${shade}" stroke="#2a1f19" stroke-width="1.2"/>`;
    }
  }
  return s;
}

// ------------------------------------------------------------- cabeza del Sagrado

/** Plaza de noche con la estatua del Sagrado Corazón decapitada (cuello en 180, 96). */
export function headlessStatueScene(): string {
  const W = 360;
  const H = 260;
  let s = `<defs>${linearGradient("cielo-sag", [[0, "#1c1830", 1], [0.7, "#3a2b40", 1], [1, "#5a3d3a", 1]])}${radialGradient("halo-sag", [[0, "#ffe7a3", 0.95], [1, "#ffd98a", 0]])}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#cielo-sag)"/>`;
  s += speckles(0, 0, W, 120, 26, ["#f3ead6"], 0.6, 1.4, 0.7, 4);
  s += `<circle cx="300" cy="44" r="20" fill="#efe2b8" stroke="${INK}" stroke-width="2"/><circle cx="292" cy="40" r="4" fill="#d8c897"/><circle cx="306" cy="50" r="3" fill="#d8c897"/>`;
  s += townSilhouette(176, W, 21);
  s += cobbles(0, 176, W, 90, 22);
  // Escalones y pedestal de piedra con grietas
  s += inkShape([[96, 250], [264, 250], [256, 232], [104, 232]], "#8a7b66", { seed: 1, amp: 1.2, ink: 2.8 });
  s += hatching(100, 234, 160, 14, 6, INK, 0.3, 3);
  s += inkShape([[116, 232], [244, 232], [236, 204], [124, 204]], "#a39275", { seed: 2, amp: 1, ink: 2.6 });
  s += inkShape([[138, 204], [222, 204], [214, 160], [146, 160]], "#b9a98a", { seed: 3, amp: 1, ink: 2.8 });
  s += hatching(196, 162, 18, 40, 5, INK, 0.35, 7);
  s += jitterLine(152, 170, 26, 1.2, INK, 1.4, 31, 0.7) + jitterLine(208, 210, 20, 2.2, INK, 1.2, 32, 0.6);
  s += inkShape([[134, 164], [226, 164], [222, 154], [138, 154]], "#cbbd9f", { seed: 4, amp: 0.6, ink: 2.2 });
  // Túnica de mármol con pliegues
  s += inkShape([[160, 154], [200, 154], [196, 120], [192, 102], [168, 102], [164, 120]], "#ece6d6", { seed: 5, amp: 1, ink: 2.8 });
  for (const [x0, x1] of [[172, 168], [180, 181], [188, 192]]) s += inkStroke([[x0, 108], [x1, 152]], 1.3, "#a79f8c", x0, 1, 0.9);
  s += hatching(186, 106, 12, 46, 4, "#8f8775", 0.5, 9);
  // Brazos abiertos
  s += inkShape([[168, 106], [128, 118], [122, 128], [130, 130], [168, 118]], "#ece6d6", { seed: 6, amp: 0.8, ink: 2.6 });
  s += inkShape([[192, 106], [232, 118], [238, 128], [230, 130], [192, 118]], "#ece6d6", { seed: 7, amp: 0.8, ink: 2.6 });
  s += `<circle cx="125" cy="126" r="5" fill="#ece6d6" stroke="${INK}" stroke-width="2"/><circle cx="235" cy="126" r="5" fill="#ece6d6" stroke="${INK}" stroke-width="2"/>`;
  // Corazón en el pecho
  s += `<path d="M180 120 c-6 -8 -14 -2 -8 5 l8 8 l8 -8 c6 -7 -2 -13 -8 -5Z" fill="#c4483f" stroke="${INK}" stroke-width="1.6"/>`;
  // Cuello roto (muñón irregular)
  s += inkShape([[170, 102], [173, 94], [177, 99], [181, 92], [185, 98], [190, 95], [190, 102]], "#d6cfbd", { seed: 8, amp: 0.4, ink: 2.4 });
  // Halo apagado (se enciende al arreglarlo: clase mg-halo)
  s += `<circle class="mg-halo" cx="180" cy="72" r="34" fill="url(#halo-sag)" opacity="0.15"/>`;
  s += `<circle class="mg-target" cx="180" cy="80" r="16" fill="none" stroke="#f2c45a" stroke-width="2.4" stroke-dasharray="5 4" opacity="0.85"/>`;
  // Cascotes en el suelo
  s += speckles(40, 222, 110, 26, 10, ["#cfc7b4", "#a99f8a"], 2, 5, 0.95, 33);
  s += vignette(W, H, "vig-sag");
  return sceneSvg(W, H, s, "mg-sagrado");
}

/** Cabeza de mármol de la estatua (se arrastra hasta el cuello). */
export function statueHeadArt(): string {
  let s = `<ellipse cx="32" cy="58" rx="18" ry="4" fill="${INK}" fill-opacity="0.35"/>`;
  s += `<path d="${smoothPath(wobble(ellipsePts(32, 30, 17, 21, 14), 1.2, 41))}" fill="#ece6d6" stroke="${INK}" stroke-width="2.6"/>`;
  // Pelo y barba
  s += `<path d="M15 26 c0 -14 10 -20 17 -20 c8 0 17 6 17 20 c-4 -6 -8 -9 -17 -9 c-9 0 -13 3 -17 9Z" fill="#cfc7b4" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M18 36 c2 12 8 18 14 18 c6 0 12 -6 14 -18 c-4 5 -9 7 -14 7 c-5 0 -10 -2 -14 -7Z" fill="#d9d1bd" stroke="${INK}" stroke-width="2"/>`;
  s += hatching(36, 34, 10, 16, 3, "#8f8775", 0.5, 43);
  // Ojos cerrados, nariz y boca serenos
  s += `<path d="M22 30 q4 3 8 0 M34 30 q4 3 8 0 M32 31 l-2 7 h4 M28 44 q4 2 8 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  // Base del cuello rota
  s += `<path d="M24 50 l3 6 l4 -4 l3 5 l4 -5 l3 4" stroke="${INK}" stroke-width="1.8" fill="#d6cfbd"/>`;
  s += jitterLine(42, 18, 10, 2.1, INK, 1, 44, 0.6);
  return s;
}
export const statueHeadSvg = () => spriteSvg(64, 64, statueHeadArt());

// ------------------------------------------------------------------- piscina

/** Piscina vista desde arriba: playa de losas, agua con reflejos y corcheras. */
export function poolScene(withPoops = false): string {
  const W = 360;
  const H = 250;
  if (mgUrl("escena-piscina")) {
    // Piscina pintada; reflejos que se mueven encima del agua
    let p = mgFondo("escena-piscina", W, H);
    p += `<g class="mg-causticas" opacity="0.5">`;
    const rr = seededRng(54);
    for (let i = 0; i < 14; i++) {
      const x = 90 + rr() * 200;
      const y = 70 + rr() * 120;
      p += `<path d="${smoothPath(wobble([[x, y], [x + 14, y - 4], [x + 26, y + 2]], 2, i + 60, false), false)}" stroke="#d6f6ff" stroke-width="1.8" fill="none" style="animation-delay:${(-rr() * 3).toFixed(2)}s"/>`;
    }
    p += `</g>`;
    if (withPoops) for (const [x, y] of [[150, 100], [210, 140], [250, 90], [180, 170]]) p += mgPieza("pieza-caca", x, y, 34, 30);
    p += vignette(W, H, "vig-pis");
    return sceneSvg(W, H, p, "mg-piscina");
  }
  let s = `<defs>${linearGradient("agua-pis", [[0, "#3fb6dc", 1], [1, "#1f7fa8", 1]])}</defs>`;
  // Playa de losas
  s += `<rect width="${W}" height="${H}" fill="#d8ccb1"/>`;
  for (let y = 0; y < H; y += 22) for (let x = (y / 22) % 2 ? -11 : 0; x < W; x += 22) s += `<rect x="${x + 1}" y="${y + 1}" width="20" height="20" fill="${(x + y) % 44 ? "#e3d8bf" : "#d2c6aa"}" stroke="#a69a80" stroke-width="1"/>`;
  s += speckles(0, 0, W, H, 30, ["#b9ad92", "#efe6d2"], 1, 3, 0.7, 51);
  // Borde de piedra y agua
  s += inkShape(rectPts(26, 24, 308, 200), "#f3efe6", { seed: 52, amp: 1, ink: 3 });
  s += inkShape(rectPts(34, 32, 292, 184), "url(#agua-pis)", { seed: 53, amp: 0.8, ink: 2.6 });
  // Reflejos de luz (cáusticas)
  const rng = seededRng(54);
  for (let i = 0; i < 26; i++) {
    const x = 44 + rng() * 270;
    const y = 40 + rng() * 166;
    s += `<path d="${smoothPath(wobble([[x, y], [x + 14, y - 4], [x + 26, y + 2]], 2, i + 60, false), false)}" stroke="#bdf0ff" stroke-width="1.6" fill="none" opacity="0.55"/>`;
  }
  // Calles de nado y corcheras de colores
  for (const y of [78, 124, 170]) {
    s += `<path d="M38 ${y} H322" stroke="#1d6f93" stroke-width="2" opacity="0.6"/>`;
    for (let x = 40; x < 322; x += 9) s += `<circle cx="${x}" cy="${y}" r="3.3" fill="${(x / 9) % 4 < 2 ? "#e2483f" : "#f3ead6"}" stroke="${INK}" stroke-width="0.9"/>`;
  }
  // Escalerilla, flotador y hojas caídas
  s += `<path d="M300 26 v22 M314 26 v22 M300 34 h14 M300 42 h14" stroke="#c9ccd0" stroke-width="3" stroke-linecap="round"/><path d="M300 26 v22 M314 26 v22" stroke="${INK}" stroke-width="1"/>`;
  s += `<circle cx="80" cy="190" r="15" fill="none" stroke="#f08a24" stroke-width="8"/><circle cx="80" cy="190" r="15" fill="none" stroke="${INK}" stroke-width="1.4"/><path d="M68 181 l6 4 M92 199 l-6 -4" stroke="#fff" stroke-width="3"/>`;
  s += speckles(40, 40, 280, 170, 6, ["#6f8a3a", "#a08a3a"], 2, 4, 0.9, 61);
  if (withPoops) for (const [x, y, k] of [[120, 92, 1], [210, 140, 2], [260, 70, 3], [160, 180, 4]]) s += `<g transform="translate(${x - 24} ${y - 22})">${poopArt(k)}</g>`;
  s += vignette(W, H, "vig-pis");
  return sceneSvg(W, H, s, "mg-piscina");
}

/** Una caca flotando, con moscas (se recoge con el salabre). */
export function poopArt(seed: number): string {
  let s = `<ellipse cx="24" cy="36" rx="18" ry="5" fill="#0d3b52" opacity="0.35"/>`;
  const layers: [number, number, number][] = [[24, 30, 16], [24, 22, 12], [24, 15, 8]];
  layers.forEach(([cx, cy, rx], i) => {
    s += `<path d="${smoothPath(wobble(ellipsePts(cx, cy, rx, rx * 0.45 + 2, 12), 1, seed + i))}" fill="${i % 2 ? "#6b4524" : "#7d5530"}" stroke="${INK}" stroke-width="2"/>`;
    s += `<path d="M${cx - rx * 0.5} ${cy - 2} q${rx * 0.4} -3 ${rx * 0.8} 0" stroke="#a87a4a" stroke-width="1.6" fill="none" opacity="0.8"/>`;
  });
  s += `<path d="M24 8 q3 -4 0 -7" stroke="${INK}" stroke-width="1.6" fill="none"/>`;
  // Moscas
  for (const [x, y] of [[8, 6], [40, 10]]) {
    s += `<ellipse cx="${x - 3}" cy="${y - 3}" rx="3.5" ry="2" fill="#dfe8ef" opacity="0.8" stroke="${INK}" stroke-width="0.6"/><ellipse cx="${x + 3}" cy="${y - 3}" rx="3.5" ry="2" fill="#dfe8ef" opacity="0.8" stroke="${INK}" stroke-width="0.6"/><circle cx="${x}" cy="${y}" r="2.4" fill="${INK}"/>`;
  }
  return s;
}
export const poopSvg = (seed: number) => spriteSvg(48, 44, poopArt(seed));

/** Salabre: aro con red y mango de madera. */
export function netSvg(): string {
  let s = `<path d="M54 54 L86 86" stroke="#6b4426" stroke-width="7" stroke-linecap="round"/><path d="M54 54 L86 86" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
  s += `<circle cx="34" cy="34" r="26" fill="#ffffff" fill-opacity="0.18" stroke="#c9ccd0" stroke-width="5"/><circle cx="34" cy="34" r="26" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  let mesh = "";
  for (let i = -24; i <= 24; i += 6) mesh += `M${34 + i} 8 L${34 + i} 60 M8 ${34 + i} L60 ${34 + i} `;
  s += `<clipPath id="aro-salabre"><circle cx="34" cy="34" r="24"/></clipPath><path d="${mesh}" stroke="#f3ead6" stroke-width="1" opacity="0.8" clip-path="url(#aro-salabre)"/>`;
  return spriteSvg(92, 92, s);
}

// --------------------------------------------------------------------- riada

/** Puente Erillas de piedra bajo una tormenta, con el río desbordándose por tres brechas. */
export function floodScene(): string {
  const W = 360;
  const H = 260;
  if (mgUrl("escena-riada")) return floodScenePintada(W, H);
  let s = `<defs>${linearGradient("cielo-riada", [[0, "#1d2a33", 1], [1, "#46545a", 1]])}${linearGradient("agua-riada", [[0, "#5a7d86", 1], [1, "#2c4a54", 1]])}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#cielo-riada)"/>`;
  // Nubes de tormenta
  s += speckles(-20, -10, 400, 70, 14, ["#2b3a43", "#344650"], 26, 46, 0.95, 71);
  s += `<path d="M250 18 l-12 26 h10 l-8 22" stroke="#f3ead6" stroke-width="2.4" fill="none" opacity="0.8"/>`;
  // Orillas con cañas
  s += inkShape([[0, 150], [60, 140], [70, 260], [0, 260]], "#4c5a34", { seed: 72, amp: 2, ink: 2.4 });
  s += inkShape([[300, 140], [360, 150], [360, 260], [290, 260]], "#4c5a34", { seed: 73, amp: 2, ink: 2.4 });
  for (const x of [12, 22, 330, 344]) s += inkStroke([[x, 160], [x + 4, 128]], 2, "#27311c", x, 1.5);
  // Río crecido (clase mg-water: baja al poner sacos)
  s += `<g class="mg-water"><path d="${smoothPath(wobble([[0, 150], [90, 138], [180, 142], [270, 136], [360, 148], [360, 262], [0, 262]], 3, 74))}" fill="url(#agua-riada)" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < 9; i++) s += inkStroke([[20 + i * 38, 160 + (i % 3) * 22], [42 + i * 38, 156 + (i % 3) * 22]], 2, "#cfe3e6", 80 + i, 1.4, 0.7);
  s += `</g>`;
  // Puente: tablero, arcos y sillares
  s += inkShape([[44, 120], [316, 120], [316, 138], [44, 138]], "#a99a7e", { seed: 75, amp: 1, ink: 2.8 });
  for (const cx of [110, 250]) {
    s += inkShape([[cx - 50, 138], [cx + 50, 138], [cx + 50, 220], [cx + 34, 220], [cx + 34, 186], [cx + 20, 162], [cx, 156], [cx - 20, 162], [cx - 34, 186], [cx - 34, 220], [cx - 50, 220]], "#b9a98a", { seed: 76 + cx, amp: 1, ink: 2.8 });
    s += hatching(cx - 48, 140, 14, 78, 5, INK, 0.3, cx);
  }
  for (let y = 142; y < 220; y += 12) for (let x = 64 + ((y / 12) % 2) * 10; x < 300; x += 22) s += `<path d="M${x} ${y} h18" stroke="#7d6f58" stroke-width="1" opacity="0.6"/>`;
  // Pretil con tres brechas (las tapan los sacos)
  s += inkShape([[44, 104], [316, 104], [316, 120], [44, 120]], "#c9b998", { seed: 77, amp: 0.8, ink: 2.6 });
  for (const x of [96, 180, 264]) {
    s += `<rect class="mg-gap" x="${x - 20}" y="100" width="40" height="22" fill="#2c4a54" stroke="${INK}" stroke-width="2"/>`;
    s += `<path class="mg-gush" d="M${x - 14} 122 q4 22 -6 40 M${x} 122 q2 26 0 46 M${x + 14} 122 q-2 22 6 40" stroke="#cfe3e6" stroke-width="3" fill="none" opacity="0.85"/>`;
  }
  // Rama arrastrada por la corriente y lluvia
  s += inkStroke([[150, 236], [196, 226]], 3.4, "#4a3322", 78) + inkStroke([[176, 230], [186, 218]], 2, "#4a3322", 79);
  const rng = seededRng(90);
  let rain = "";
  for (let i = 0; i < 70; i++) {
    const x = rng() * W;
    const y = rng() * H;
    rain += `M${x.toFixed(1)} ${y.toFixed(1)} l-4 12 `;
  }
  s += `<path d="${rain}" stroke="#cfe3e6" stroke-width="1" opacity="0.45"/>`;
  s += vignette(W, H, "vig-riada");
  return sceneSvg(W, H, s, "mg-riada");
}

/** Riada sobre el fondo pintado del río: el puente con sus brechas va delante. Mismas clases que la versión SVG. */
function floodScenePintada(W: number, H: number): string {
  let s = mgFondo("escena-riada", W, H);
  s += `<rect width="${W}" height="${H}" fill="#1d2a33" opacity="0.25"/>`;
  s += `<path d="M250 18 l-12 26 h10 l-8 22" class="mg-rayo" stroke="#f3ead6" stroke-width="2.4" fill="none" opacity="0"/>`;
  // Río crecido (baja al poner sacos): agua turbia translúcida sobre el río pintado
  s += `<g class="mg-water" opacity="0.7"><path d="${smoothPath(wobble([[0, 160], [90, 150], [180, 154], [270, 148], [360, 158], [360, 262], [0, 262]], 3, 74))}" fill="#4f6d72" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < 9; i++) s += inkStroke([[20 + i * 38, 172 + (i % 3) * 22], [42 + i * 38, 168 + (i % 3) * 22]], 2, "#cfe3e6", 80 + i, 1.4, 0.7);
  s += `</g>`;
  // Puente de piedra (tablero, arcos y sillares)
  s += inkShape([[44, 120], [316, 120], [316, 138], [44, 138]], "#b5a383", { seed: 75, amp: 1, ink: 2.8 });
  for (const cx of [110, 250]) {
    s += inkShape([[cx - 50, 138], [cx + 50, 138], [cx + 50, 220], [cx + 34, 220], [cx + 34, 186], [cx + 20, 162], [cx, 156], [cx - 20, 162], [cx - 34, 186], [cx - 34, 220], [cx - 50, 220]], "#c2b090", { seed: 76 + cx, amp: 1, ink: 2.8 });
    s += hatching(cx - 48, 140, 14, 78, 5, INK, 0.3, cx);
  }
  for (let y = 142; y < 220; y += 12) for (let x = 64 + ((y / 12) % 2) * 10; x < 300; x += 22) s += `<path d="M${x} ${y} h18" stroke="#7d6f58" stroke-width="1" opacity="0.6"/>`;
  s += inkShape([[44, 104], [316, 104], [316, 120], [44, 120]], "#d2c2a0", { seed: 77, amp: 0.8, ink: 2.6 });
  for (const x of [96, 180, 264]) {
    s += `<rect class="mg-gap" x="${x - 20}" y="100" width="40" height="22" fill="#2c4a54" stroke="${INK}" stroke-width="2"/>`;
    s += `<path class="mg-gush" d="M${x - 14} 122 q4 22 -6 40 M${x} 122 q2 26 0 46 M${x + 14} 122 q-2 22 6 40" stroke="#cfe3e6" stroke-width="3" fill="none" opacity="0.85"/>`;
  }
  const rng = seededRng(90);
  let rain = "";
  for (let i = 0; i < 60; i++) rain += `M${(rng() * W).toFixed(1)} ${(rng() * H).toFixed(1)} l-4 12 `;
  s += `<path class="mg-lluvia" d="${rain}" stroke="#cfe3e6" stroke-width="1" opacity="0.4"/>`;
  s += vignette(W, H, "vig-riada");
  return sceneSvg(W, H, s, "mg-riada");
}

/** Saco terrero de arpillera, atado. */
export function sandbagSvg(seed: number): string {
  let s = `<ellipse cx="36" cy="40" rx="30" ry="5" fill="${INK}" fill-opacity="0.3"/>`;
  s += `<path d="${smoothPath(wobble([[6, 30], [10, 12], [36, 6], [62, 12], [66, 30], [58, 38], [14, 38]], 1.4, seed))}" fill="#b89a62" stroke="${INK}" stroke-width="2.4"/>`;
  s += hatching(10, 10, 54, 26, 4, "#8a6f40", 0.55, seed + 1, -1);
  s += hatching(10, 10, 54, 26, 6, "#d6bd86", 0.4, seed + 2);
  s += `<path d="M14 22 q22 6 44 0" stroke="#6b5230" stroke-width="1.4" stroke-dasharray="3 3" fill="none"/>`;
  s += `<path d="M58 14 q8 -6 10 2 q-4 4 -10 0" fill="#8a6f40" stroke="${INK}" stroke-width="1.6"/>`;
  return spriteSvg(72, 46, s);
}

// ------------------------------------------------------------- en el mapa

/** Charco de riada sobre el puente (mancha de agua turbia con espuma), 200×110. */
export function floodPuddleArt(): string {
  let s = `<path d="${smoothPath(wobble(ellipsePts(100, 58, 94, 46, 22), 7, 301))}" fill="#4f7480" fill-opacity="0.85" stroke="#1e3238" stroke-width="3"/>`;
  s += `<path d="${smoothPath(wobble(ellipsePts(100, 60, 72, 32, 18), 5, 302))}" fill="#5f8a94" fill-opacity="0.8"/>`;
  const rng = seededRng(303);
  for (let i = 0; i < 14; i++) {
    const x = 30 + rng() * 140;
    const y = 30 + rng() * 56;
    s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q8 -4 16 0" stroke="#d8ecef" stroke-width="2" fill="none" opacity="0.75"/>`;
  }
  s += speckles(20, 24, 160, 70, 18, ["#e6f2f3", "#b6d2d6"], 1, 3, 0.8, 304);
  s += inkStroke([[70, 70], [112, 60]], 3, "#4a3322", 305) + inkStroke([[96, 64], [104, 52]], 2, "#4a3322", 306);
  return s;
}
