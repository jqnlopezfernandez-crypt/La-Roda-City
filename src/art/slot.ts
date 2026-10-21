// Tragaperras del bar (la del Ludópata): mueble de madera y cromo con luces de feria,
// y símbolos propios del pueblo dibujados a tinta: aceituna rellena, naranja de Sevilla,
// cara del Abuelo con su boina, cubata, campana de la iglesia y el 7 de lunares (el premio gordo).

import { INK, ellipsePts, hatching, inkShape, inkStroke, linearGradient, radialGradient, rectPts, smoothPath, wobble } from "./svg";

export const SLOT_SYMBOLS = ["aceituna", "naranja", "abuelo", "cubata", "campana", "siete"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

const sym = (body: string, defs = "") =>
  `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
const blob = (cx: number, cy: number, rx: number, ry: number, fill: string, seed: number, ink = 2.4, n = 12) =>
  `<path d="${smoothPath(wobble(ellipsePts(cx, cy, rx, ry, n), 1.1, seed))}" fill="${fill}" stroke="${INK}" stroke-width="${ink}" stroke-linejoin="round"/>`;
const shine = (d: string, w = 2.6) => `<path d="${d}" stroke="#fff" stroke-opacity="0.6" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

/** Dibujos de los símbolos (SVG completos de 60×60). */
export const SLOT_ART: Record<SlotSymbol, () => string> = {
  aceituna: () => {
    let s = `<ellipse cx="31" cy="52" rx="17" ry="3.5" fill="${INK}" opacity="0.25"/>`;
    // Palillo que atraviesa dos aceitunas
    s += inkStroke([[10, 50], [50, 8]], 2.6, "#c79a5b", 2, 0.4);
    s += blob(24, 36, 12, 14, "url(#ac-g)", 3);
    s += blob(38, 22, 10, 12, "url(#ac-g)", 4);
    // Relleno de pimiento
    s += blob(27, 30, 4.5, 3.6, "#d23b2a", 5, 1.6, 8) + blob(40, 17, 4, 3.2, "#d23b2a", 6, 1.6, 8);
    s += shine("M17 34 q1 -7 6 -9") + shine("M32 20 q1 -5 5 -7", 2.2);
    s += hatching(26, 38, 9, 10, 3, INK, 0.25, 7);
    return sym(s, radialGradient("ac-g", [[0, "#9bbd4a", 1], [1, "#4f7424", 1]], 0.35, 0.3, 0.75));
  },
  naranja: () => {
    let s = `<ellipse cx="30" cy="53" rx="18" ry="3.5" fill="${INK}" opacity="0.25"/>`;
    s += blob(30, 33, 19, 18, "url(#na-g)", 11, 2.6, 14);
    // Poros de la piel
    for (const [x, y] of [[22, 30], [27, 40], [36, 37], [38, 27], [31, 26], [22, 39], [40, 43]]) s += `<circle cx="${x}" cy="${y}" r="0.9" fill="#b0521a" opacity="0.7"/>`;
    // Rabito y dos hojas
    s += inkStroke([[30, 16], [31, 10]], 2.4, "#5a3b1e", 12, 0.3);
    s += inkShape([[31, 12], [42, 4], [50, 8], [44, 15], [33, 15]], "#3f7a2c", { seed: 13, amp: 0.6, ink: 2, smooth: true });
    s += inkShape([[30, 13], [21, 6], [14, 10], [20, 16], [29, 16]], "#4f8e34", { seed: 14, amp: 0.6, ink: 2, smooth: true });
    s += inkStroke([[34, 13], [45, 8]], 1, "#204a18", 15, 0.2);
    s += shine("M17 28 q3 -8 10 -10", 3);
    return sym(s, radialGradient("na-g", [[0, "#ffb347", 1], [0.7, "#f07b1a", 1], [1, "#c95a10", 1]], 0.35, 0.3, 0.8));
  },
  abuelo: () => {
    // El Abuelo: cara redonda, boina ladeada, gafas redondas y bigotazo blanco
    let s = `<ellipse cx="30" cy="55" rx="16" ry="3" fill="${INK}" opacity="0.25"/>`;
    s += blob(30, 34, 17, 18, "url(#ab-g)", 21, 2.6, 14);
    s += blob(13, 35, 3.5, 5, "#e9a982", 22, 2, 8) + blob(47, 35, 3.5, 5, "#e9a982", 23, 2, 8);
    // Boina
    s += `<path d="${smoothPath(wobble([[9, 22], [14, 13], [26, 8], [40, 9], [51, 15], [53, 21], [44, 24], [30, 25], [16, 25]], 0.8, 24))}" fill="url(#ab-b)" stroke="${INK}" stroke-width="2.4"/>`;
    s += inkStroke([[33, 8.5], [35, 4]], 2.6, INK, 25, 0.2);
    s += shine("M16 17 q8 -6 18 -7", 2);
    // Cejas blancas, gafas y nariz
    s += inkStroke([[17, 28], [26, 27]], 2.6, "#f4f1ea", 26, 0.3) + inkStroke([[34, 27], [43, 28]], 2.6, "#f4f1ea", 27, 0.3);
    s += `<circle cx="22.5" cy="33" r="5.5" fill="#dff1f7" fill-opacity="0.6" stroke="${INK}" stroke-width="2"/><circle cx="37.5" cy="33" r="5.5" fill="#dff1f7" fill-opacity="0.6" stroke="${INK}" stroke-width="2"/><path d="M28 33 h4" stroke="${INK}" stroke-width="2"/>`;
    s += `<circle cx="23" cy="34" r="1.5" fill="${INK}"/><circle cx="37" cy="34" r="1.5" fill="${INK}"/>`;
    s += blob(30, 40, 3.6, 3.2, "#d98a68", 28, 1.8, 8);
    // Bigote y barba blancos
    s += `<path d="${smoothPath(wobble([[18, 45], [24, 42], [30, 44], [36, 42], [42, 45], [38, 48], [30, 47], [22, 48]], 0.6, 29))}" fill="#f7f4ee" stroke="${INK}" stroke-width="2"/>`;
    s += `<path d="M22 48 q8 6 16 0" stroke="${INK}" stroke-width="1.6" fill="#ece7dc"/>`;
    return sym(s, radialGradient("ab-g", [[0, "#f7c9a6", 1], [1, "#dd9a74", 1]], 0.4, 0.35, 0.7) + linearGradient("ab-b", [[0, "#3b3f52", 1], [1, "#171923", 1]]));
  },
  cubata: () => {
    let s = `<ellipse cx="30" cy="55" rx="14" ry="3" fill="${INK}" opacity="0.25"/>`;
    // Vaso de tubo con cola, hielos, rodaja de limón y pajita
    s += inkShape([[16, 12], [44, 12], [41, 54], [19, 54]], "#eef6fb", { seed: 31, amp: 0.6, ink: 2.6, opacity: 0.55 });
    s += inkShape([[17.5, 22], [42.5, 22], [41, 52], [19, 52]], "url(#cu-g)", { seed: 32, amp: 0.5, ink: 0 });
    s += inkShape(rectPts(21, 23, 9, 8), "#dff3ff", { seed: 33, amp: 0.8, ink: 1.4, opacity: 0.85 });
    s += inkShape(rectPts(30, 30, 9, 8), "#dff3ff", { seed: 34, amp: 0.8, ink: 1.4, opacity: 0.85 });
    for (const [x, y] of [[24, 44], [33, 47], [28, 38], [36, 41]]) s += `<circle cx="${x}" cy="${y}" r="1.1" fill="#fff" opacity="0.7"/>`;
    s += inkStroke([[34, 30], [46, 4]], 3, "#e0453a", 35, 0.2) + inkStroke([[35, 27], [41, 13]], 1.4, "#fff", 36, 0.2, 0.7);
    s += `<path d="M38 12 a9 9 0 0 1 18 0Z" fill="#f4e04d" stroke="${INK}" stroke-width="2"/><path d="M41 12 a6 6 0 0 1 12 0" fill="#fbf3a0" stroke="#c9b52f" stroke-width="1.2"/><path d="M47 6 v6 M43 8 l4 4 l4 -4" stroke="#c9b52f" stroke-width="1" fill="none"/>`;
    s += shine("M20 16 l-0.5 30", 2);
    return sym(s, linearGradient("cu-g", [[0, "#7a3a18", 1], [1, "#2e1208", 1]]));
  },
  campana: () => {
    let s = `<ellipse cx="30" cy="54" rx="18" ry="3.5" fill="${INK}" opacity="0.25"/>`;
    // Campana de bronce de la iglesia con su yugo de madera
    s += inkShape(rectPts(20, 4, 20, 6), "#7a4d2a", { seed: 41, amp: 0.4, ink: 2 });
    s += `<path d="${smoothPath(wobble([[30, 9], [40, 12], [43, 24], [45, 38], [52, 46], [8, 46], [15, 38], [17, 24], [20, 12]], 0.8, 42))}" fill="url(#ca-g)" stroke="${INK}" stroke-width="2.6"/>`;
    s += inkStroke([[11, 41], [49, 41]], 1.6, "#7d5410", 43, 0.4);
    s += inkStroke([[17, 22], [43, 22]], 1.2, "#7d5410", 44, 0.4);
    s += blob(30, 49, 4.5, 4, "#a8761f", 45, 2, 8);
    s += shine("M22 15 q-3 12 -4 22", 3);
    // Ondas del tañido
    s += `<path d="M5 22 q-3 6 0 12 M55 22 q3 6 0 12" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.6"/>`;
    return sym(s, linearGradient("ca-g", [[0, "#f3cf6a", 1], [0.55, "#d29a2c", 1], [1, "#8d5d14", 1]], 0, 0, 1, 0));
  },
  siete: () => {
    // El 7 de feria: rojo con lunares blancos y ribete dorado
    const seven = `M12 10 L50 10 L50 18 Q38 30 33 52 L20 52 Q25 32 37 20 L12 20 Z`;
    let s = `<ellipse cx="30" cy="55" rx="16" ry="3" fill="${INK}" opacity="0.25"/>`;
    s += `<path d="${seven}" fill="#f2c14e" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
    s += `<path d="${seven}" fill="url(#si-g)" stroke="#f2c14e" stroke-width="3" stroke-linejoin="round"/>`;
    s += `<clipPath id="si-c"><path d="${seven}"/></clipPath><g clip-path="url(#si-c)" fill="#fff6e8">`;
    for (const [x, y] of [[16, 15], [26, 14], [37, 15], [46, 14], [41, 25], [33, 33], [28, 42], [25, 50], [36, 23]]) s += `<circle cx="${x}" cy="${y}" r="2.3"/>`;
    s += `</g>`;
    s += shine("M15 13 h12", 2);
    return sym(s, linearGradient("si-g", [[0, "#e8352b", 1], [1, "#9c1414", 1]]));
  },
};

/**
 * Mueble de la tragaperras (300×460). La ventana de rodillos queda en
 * x 42–258, y 150–282 (la interfaz coloca allí los rodillos en HTML). Las bombillas
 * llevan la clase "bulb" para que la interfaz las haga parpadear.
 */
export function slotCabinetSvg(): string {
  const W = 300;
  const H = 460;
  let s = `<defs>
    ${linearGradient("sl-mad", [[0, "#8a4a26", 1], [0.5, "#6b3518", 1], [1, "#4a220e", 1]], 0, 0, 1, 0)}
    ${linearGradient("sl-crom", [[0, "#f4f4f2", 1], [0.45, "#9ea3a8", 1], [0.55, "#d9dde0", 1], [1, "#6f757a", 1]])}
    ${linearGradient("sl-rojo", [[0, "#d8342a", 1], [1, "#7c1010", 1]])}
    ${linearGradient("sl-pan", [[0, "#1d1430", 1], [1, "#3a1f4a", 1]])}
    ${radialGradient("sl-luz", [[0, "#fff6c8", 1], [0.6, "#ffcf4a", 1], [1, "#c77d12", 1]])}
  </defs>`;
  // Sombra en el suelo
  s += `<ellipse cx="150" cy="452" rx="128" ry="8" fill="${INK}" opacity="0.4"/>`;
  // Cuerpo de madera
  s += inkShape([[22, 70], [278, 70], [284, 446], [16, 446]], "url(#sl-mad)", { seed: 1, amp: 1, ink: 3.4 });
  s += hatching(240, 76, 40, 360, 7, "#2a1208", 0.35, 2);
  // Vetas de la madera
  for (let i = 0; i < 6; i++) s += inkStroke([[30 + i * 4, 300 + i * 20], [70 + i * 6, 296 + i * 22], [120, 302 + i * 20]], 1, "#3b1a0a", 10 + i, 1.4, 0.4);
  // Frontón con el cartel luminoso
  s += inkShape([[10, 74], [150, 6], [290, 74]], "url(#sl-rojo)", { seed: 3, amp: 0.8, ink: 3.4 });
  s += inkShape([[36, 70], [150, 20], [264, 70]], "#ffde7a", { seed: 4, amp: 0.6, ink: 2.4 });
  s += `<text x="150" y="62" font-family="'Ranchers','Nunito',sans-serif" font-size="25" font-weight="900" fill="#9c1414" text-anchor="middle" letter-spacing="1" stroke="#fff6e8" stroke-width="0.8">LA RODEÑA</text>`;
  // Bombillas del frontón (parpadean)
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = 16 + t * 268;
    const y = 72 - (1 - Math.abs(t - 0.5) * 2) * 64;
    s += `<circle class="bulb b${i % 3}" cx="${x.toFixed(1)}" cy="${(y - 2).toFixed(1)}" r="5" fill="url(#sl-luz)" stroke="${INK}" stroke-width="1.6"/>`;
  }
  // Marco cromado de los rodillos
  s += inkShape(rectPts(28, 92, 244, 206), "url(#sl-crom)", { seed: 5, amp: 0.6, ink: 3 });
  s += inkShape(rectPts(36, 100, 228, 190), "url(#sl-pan)", { seed: 6, amp: 0.4, ink: 2.4 });
  s += `<text x="150" y="128" font-family="'Nunito',sans-serif" font-size="13" font-weight="900" fill="#ffde7a" text-anchor="middle" letter-spacing="3">★ 7 · 7 · 7 = PREMIO ★</text>`;
  // Hueco negro donde van los rodillos (la interfaz los pone encima)
  s += `<rect x="42" y="148" width="216" height="136" rx="6" fill="#0d0a10" stroke="${INK}" stroke-width="2.4"/>`;
  // Bombillas laterales del marco
  for (let i = 0; i < 6; i++) {
    s += `<circle class="bulb b${i % 3}" cx="32" cy="${110 + i * 34}" r="4" fill="url(#sl-luz)" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<circle class="bulb b${(i + 1) % 3}" cx="268" cy="${110 + i * 34}" r="4" fill="url(#sl-luz)" stroke="${INK}" stroke-width="1.4"/>`;
  }
  // Panel de mandos: ranura de monedas, botones y contador
  s += inkShape(rectPts(36, 310, 228, 54), "#2a1c20", { seed: 7, amp: 0.6, ink: 2.6 });
  s += inkShape(rectPts(48, 320, 70, 32), "#0f1a0f", { seed: 8, amp: 0.3, ink: 2 });
  s += `<text class="slot-led" x="83" y="343" font-family="'Courier New',monospace" font-size="18" font-weight="900" fill="#7dff6a" text-anchor="middle">0020</text>`;
  s += inkShape(rectPts(214, 318, 10, 30), "url(#sl-crom)", { seed: 9, amp: 0.3, ink: 2 });
  s += `<rect x="217.5" y="322" width="3" height="22" fill="#000"/>`;
  s += `<circle cx="146" cy="337" r="12" fill="#e8352b" stroke="${INK}" stroke-width="2.4"/><circle cx="183" cy="337" r="12" fill="#f2c14e" stroke="${INK}" stroke-width="2.4"/>`;
  s += shine("M139 331 q4 -5 10 -4", 2) + shine("M176 331 q4 -5 10 -4", 2);
  // Bandeja de premios
  s += inkShape(rectPts(70, 384, 160, 44), "url(#sl-crom)", { seed: 10, amp: 0.6, ink: 3 });
  s += inkShape(rectPts(80, 392, 140, 28), "#141012", { seed: 11, amp: 0.4, ink: 2 });
  // Pegatina de la casa
  s += `<g transform="rotate(-8 50 410)"><rect x="24" y="398" width="44" height="22" rx="3" fill="#fff6e8" stroke="${INK}" stroke-width="1.6"/><text x="46" y="413" font-family="'Nunito',sans-serif" font-size="9" font-weight="900" fill="#9c1414" text-anchor="middle">+18 ¡OLÉ!</text></g>`;
  return `<svg class="slot-cabinet" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/** Palanca del lateral (24×150, gira desde abajo). */
export function slotLeverSvg(): string {
  let s = `<defs>${radialGradient("pl-bola", [[0, "#ff8a7a", 1], [0.6, "#d8342a", 1], [1, "#7c1010", 1]], 0.35, 0.3, 0.7)}${linearGradient("pl-crom", [[0, "#f4f4f2", 1], [0.5, "#8e949a", 1], [1, "#d9dde0", 1]], 0, 0, 1, 0)}</defs>`;
  s += `<rect x="9" y="22" width="6" height="118" rx="3" fill="url(#pl-crom)" stroke="${INK}" stroke-width="2"/>`;
  s += `<circle cx="12" cy="14" r="11" fill="url(#pl-bola)" stroke="${INK}" stroke-width="2.4"/>`;
  s += shine("M6 10 q3 -5 8 -5", 2);
  s += inkShape(rectPts(2, 130, 20, 18), "url(#pl-crom)", { seed: 2, amp: 0.3, ink: 2 });
  return `<svg viewBox="0 0 24 150" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
