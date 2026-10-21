// Escenas ilustradas de los momentos de la partida: la reunión en la plaza del
// Ayuntamiento, el camino de salida del pueblo (el expulsado se va) y los efectos de
// una eliminación (viñeta "¡ZAS!", humo y el alma que sube). Tinta a mano, como el resto.

import { INK, ellipsePts, hatching, inkShape, inkStroke, linearGradient, radialGradient, rectPts, seededRng, smoothPath, speckles, wobble, type Point } from "./svg";

const svgDoc = (w: number, h: number, body: string, cls = "") =>
  `<svg ${cls ? `class="${cls}" ` : ""}viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${body}</svg>`;

/** Ventana con reja y maceta de geranios. */
function window_(x: number, y: number, w: number, h: number, seed: number, pot = true): string {
  let s = inkShape(rectPts(x - 3, y - 3, w + 6, h + 6), "#d9a441", { seed, amp: 0.5, ink: 1.8 });
  s += inkShape(rectPts(x, y, w, h), "#3b2a24", { seed: seed + 1, amp: 0.4, ink: 1.6 });
  for (let i = 1; i < 4; i++) s += `<line x1="${x + (w * i) / 4}" y1="${y}" x2="${x + (w * i) / 4}" y2="${y + h}" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${INK}" stroke-width="1.2"/>`;
  if (pot) {
    s += inkShape([[x + w * 0.2, y + h + 1], [x + w * 0.8, y + h + 1], [x + w * 0.7, y + h + 8], [x + w * 0.3, y + h + 8]], "#b8643a", { seed: seed + 2, amp: 0.3, ink: 1.4 });
    s += speckles(x + w * 0.15, y + h - 6, w * 0.7, 7, 6, ["#d8342a", "#4f8e34", "#e8524a"], 1.4, 2.6, 1, seed + 3);
  }
  return s;
}

/** Naranjo en su alcorque (copa redonda con naranjas). */
function orangeTree(cx: number, base: number, r: number, seed: number): string {
  let s = `<ellipse cx="${cx}" cy="${base}" rx="${r * 0.8}" ry="${r * 0.18}" fill="${INK}" opacity="0.3"/>`;
  s += inkShape([[cx - 3, base], [cx - 2, base - r * 0.9], [cx + 2, base - r * 0.9], [cx + 3, base]], "#6b4a2e", { seed, amp: 0.5, ink: 1.8 });
  s += `<path d="${smoothPath(wobble(ellipsePts(cx, base - r * 1.4, r, r * 0.85, 14), r * 0.18, seed + 1))}" fill="#3f6e2c" stroke="${INK}" stroke-width="2.2"/>`;
  s += `<path d="${smoothPath(wobble(ellipsePts(cx - r * 0.25, base - r * 1.6, r * 0.55, r * 0.4, 10), r * 0.1, seed + 2))}" fill="#5c8f3a" opacity="0.9"/>`;
  const rng = seededRng(seed + 3);
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * r * 0.75;
    s += `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(base - r * 1.4 + Math.sin(a) * d * 0.8).toFixed(1)}" r="${(r * 0.09).toFixed(1)}" fill="#f08a1c" stroke="${INK}" stroke-width="1"/>`;
  }
  return s;
}

/** Farola fernandina. */
function streetLamp(x: number, base: number, h: number, seed: number): string {
  let s = inkStroke([[x, base], [x, base - h]], 3, INK, seed, 0.3);
  s += inkShape([[x - 7, base - h - 2], [x + 7, base - h - 2], [x + 5, base - h - 16], [x - 5, base - h - 16]], "#ffe7a3", { seed: seed + 1, amp: 0.3, ink: 1.8 });
  s += `<path d="M${x - 8} ${base - h - 16} L${x} ${base - h - 22} L${x + 8} ${base - h - 16}Z" fill="${INK}"/>`;
  s += `<circle cx="${x}" cy="${base - h - 9}" r="22" fill="url(#luz-farola)"/>`;
  return s;
}

/** Banderitas de feria colgadas entre dos puntos. */
function bunting(x0: number, y0: number, x1: number, y1: number, sag: number, seed: number): string {
  const colors = ["#d8342a", "#f3ead6", "#3f8a4a", "#f2c14e"];
  const pts: Point[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag]);
  }
  let s = `<path d="${smoothPath(pts, false)}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    s += inkShape([[ax + 1, ay], [bx - 1, by], [(ax + bx) / 2, (ay + by) / 2 + 13]], colors[(i + seed) % colors.length], { seed: seed + i, amp: 0.6, ink: 1.2 });
  }
  return s;
}

/**
 * Plaza del Ayuntamiento a la caída de la tarde (640×360): fachada encalada con
 * albero, balcones, espadaña con campana, casas a los lados, naranjos, farolas y
 * banderitas de feria. Los vecinos se colocan encima (en HTML) sobre el empedrado.
 */
export function plazaMeetingScene(): string {
  const W = 640;
  const H = 360;
  let s = `<defs>
    ${linearGradient("pz-cielo", [[0, "#3d2f5a", 1], [0.55, "#c46d55", 1], [1, "#f2b46a", 1]])}
    ${linearGradient("pz-suelo", [[0, "#cbb48a", 1], [1, "#a88b62", 1]])}
    ${radialGradient("luz-farola", [[0, "#ffe7a3", 0.55], [1, "#ffe7a3", 0]])}
    ${radialGradient("pz-sol", [[0, "#fff1c4", 0.9], [1, "#fff1c4", 0]])}
  </defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#pz-cielo)"/>`;
  s += `<circle cx="520" cy="120" r="120" fill="url(#pz-sol)"/>`;
  // Nubes largas de atardecer
  for (const [x, y, w] of [[60, 50, 120], [420, 34, 150], [250, 80, 90]] as const)
    s += `<path d="${smoothPath(wobble(ellipsePts(x + w / 2, y, w / 2, 7, 12), 2.5, x))}" fill="#f6c99a" opacity="0.55"/>`;
  // Casas de los lados (encaladas, con tejado de teja)
  for (const [x0, x1, top, seed] of [[-10, 170, 120, 3], [470, 650, 112, 9]] as const) {
    s += inkShape([[x0, 262], [x0, top], [x1, top], [x1, 262]], "#efe4cc", { seed, amp: 1, ink: 2.6 });
    s += inkShape([[x0 - 6, top + 2], [x1 + 6, top + 2], [x1 - 2, top - 16], [x0 + 2, top - 16]], "#a4553a", { seed: seed + 1, amp: 1, ink: 2.4 });
    for (let x = x0 + 8; x < x1 - 4; x += 12) s += `<path d="M${x} ${top - 14} q4 8 0 15" stroke="#6e3524" stroke-width="1.2" fill="none" opacity="0.7"/>`;
    s += hatching(x0, top + 4, x1 - x0, 140, 9, "#b9a888", 0.25, seed + 2);
    s += window_(x0 + 30, top + 26, 26, 34, seed + 3) + window_(x1 - 62, top + 26, 26, 34, seed + 4);
    s += inkShape(rectPts((x0 + x1) / 2 - 14, 210, 28, 52), "#5b3a26", { seed: seed + 5, amp: 0.5, ink: 2 });
    s += `<rect x="${x0}" y="246" width="${x1 - x0}" height="16" fill="#d9a441" opacity="0.85"/>`;
  }
  // Ayuntamiento: cuerpo, cornisa de albero, espadaña con campana y reloj
  s += inkShape([[170, 262], [170, 96], [470, 96], [470, 262]], "#f6eedb", { seed: 20, amp: 0.8, ink: 3 });
  s += hatching(420, 100, 48, 160, 8, "#bba98a", 0.3, 21);
  s += inkShape(rectPts(164, 88, 312, 12), "#d9a441", { seed: 22, amp: 0.5, ink: 2.4 });
  s += inkShape([[266, 90], [266, 40], [320, 18], [374, 40], [374, 90]], "#f6eedb", { seed: 23, amp: 0.6, ink: 2.8 });
  s += `<path d="M300 66 a20 22 0 0 1 40 0 v22 h-40Z" fill="#3b2a24" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M310 60 q10 -12 20 0 l2 12 h-24Z" fill="#c9922c" stroke="${INK}" stroke-width="1.8"/><circle cx="320" cy="74" r="2.4" fill="${INK}"/>`;
  s += `<circle cx="320" cy="38" r="9" fill="#fff8ea" stroke="${INK}" stroke-width="2"/><path d="M320 38 v-6 M320 38 l4 2" stroke="${INK}" stroke-width="1.6"/>`;
  s += inkStroke([[320, 18], [320, 6]], 2, INK, 24, 0.2) + inkStroke([[314, 10], [326, 10]], 2, INK, 25, 0.2);
  // Planta alta: tres balcones con barandilla de hierro
  for (const x of [196, 296, 396]) {
    s += inkShape(rectPts(x, 112, 48, 56), "#4a332a", { seed: x, amp: 0.4, ink: 2 });
    s += `<path d="M${x} 112 h48 v8 h-48Z" fill="#d9a441" stroke="${INK}" stroke-width="1.4"/>`;
    s += inkShape(rectPts(x - 6, 160, 60, 5), "#8f8a80", { seed: x + 1, amp: 0.3, ink: 1.6 });
    for (let i = 0; i <= 8; i++) s += `<line x1="${x - 4 + i * 7}" y1="${142}" x2="${x - 4 + i * 7}" y2="160" stroke="${INK}" stroke-width="1.3"/>`;
    s += `<line x1="${x - 6}" y1="142" x2="${x + 54}" y2="142" stroke="${INK}" stroke-width="2"/>`;
    s += speckles(x - 4, 150, 56, 8, 7, ["#d8342a", "#4f8e34"], 1.3, 2.4, 1, x + 2);
  }
  // Planta baja: soportales con tres arcos
  for (const x of [190, 280, 370]) {
    s += `<path d="M${x} 262 v-46 a40 32 0 0 1 80 0 v46Z" fill="#3b2a24" stroke="${INK}" stroke-width="2.6"/>`;
    s += `<path d="M${x + 6} 262 v-44 a34 26 0 0 1 68 0 v44" fill="none" stroke="#d9a441" stroke-width="3" opacity="0.8"/>`;
  }
  s += inkShape(rectPts(296, 222, 48, 40), "#6b4226", { seed: 30, amp: 0.4, ink: 2 });
  s += `<text x="320" y="186" font-family="Rye, Georgia, serif" font-size="13" fill="${INK}" text-anchor="middle" letter-spacing="1">AYUNTAMIENTO</text>`;
  // Banderitas de feria y farolas
  s += bunting(-10, 70, 330, 104, 26, 1) + bunting(310, 104, 650, 66, 26, 2);
  s += streetLamp(150, 262, 92, 41) + streetLamp(490, 262, 92, 42);
  // Suelo de la plaza: albero con baldosas en perspectiva y empedrado
  s += `<path d="M0 262 H640 V360 H0Z" fill="url(#pz-suelo)"/>`;
  for (let i = -8; i <= 8; i++) s += `<line x1="${320 + i * 40}" y1="262" x2="${320 + i * 110}" y2="360" stroke="#8a7152" stroke-width="1" opacity="0.45"/>`;
  for (const y of [276, 296, 322, 352]) s += `<line x1="0" y1="${y}" x2="640" y2="${y}" stroke="#8a7152" stroke-width="1" opacity="0.4"/>`;
  s += speckles(0, 264, 640, 96, 70, ["#b39a72", "#d8c49c", "#8f7656"], 1, 3, 0.6, 50);
  s += `<path d="M0 262 H640" stroke="${INK}" stroke-width="2.4"/>`;
  // Naranjos en alcorque, delante de las casas
  s += orangeTree(40, 300, 30, 60) + orangeTree(600, 300, 30, 61);
  // Viñeta
  s += `<defs>${radialGradient("pz-vig", [[0.6, "#000", 0], [1, "#000", 0.5]], 0.5, 0.5, 0.75)}</defs><rect width="${W}" height="${H}" fill="url(#pz-vig)"/>`;
  return svgDoc(W, H, s, "mt-bg");
}

/**
 * Camino de salida del pueblo al atardecer (640×360): olivares en hileras que se
 * pierden en el horizonte, la carretera hacia el punto de fuga (320, 176), el cartel
 * de fin de población tachado y el perro del pueblo mirando.
 */
export function roadOutScene(): string {
  const W = 640;
  const H = 360;
  const VX = 320;
  const VY = 176;
  let s = `<defs>
    ${linearGradient("rd-cielo", [[0, "#2c2346", 1], [0.5, "#a4505a", 1], [0.85, "#f0a35a", 1], [1, "#ffd27a", 1]])}
    ${linearGradient("rd-campo", [[0, "#8a7a3f", 1], [1, "#5d5a2a", 1]])}
    ${radialGradient("rd-sol", [[0, "#fff3c2", 1], [0.4, "#ffd27a", 0.8], [1, "#ffd27a", 0]])}
  </defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#rd-cielo)"/>`;
  s += `<circle cx="${VX}" cy="${VY}" r="120" fill="url(#rd-sol)"/>`;
  s += `<path d="M${VX - 34} ${VY} a34 34 0 0 1 68 0Z" fill="#ffe9a8" stroke="#c9792c" stroke-width="2"/>`;
  // Lomas lejanas
  s += inkShape([[0, VY], [0, 158], [90, 146], [180, 160], [260, 150], [380, 162], [470, 148], [560, 156], [640, 150], [640, VY]], "#6a4e5e", { seed: 2, amp: 1.5, ink: 2, smooth: true });
  // Campo
  s += `<path d="M0 ${VY} H640 V360 H0Z" fill="url(#rd-campo)"/>`;
  // Olivares en hileras hacia el punto de fuga
  const rng = seededRng(7);
  for (let row = -9; row <= 9; row++) {
    if (Math.abs(row) < 2) continue;
    for (let k = 1; k <= 9; k++) {
      const t = (k / 9) ** 1.8;
      const x = VX + row * 70 * t;
      const y = VY + (H - VY + 30) * t;
      const r = 3 + 20 * t;
      if (x < -30 || x > W + 30) continue;
      s += `<ellipse cx="${x.toFixed(1)}" cy="${(y + r * 0.5).toFixed(1)}" rx="${(r * 0.9).toFixed(1)}" ry="${(r * 0.25).toFixed(1)}" fill="#2e2a14" opacity="0.35"/>`;
      s += `<path d="${smoothPath(wobble(ellipsePts(x, y - r * 0.4, r, r * 0.7, 10), r * 0.25, row * 31 + k))}" fill="${rng() < 0.5 ? "#6f7d45" : "#5f6d3a"}" stroke="${INK}" stroke-width="${(0.6 + t * 1.6).toFixed(1)}"/>`;
    }
  }
  // Carretera con línea discontinua
  s += inkShape([[VX - 3, VY], [VX + 3, VY], [470, 360], [170, 360]], "#5a5550", { seed: 11, amp: 0.6, ink: 2.4 });
  s += `<path d="M${VX - 3} ${VY} L170 360 M${VX + 3} ${VY} L470 360" stroke="#d8d0bc" stroke-width="2" opacity="0.6"/>`;
  for (let k = 0; k < 9; k++) {
    const t0 = (k / 9) ** 1.6;
    const t1 = ((k + 0.45) / 9) ** 1.6;
    s += `<line x1="${VX}" y1="${VY + (H - VY) * t0}" x2="${VX}" y2="${VY + (H - VY) * t1}" stroke="#f3ead6" stroke-width="${(1 + t1 * 4).toFixed(1)}" stroke-linecap="round"/>`;
  }
  // Cartel de fin de población (tachado en rojo)
  s += inkStroke([[540, 330], [540, 230]], 4, "#8f8a80", 12, 0.3);
  s += inkShape(rectPts(476, 196, 128, 52), "#f8f4ea", { seed: 13, amp: 0.6, ink: 3 });
  s += `<rect x="482" y="202" width="116" height="40" fill="none" stroke="${INK}" stroke-width="2"/>`;
  s += `<text x="540" y="218" font-family="'Nunito',sans-serif" font-size="11" font-weight="900" fill="${INK}" text-anchor="middle">LA RODA DE</text>`;
  s += `<text x="540" y="234" font-family="'Nunito',sans-serif" font-size="11" font-weight="900" fill="${INK}" text-anchor="middle">ANDALUCÍA</text>`;
  s += `<path d="M484 244 L596 200" stroke="#d8342a" stroke-width="6" stroke-linecap="round" stroke-opacity="0.85"/>`;
  // Última casa del pueblo a la izquierda, con su farol
  s += inkShape([[-10, 300], [-10, 150], [96, 150], [96, 300]], "#efe4cc", { seed: 14, amp: 1, ink: 2.6 });
  s += inkShape([[-14, 152], [102, 152], [92, 134], [-4, 134]], "#a4553a", { seed: 15, amp: 1, ink: 2.4 });
  s += window_(30, 180, 26, 34, 16);
  s += `<rect x="-10" y="284" width="106" height="16" fill="#d9a441" opacity="0.85"/>`;
  // El perro del pueblo, sentado, mirando cómo se va
  s += `<g transform="translate(118 300)">
    <ellipse cx="0" cy="26" rx="22" ry="5" fill="${INK}" opacity="0.3"/>
    <path d="${smoothPath(wobble([[-14, 24], [-16, 6], [-8, -6], [4, -4], [10, 8], [12, 24]], 0.6, 3))}" fill="#c98a4a" stroke="${INK}" stroke-width="2.2"/>
    <path d="${smoothPath(wobble(ellipsePts(-2, -14, 10, 9, 10), 0.6, 4))}" fill="#c98a4a" stroke="${INK}" stroke-width="2.2"/>
    <path d="M-10 -20 q-6 4 -4 12 q4 -2 6 -8Z M4 -22 q6 2 6 10 q-4 -1 -6 -6Z" fill="#8a5a2c" stroke="${INK}" stroke-width="1.6"/>
    <circle cx="-5" cy="-15" r="1.4" fill="${INK}"/><circle cx="2" cy="-15" r="1.4" fill="${INK}"/><ellipse cx="-1" cy="-9" rx="2.6" ry="1.8" fill="${INK}"/>
    <path class="rd-cola" d="M12 20 q14 -2 16 -14" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>`;
  s += `<defs>${radialGradient("rd-vig", [[0.6, "#000", 0], [1, "#000", 0.55]], 0.5, 0.5, 0.75)}</defs><rect width="${W}" height="${H}" fill="url(#rd-vig)"/>`;
  return svgDoc(W, H, s, "rd-bg");
}

/** Viñeta de cómic "¡ZAS!" (estallido de tinta), 120×90. */
export function zasBurstArt(): string {
  const pts: Point[] = [];
  const rng = seededRng(5);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r = i % 2 ? 26 + rng() * 6 : 42 + rng() * 10;
    pts.push([60 + Math.cos(a) * r * 1.25, 45 + Math.sin(a) * r * 0.95]);
  }
  let s = `<path d="M${pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L")}Z" fill="#ffd23a" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>`;
  s += `<path d="${smoothPath(wobble(ellipsePts(60, 45, 30, 20, 12), 2, 6))}" fill="#fff3b0" opacity="0.8"/>`;
  s += `<text x="60" y="54" font-family="'Ranchers','Rye',Georgia,serif" font-size="26" font-weight="900" fill="#d8342a" stroke="${INK}" stroke-width="1.4" text-anchor="middle" transform="rotate(-8 60 45)">¡ZAS!</text>`;
  return s;
}

/** Alma que sale del cuerpo: fantasmilla blanca con boina (40×52). */
export function soulArt(): string {
  let s = `<path d="M8 50 q-2 -26 6 -36 q6 -10 14 -8 q10 2 10 18 q0 14 2 26 l-5 -4 l-4 5 l-4 -5 l-5 5 l-4 -5 l-5 5Z" fill="#f4f8ff" fill-opacity="0.92" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
  s += `<path d="M12 12 q6 -9 16 -8 q8 1 10 6 q-12 -2 -26 2Z" fill="#2b2b38" stroke="${INK}" stroke-width="1.6"/>`;
  s += `<path d="M16 24 q3 -3 6 0 M26 24 q3 -3 6 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M18 31 q6 4 12 0" stroke="${INK}" stroke-width="1.6" fill="#ffffff"/>`;
  return s;
}

/** Nube de polvo (para caídas y golpes), 60×40. */
export function dustPuffArt(): string {
  let s = "";
  for (const [x, y, r, seed] of [[18, 26, 12, 1], [32, 20, 15, 2], [46, 27, 11, 3], [30, 30, 12, 4]] as const)
    s += `<path d="${smoothPath(wobble(ellipsePts(x, y, r, r * 0.8, 10), 2, seed))}" fill="#e8dcc2" stroke="${INK}" stroke-width="1.8"/>`;
  s += hatching(20, 24, 30, 10, 4, "#a89a7c", 0.5, 5);
  return s;
}

/** Papeleta de voto doblada con una cruz (para la reunión), 40×40. */
export function ballotSvg(): string {
  let s = inkShape([[6, 10], [34, 6], [36, 34], [8, 36]], "#fbf6ea", { seed: 3, amp: 0.6, ink: 2.2 });
  s += `<path d="M8 20 L35 17" stroke="#c9bfa8" stroke-width="1.2"/>`;
  s += `<path d="M15 12 l10 12 M25 12 l-10 12" stroke="#d8342a" stroke-width="3" stroke-linecap="round" transform="translate(0 2)"/>`;
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/** Sello de goma "ERA IMPOSTOR" / "NO ERA IMPOSTOR" (220×70). */
export function stampSvg(impostor: boolean): string {
  const c = impostor ? "#d8342a" : "#3f8a4a";
  const t = impostor ? "ERA IMPOSTOR" : "NO ERA IMPOSTOR";
  let s = `<g transform="rotate(-7 110 35)" opacity="0.92">`;
  s += `<rect x="8" y="10" width="204" height="50" rx="8" fill="none" stroke="${c}" stroke-width="5"/>`;
  s += `<rect x="15" y="17" width="190" height="36" rx="5" fill="none" stroke="${c}" stroke-width="2"/>`;
  s += `<text x="110" y="44" font-family="'Rye',Georgia,serif" font-size="${impostor ? 23 : 19}" fill="${c}" text-anchor="middle" letter-spacing="1">${t}</text>`;
  s += speckles(12, 12, 196, 46, 26, ["#fff"], 0.6, 1.8, 0.55, 9);
  s += `</g>`;
  return `<svg viewBox="0 0 220 70" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/** Rodamundos (planta seca rodando) para cuando nadie se va, 50×50. */
export function tumbleweedSvg(): string {
  const rng = seededRng(4);
  let s = "";
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI;
    const r = 12 + rng() * 10;
    s += `<ellipse cx="25" cy="25" rx="${r.toFixed(1)}" ry="${(r * (0.4 + rng() * 0.5)).toFixed(1)}" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} 25 25)" fill="none" stroke="${i % 3 ? "#9a7a44" : INK}" stroke-width="${i % 3 ? 1.2 : 1.6}"/>`;
  }
  return `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

/** Emblema de cada papel para la pantalla de revelación (SVG 64×64). */
export function roleEmblemSvg(role: string): string {
  let s = `<ellipse cx="32" cy="58" rx="20" ry="4" fill="${INK}" opacity="0.3"/>`;
  const blob = (cx: number, cy: number, rx: number, ry: number, fill: string, seed: number, ink = 2.6) =>
    `<path d="${smoothPath(wobble(ellipsePts(cx, cy, rx, ry, 12), 1, seed))}" fill="${fill}" stroke="${INK}" stroke-width="${ink}"/>`;
  switch (role) {
    case "sapo":
      // Sapo con cara de pocos amigos y un cuchillo
      s += blob(30, 38, 22, 16, "#6f9a3a", 1);
      s += blob(20, 24, 7, 7, "#86b04a", 2) + blob(40, 24, 7, 7, "#86b04a", 3);
      s += `<circle cx="20" cy="24" r="3.4" fill="#fff8d0" stroke="${INK}" stroke-width="1.4"/><circle cx="40" cy="24" r="3.4" fill="#fff8d0" stroke="${INK}" stroke-width="1.4"/>`;
      s += `<path d="M17 22 h6 M37 22 h6" stroke="${INK}" stroke-width="2"/><circle cx="20" cy="25" r="1.4" fill="${INK}"/><circle cx="40" cy="25" r="1.4" fill="${INK}"/>`;
      s += `<path d="M16 40 q14 6 28 0" stroke="${INK}" stroke-width="2.2" fill="none"/>`;
      s += speckles(14, 34, 32, 14, 6, ["#4f7424"], 1, 2, 0.8, 4);
      s += `<g transform="rotate(35 50 40)"><path d="M48 18 l5 0 l1 22 l-7 0Z" fill="#dfe4e8" stroke="${INK}" stroke-width="2"/><rect x="46" y="40" width="10" height="4" rx="1" fill="#6b4a2e" stroke="${INK}" stroke-width="1.6"/><rect x="48.5" y="44" width="5" height="10" rx="2" fill="#7a4d2a" stroke="${INK}" stroke-width="1.6"/></g>`;
      break;
    case "gitano":
      // Cesta de mimbre con asa
      s += `<path d="M14 30 q18 -30 36 0" fill="none" stroke="${INK}" stroke-width="5"/><path d="M14 30 q18 -30 36 0" fill="none" stroke="#c9944a" stroke-width="2.5"/>`;
      s += inkShape([[8, 30], [56, 30], [50, 54], [14, 54]], "#c9944a", { seed: 5, amp: 0.8, ink: 2.6 });
      for (let y = 34; y < 54; y += 5) s += inkStroke([[10 + (y - 30) * 0.25, y], [54 - (y - 30) * 0.25, y]], 1.2, "#7a5424", y, 0.5);
      for (let x = 14; x < 52; x += 6) s += inkStroke([[x, 31], [x + (32 - x) * 0.12, 53]], 1, "#7a5424", x, 0.4);
      s += inkShape(rectPts(6, 27, 52, 5), "#a87a3a", { seed: 6, amp: 0.4, ink: 2 });
      break;
    case "piromano":
      // Mechero con una llamarada
      s += inkShape(rectPts(22, 34, 20, 22), "#c4342a", { seed: 7, amp: 0.5, ink: 2.4 });
      s += inkShape(rectPts(22, 28, 20, 7), "#c9ced3", { seed: 8, amp: 0.3, ink: 2 });
      s += `<circle cx="38" cy="26" r="3.4" fill="#8f949a" stroke="${INK}" stroke-width="1.6"/>`;
      s += `<path d="${smoothPath(wobble([[24, 27], [20, 16], [26, 8], [28, 14], [32, 2], [38, 12], [42, 8], [42, 20], [38, 27]], 1, 9))}" fill="#ffb02e" stroke="${INK}" stroke-width="2.4"/>`;
      s += `<path d="${smoothPath(wobble([[28, 26], [27, 18], [31, 12], [34, 18], [36, 26]], 0.6, 10))}" fill="#fff0a0"/>`;
      s += `<path d="M26 40 h12" stroke="#fff" stroke-opacity="0.5" stroke-width="2"/>`;
      break;
    case "vilchez":
      // Mano que saluda (y marca a quien saluda)
      s += `<path d="${smoothPath(wobble([[20, 56], [16, 38], [14, 26], [18, 24], [22, 34], [22, 14], [27, 12], [29, 30], [30, 10], [35, 10], [36, 30], [38, 14], [43, 15], [42, 34], [46, 24], [51, 26], [46, 44], [40, 56]], 0.6, 11))}" fill="#f0c49a" stroke="${INK}" stroke-width="2.6"/>`;
      s += `<path d="M6 18 q-4 6 0 12 M10 14 q-6 10 0 20 M56 18 q4 6 0 12" stroke="#5c97ff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      break;
    case "conserje":
      // Manojo de llaves y cubo
      s += inkShape([[14, 30], [42, 30], [38, 56], [18, 56]], "#7a8a96", { seed: 12, amp: 0.6, ink: 2.4 });
      s += `<path d="M14 30 q14 -18 28 0" fill="none" stroke="${INK}" stroke-width="2.4"/>`;
      s += `<path d="M18 38 h20" stroke="#cfd6db" stroke-width="2"/>`;
      s += `<circle cx="46" cy="22" r="8" fill="none" stroke="#c9a23a" stroke-width="3.4"/><circle cx="46" cy="22" r="8" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
      s += `<path d="M52 28 l8 10 l-3 2 l-2 -2 l-2 2 l-2 -2" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
      break;
    case "ludopata":
      // Moneda con un 7
      s += `<circle cx="32" cy="32" r="22" fill="#e1b64a" stroke="${INK}" stroke-width="2.8"/><circle cx="32" cy="32" r="16" fill="#f2cf6a" stroke="#a87a1a" stroke-width="1.6"/>`;
      s += `<path d="M24 22 h16 v4 q-6 6 -8 18 h-6 q2 -12 8 -18 h-10Z" fill="#d8342a" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
      s += `<path d="M16 22 q6 -10 16 -10" stroke="#fff" stroke-opacity="0.55" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      break;
    default:
      // Roeño: la boina del pueblo
      s += `<path d="${smoothPath(wobble([[6, 40], [8, 28], [18, 18], [32, 15], [46, 18], [56, 28], [56, 38], [46, 44], [32, 46], [16, 45]], 0.8, 13))}" fill="#262836" stroke="${INK}" stroke-width="2.6"/>`;
      s += inkShape([[9, 40], [16, 44], [32, 46], [46, 44], [54, 39], [52, 44], [44, 50], [32, 52], [17, 50], [10, 45]], "#5b3a26", { seed: 14, amp: 0.4, ink: 2 });
      s += inkStroke([[32, 15], [34, 8], [37, 7]], 3, INK, 15, 0.3);
      s += `<path d="M16 28 q8 -8 18 -9" stroke="#fff" stroke-opacity="0.35" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}
