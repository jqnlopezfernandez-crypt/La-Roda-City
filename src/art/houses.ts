// Fachadas de casas encaladas andaluzas: 5 modelos × 4 variantes de color.
import {
  INK,
  ellipsePts,
  inkShape,
  jitterLine,
  linearGradient,
  radialGradient,
  rectPts,
  seededRng,
  shade,
  smoothPath,
  speckles,
  svgDoc,
  wobble,
  type Point,
} from "./svg";

export const HOUSE_W = 120;
export const HOUSE_H = 84;
export const FACADE_MODELS = 5;
export const FACADE_VARIANTS = 4;

const WALL_COLORS = ["#f2ecdc", "#efe2c4", "#ecd29a", "#e6dccb"];
const FRAME_COLORS = ["#d9a84e", "#a9533a", "#4f7393", "#b7ad98"];
const PLINTH_COLORS = ["#7c5e3e", "#46677f", "#9a4f37", "#62704a"];
const DOOR_COLORS = ["#5a3820", "#3c5a46", "#6a2e28", "#2e4866"];
const AWNING_COLORS = ["#b8423a", "#3f6f8a", "#c79a32", "#6d7a4a"];
const SHUTTER_COLORS = ["#5f7d4b", "#c8a56a", "#7a3b2e", "#3f6680"];
const FLOWER_COLORS = ["#d8323a", "#e2557a", "#f2efe6", "#d8323a"];
const ROOF_COLOR = "#a4553a";
const BRICK_COLOR = "#b0623f";
/** Altura del alero (la pared empieza debajo). */
const EAVE_H = 11;
/** Altura del zócalo. */
const PLINTH_H = 13;
const W = HOUSE_W;
const H = HOUSE_H;

/** Degradados compartidos por todas las fachadas (se referencian por id). */
const DEFS =
  "<defs>" +
  linearGradient(
    "luz",
    [
      [0, "#fff6dc", 0.32],
      [0.45, "#fff6dc", 0],
      [0.7, "#3a2414", 0],
      [1, "#3a2414", 0.2],
    ],
    0,
    0,
    1,
    1,
  ) +
  linearGradient("alero", [
    [0, INK, 0.42],
    [1, INK, 0],
  ]) +
  linearGradient("vidrio", [
    [0, "#55687a", 1],
    [1, "#1f2830", 1],
  ]) +
  radialGradient(
    "vidrioLuz",
    [
      [0, "#ffe9b0", 1],
      [0.7, "#f0b45a", 1],
      [1, "#c27a34", 1],
    ],
    0.4,
    0.35,
    0.8,
  ) +
  radialGradient("farol", [
    [0, "#ffd47a", 0.55],
    [0.5, "#ffc860", 0.18],
    [1, "#ffc860", 0],
  ]) +
  linearGradient("rollo", [
    [0, "#ffffff", 0.35],
    [0.5, "#ffffff", 0],
    [1, "#000000", 0.35],
  ]) +
  linearGradient(
    "madera",
    [
      [0, "#ffffff", 0.12],
      [0.3, "#ffffff", 0],
      [1, "#000000", 0.28],
    ],
    0,
    0,
    1,
    0.3,
  ) +
  linearGradient("humedad", [
    [0, "#7a6a40", 0],
    [1, "#7a6a40", 0.28],
  ]) +
  "</defs>";

/** Desconchón de la cal que deja ver el ladrillo. */
function peeledPlaster(cx: number, cy: number, rx: number, ry: number, wallColor: string, seed: number): string {
  const outline = wobble(ellipsePts(cx, cy, rx, ry, 9), rx * 0.55, seed);
  const path = smoothPath(outline);
  let svg = `<path d="${path}" fill="#c99470"/>`;
  svg += `<clipPath id="pc${seed}"><path d="${path}"/></clipPath><g clip-path="url(#pc${seed})" stroke="#8a5238" stroke-width="0.7" fill="none">`;
  // Hiladas de ladrillo recortadas a la forma del desconchón.
  for (let y = cy - ry - 2, course = 0; y < cy + ry + 2; y += 3, course++) {
    svg += `<path d="M${cx - rx - 2} ${y} H${cx + rx + 2}"/>`;
    for (let x = cx - rx - 2 + (course % 2) * 3; x < cx + rx + 2; x += 6) svg += `<path d="M${x} ${y} v3"/>`;
  }
  svg += "</g>";
  svg += `<path d="${path}" fill="none" stroke="${shade(wallColor, -0.45)}" stroke-width="0.9"/>`;
  svg += `<path d="M${cx - rx * 0.6} ${cy + ry * 0.9} Q${cx + rx * 0.4} ${cy + ry * 1.2} ${cx + rx * 1.05} ${cy + ry * 0.1}" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.9"/>`;
  return svg;
}

/**
 * Pared encalada: manchas, chorretones, humedad abajo, hasta 2 desconchones (fuera de
 * los tramos `keepOut` [x0, x1] donde van puertas y ventanas) y una grieta.
 */
function wall(color: string, seed: number, keepOut: [number, number][]): string {
  const rng = seededRng(seed);
  let svg = inkShape(rectPts(1.5, EAVE_H - 1, W - 3, H - EAVE_H - 0.5), color, { seed, amp: 1.2, ink: 2.6 });
  svg += speckles(
    4,
    EAVE_H + 2,
    W - 8,
    H - EAVE_H - PLINTH_H - 6,
    9,
    [shade(color, -0.045), shade(color, 0.06), shade(color, -0.02)],
    7,
    18,
    0.75,
    seed + 11,
  );
  for (let i = 0; i < 14; i++) {
    const x = 4 + rng() * (W - 8);
    const y = EAVE_H + 4 + rng() * (H - EAVE_H - PLINTH_H - 12);
    svg += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(rng() - 0.5) * 2} 5 ${(rng() - 0.5).toFixed(1)} ${(6 + rng() * 6).toFixed(1)}" stroke="${shade(color, -0.12)}" stroke-opacity="0.35" stroke-width="0.8" fill="none"/>`;
  }
  const dampTop = H - PLINTH_H - 9;
  svg += `<path d="${smoothPath(
    wobble(
      [
        [3, H - PLINTH_H],
        [3, dampTop + 3],
        [W * 0.3, dampTop - 1],
        [W * 0.55, dampTop + 4],
        [W * 0.8, dampTop],
        [W - 3, dampTop + 3],
        [W - 3, H - PLINTH_H],
      ],
      2.2,
      seed + 5,
    ),
  )}" fill="url(#humedad)"/>`;
  let peeled = 0;
  for (let attempt = 0; attempt < 30 && peeled < 2; attempt++) {
    const x = 8 + rng() * (W - 16);
    const y = EAVE_H + 8 + rng() * (H - EAVE_H - PLINTH_H - 16);
    if (!keepOut.some(([x0, x1]) => x > x0 - 6 && x < x1 + 6)) {
      svg += peeledPlaster(x, y, 3 + rng() * 3, 2 + rng() * 1.6, color, seed * 3 + attempt);
      peeled++;
    }
  }
  svg += jitterLine(W * (0.2 + rng() * 0.6), EAVE_H + 8, 12, 1.4, shade(color, -0.4), 0.7, seed + 4, 0.8);
  svg += `<rect x="2" y="${EAVE_H - 1}" width="${W - 4}" height="${H - EAVE_H - 1}" fill="url(#luz)"/>`;
  svg += `<rect x="2" y="${EAVE_H - 1}" width="${W - 4}" height="10" fill="url(#alero)"/>`;
  return svg;
}

/** Zócalo pintado con desconchones claros. */
function plinth(color: string, seed: number): string {
  const rng = seededRng(seed + 77);
  let svg = inkShape(rectPts(1.5, H - PLINTH_H - 1, W - 3, PLINTH_H), color, { seed, amp: 1, ink: 2.2 });
  svg += `<path d="M3 ${H - PLINTH_H} H${W - 3}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.4"/>`;
  svg += `<path d="M3 ${H - PLINTH_H + 2} H${W - 3}" stroke="${INK}" stroke-opacity="0.25" stroke-width="1"/>`;
  for (let i = 0; i < 4; i++) {
    const x = 6 + rng() * (W - 12);
    const y = H - PLINTH_H + 3 + rng() * (PLINTH_H - 6);
    svg += `<path d="${smoothPath(wobble(ellipsePts(x, y, 1.6 + rng() * 1.6, 1 + rng(), 6), 0.8, seed + i))}" fill="${shade(color, 0.35)}" fill-opacity="0.8"/>`;
  }
  svg += `<rect x="2" y="${H - 5}" width="${W - 4}" height="3.5" fill="#4a3a2a" fill-opacity="0.35"/>`;
  svg += `<rect x="2" y="${H - PLINTH_H}" width="${W - 4}" height="${PLINTH_H - 1}" fill="url(#luz)"/>`;
  return svg;
}

/** Alero de tejas visto de frente. */
function roofEdge(seed: number): string {
  const rng = seededRng(seed);
  let svg = inkShape(rectPts(0, 0, W, EAVE_H - 2), shade(ROOF_COLOR, -0.35), { seed, amp: 0.8, ink: 2.2 });
  svg += `<rect x="1" y="${EAVE_H - 3.5}" width="${W - 2}" height="3.2" fill="#ebe2cc" stroke="${INK}" stroke-width="1"/>`;
  for (let x = 1; x < W - 3; x += 7) {
    const tileColor = shade(ROOF_COLOR, (rng() - 0.45) * 0.28);
    const right = x + 5.6;
    svg += `<path d="M${x} 0.5 V${EAVE_H - 4.5} Q${x + 2.8} ${EAVE_H - 0.6} ${right} ${EAVE_H - 4.5} V0.5Z" fill="${tileColor}" stroke="${INK}" stroke-width="0.9"/>`;
    svg += `<path d="M${x + 1.2} 1 V${EAVE_H - 5}" stroke="#ffffff" stroke-opacity="0.32" stroke-width="1.1"/>`;
    svg += `<path d="M${right - 1} 1 V${EAVE_H - 5}" stroke="${INK}" stroke-opacity="0.3" stroke-width="1"/>`;
    svg += `<path d="M${x + 1.2} ${EAVE_H - 4.3} Q${x + 2.8} ${EAVE_H - 1.8} ${right - 1.2} ${EAVE_H - 4.3}Z" fill="${INK}" fill-opacity="0.75"/>`;
    // Musgo ocasional.
    if (rng() < 0.12) svg += `<circle cx="${x + 2.6}" cy="${1.5 + rng() * 3}" r="1.2" fill="#9aa44e" fill-opacity="0.9"/>`;
  }
  return svg;
}

/** Maceta de barro con geranios; (x, y) es la base. */
function flowerPot(x: number, y: number, flowerColor: string, seed: number): string {
  const rng = seededRng(seed);
  let svg = `<path d="M${x - 3.6} ${y - 5.5} L${x + 3.6} ${y - 5.5} L${x + 2.7} ${y} L${x - 2.7} ${y}Z" fill="#b8643e" stroke="${INK}" stroke-width="1"/>`;
  svg += `<rect x="${x - 4.2}" y="${y - 6.6}" width="8.4" height="1.8" fill="#c97a50" stroke="${INK}" stroke-width="0.8"/>`;
  svg += `<path d="M${x - 2} ${y - 4.5} v4" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1"/>`;
  for (let i = 0; i < 5; i++) {
    const lx = x + (i - 2) * 2.2;
    const ly = y - 8 - (i % 2) * 1.5;
    svg += `<circle cx="${lx}" cy="${ly}" r="2.2" fill="${i % 2 ? "#3f6e34" : "#4f8540"}" stroke="${INK}" stroke-width="0.6"/>`;
  }
  svg += `<path d="M${x + 3} ${y - 6} q2 2 1.5 5" stroke="#3f6e34" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  for (let i = 0; i < 3; i++) {
    const fx = x + (rng() - 0.5) * 6;
    const fy = y - 10.5 - rng() * 2;
    svg += `<circle cx="${fx}" cy="${fy}" r="1.5" fill="${flowerColor}"/><circle cx="${fx - 0.4}" cy="${fy - 0.5}" r="0.6" fill="#ffffff" fill-opacity="0.55"/>`;
  }
  return svg;
}

interface WindowOptions {
  frame: string;
  seed: number;
  /** Fracción de la ventana tapada por la persiana enrollable. */
  persiana?: number;
  /** Cristal iluminado por dentro. */
  lit?: boolean;
  /** Reja de forja. */
  reja?: boolean;
  /** Número de macetas en el alféizar. */
  macetas?: number;
  flower?: string;
}

/** Ventana con marco, cristal, persiana, alféizar, reja y macetas opcionales. */
function windowSvg(x: number, y: number, width: number, height: number, options: WindowOptions): string {
  const { seed } = options;
  let svg = "";
  svg += inkShape(rectPts(x - 3, y - 3, width + 6, height + 5), options.frame, { seed, amp: 0.7, ink: 1.4 });
  svg += `<rect x="${x - 3}" y="${y - 3}" width="${width + 6}" height="${height + 5}" fill="url(#luz)"/>`;
  svg += inkShape(rectPts(x, y, width, height), options.lit ? "url(#vidrioLuz)" : "url(#vidrio)", {
    seed: seed + 1,
    amp: 0.5,
    ink: 1.6,
  });
  if (!options.lit) {
    svg += `<path d="M${x + 1.5} ${y + height - 2} L${x + width * 0.55} ${y + 1.5} L${x + width * 0.8} ${y + 1.5} L${x + 3} ${y + height - 1}Z" fill="#ffffff" fill-opacity="0.13"/>`;
  }
  svg += `<path d="M${x + width / 2} ${y} V${y + height} M${x} ${y + height * 0.45} H${x + width}" stroke="#e9e2d0" stroke-width="1" stroke-opacity="0.85"/>`;
  svg += `<path d="M${x} ${y} H${x + width} V${y + 2.2} H${x + 2.2} V${y + height} H${x}Z" fill="${INK}" fill-opacity="0.38"/>`;
  if (options.persiana) {
    const blindHeight = height * options.persiana;
    const blindColor = SHUTTER_COLORS[seed % SHUTTER_COLORS.length];
    svg += `<rect x="${x - 0.5}" y="${y}" width="${width + 1}" height="${blindHeight}" fill="${blindColor}" stroke="${INK}" stroke-width="0.9"/>`;
    for (let slatY = y + 1.6; slatY < y + blindHeight; slatY += 1.6) {
      svg += `<path d="M${x} ${slatY} H${x + width}" stroke="${INK}" stroke-opacity="0.35" stroke-width="0.6"/>`;
    }
    svg += `<rect x="${x - 0.5}" y="${y}" width="${width + 1}" height="${blindHeight}" fill="url(#madera)"/>`;
    svg += `<rect x="${x - 1.5}" y="${y - 2.5}" width="${width + 3}" height="4" rx="2" fill="${blindColor}" stroke="${INK}" stroke-width="1"/><rect x="${x - 1.5}" y="${y - 2.5}" width="${width + 3}" height="4" rx="2" fill="url(#rollo)"/>`;
    svg += `<path d="M${x + width * 0.25} ${y + blindHeight} v3 M${x + width * 0.75} ${y + blindHeight} v3" stroke="#8a6a3a" stroke-width="0.7"/>`;
  }
  // Alféizar con su sombra y un chorretón.
  svg += `<rect x="${x - 4}" y="${y + height + 1.5}" width="${width + 8}" height="2.4" fill="#e6dfd0" stroke="${INK}" stroke-width="1"/>`;
  svg += `<path d="M${x - 2} ${y + height + 4.6} H${x + width + 6}" stroke="${INK}" stroke-opacity="0.2" stroke-width="2"/>`;
  svg += `<path d="M${x + width * 0.3} ${y + height + 5} q-0.5 4 0.3 7" stroke="#7a6a50" stroke-opacity="0.22" stroke-width="1.6" fill="none"/>`;
  if (options.reja) {
    const left = x - 2.5;
    const right = x + width + 2.5;
    const top = y - 1.5;
    const bottom = y + height + 1;
    const bars: number[] = [];
    for (let i = 0; i <= 4; i++) bars.push(left + 1 + ((right - left - 2) * i) / 4);
    // Sombra de la reja.
    let shadow = "";
    for (const bar of bars) shadow += `M${bar + 1.3} ${top + 1.5} V${bottom + 1.5} `;
    svg += `<path d="${shadow}M${left + 1.3} ${bottom + 1.5} H${right + 1.3}" stroke="${INK}" stroke-opacity="0.28" stroke-width="1.2" fill="none"/>`;
    let iron = "";
    for (const bar of bars) iron += `M${bar} ${top} V${bottom} `;
    iron += `M${left} ${top} H${right} M${left} ${bottom} H${right} M${left} ${top + (bottom - top) * 0.68} H${right}`;
    // Volutas arriba entre barrotes.
    for (let i = 0; i < 4; i++) {
      const cx = (bars[i] + bars[i + 1]) / 2;
      const cy = top + 2.2;
      iron += ` M${cx - 1.6} ${cy + 1.6} q-1 -2.4 1.6 -2.4 q1.6 0 1.6 1.4`;
    }
    svg += `<path d="${iron}" stroke="#1d1612" stroke-width="1.15" fill="none" stroke-linecap="round"/>`;
    svg += `<path d="M${left} ${bottom} H${right}" stroke="#6a5a50" stroke-width="0.5"/>`;
  }
  if (options.macetas) {
    const flowerColor = options.flower ?? FLOWER_COLORS[seed % FLOWER_COLORS.length];
    for (let i = 0; i < options.macetas; i++) {
      svg += flowerPot(
        x + width * ((i + 0.5) / options.macetas),
        y + height + 1.2,
        i % 2 ? FLOWER_COLORS[(seed + 2) % 4] : flowerColor,
        seed + 50 + i,
      );
    }
  }
  return svg;
}

interface DoorOptions {
  /** Y del dintel (por defecto, 26 px por encima del zócalo). */
  top?: number;
  /** Puerta con arco de medio punto. */
  arch?: boolean;
  /** Puerta de dos hojas. */
  double?: boolean;
  /** Jambas de ladrillo visto. */
  frameBrick?: boolean;
}

/** Puerta de madera claveteada con marco, aldaba y escalón. */
function door(x: number, width: number, doorColor: string, frameColor: string, seed: number, options: DoorOptions = {}): string {
  const top = options.top ?? H - PLINTH_H - 26;
  const bottom = H - 2;
  const archRise = options.arch ? width / 2 : 0;
  /** Contorno de la puerta desplazado (dx, dy) y agrandado `grow` px. */
  const outline = (dx: number, dy: number, grow: number): Point[] => {
    const pts: Point[] = [
      [x - grow + dx, bottom],
      [x - grow + dx, top + archRise + dy],
    ];
    if (options.arch) {
      for (let i = 1; i < 10; i++) {
        const angle = Math.PI + (i / 10) * Math.PI;
        pts.push([
          x + width / 2 + Math.cos(angle) * (width / 2 + grow) + dx,
          top + archRise + Math.sin(angle) * (width / 2 + grow) + dy,
        ]);
      }
    } else {
      pts.push([x - grow + dx, top - grow + dy], [x + width + grow + dx, top - grow + dy]);
    }
    pts.push([x + width + grow + dx, top + archRise + dy], [x + width + grow + dx, bottom]);
    return pts;
  };
  let svg = "";
  svg += inkShape(outline(0, 0, 3.2), options.frameBrick ? BRICK_COLOR : frameColor, { seed: seed + 5, amp: 0.6, ink: 1.6 });
  if (options.frameBrick) {
    for (let y = bottom - 3; y > top + archRise; y -= 3) {
      svg += `<path d="M${x - 3} ${y} h3 M${x + width} ${y} h3" stroke="#e8d8c0" stroke-width="0.6"/>`;
    }
  }
  svg += inkShape(outline(0, 0, 0), doorColor, { seed, amp: 0.5, ink: 2 });
  const rng = seededRng(seed);
  // Tablas y vetas.
  for (let i = 1; i < 5; i++) {
    svg += `<path d="M${x + (width * i) / 5} ${top + 2} V${bottom - 1}" stroke="${shade(doorColor, -0.35)}" stroke-width="0.7"/>`;
  }
  for (let i = 0; i < 4; i++) {
    svg += `<path d="M${x + 1 + rng() * (width - 2)} ${top + archRise + 2 + rng() * 8} q1 6 0 ${8 + rng() * 6}" stroke="${shade(doorColor, 0.18)}" stroke-width="0.6" fill="none"/>`;
  }
  if (options.double) svg += `<path d="M${x + width / 2} ${top + 1} V${bottom}" stroke="${INK}" stroke-width="1.4"/>`;
  // Clavos en dos columnas por hoja.
  const leaves = options.double ? 2 : 1;
  for (let leaf = 0; leaf < leaves; leaf++) {
    const leafX = x + (width / leaves) * leaf;
    const leafWidth = width / leaves;
    for (let y = top + archRise + 4; y < bottom - 3; y += 5) {
      for (const column of [0.22, 0.78]) {
        const nailX = leafX + leafWidth * column;
        svg += `<circle cx="${nailX}" cy="${y}" r="0.9" fill="#1f1712"/><circle cx="${nailX - 0.3}" cy="${y - 0.3}" r="0.35" fill="#d9c49a"/>`;
      }
    }
  }
  svg += `<path d="${smoothPath(outline(0, 0, 0), true)}" fill="url(#madera)"/>`;
  svg += `<path d="M${x} ${top + archRise + 3} V${bottom} H${x + 2.4} V${top + archRise + 3}Z" fill="${INK}" fill-opacity="0.32"/>`;
  // Aldaba.
  const knockerX = x + width * (options.double ? 0.38 : 0.72);
  const knockerY = top + archRise + (bottom - top - archRise) * 0.42;
  svg += `<circle cx="${knockerX}" cy="${knockerY}" r="1.9" fill="none" stroke="#c9a54e" stroke-width="1"/><circle cx="${knockerX}" cy="${knockerY - 1.9}" r="0.8" fill="#c9a54e"/>`;
  svg += `<rect x="${x - 4.5}" y="${bottom - 1.5}" width="${width + 9}" height="3" fill="#e9e6de" stroke="${INK}" stroke-width="1"/>`;
  return svg;
}

/** Farol de pared encendido con su halo. */
function wallLantern(x: number, y: number, seed: number): string {
  let svg = `<circle cx="${x + 1}" cy="${y + 6}" r="15" fill="url(#farol)"/>`;
  svg += `<path d="M${x - 7} ${y - 4} H${x} q2 0 2 2 M${x - 7} ${y - 4} q2 4 6 2" stroke="#1d1612" stroke-width="1.2" fill="none"/>`;
  svg += `<path d="M${x - 3} ${y} L${x + 5} ${y} L${x + 3.5} ${y + 9} L${x - 1.5} ${y + 9}Z" fill="#ffd77a" stroke="${INK}" stroke-width="1.2"/>`;
  svg += `<path d="M${x - 3.5} ${y} L${x + 5.5} ${y} L${x + 1} ${y - 3.5}Z" fill="#1d1612"/>`;
  svg += `<path d="M${x + 1} ${y + 0.5} V${y + 9}" stroke="${INK}" stroke-width="0.7"/>`;
  svg += `<path d="M${x + 3} ${y + 9.5} l3 4" stroke="${INK}" stroke-opacity="0.2" stroke-width="2"/>`;
  return svg + `<circle cx="${x}" cy="${y + 3}" r="${0.9 + (seed % 2) * 0.2}" fill="#ffffff" fill-opacity="0.8"/>`;
}

/** Placa de azulejos (columns × rows) con motivo alterno según `phase`. */
function azulejoPanel(x: number, y: number, columns: number, rows: number, phase: number): string {
  const cell = 4.2;
  let svg = `<rect x="${x - 1}" y="${y - 1}" width="${columns * cell + 2}" height="${rows * cell + 2}" fill="#2f4f6e" stroke="${INK}" stroke-width="1"/>`;
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      const tx = x + col * cell;
      const ty = y + row * cell;
      svg += `<rect x="${tx + 0.2}" y="${ty + 0.2}" width="${cell - 0.4}" height="${cell - 0.4}" fill="#f0ead8"/>`;
      svg +=
        (col + row + phase) % 2
          ? `<path d="M${tx + cell / 2} ${ty + 0.8} L${tx + cell - 0.8} ${ty + cell / 2} L${tx + cell / 2} ${ty + cell - 0.8} L${tx + 0.8} ${ty + cell / 2}Z" fill="#3f6f9a"/>`
          : `<circle cx="${tx + cell / 2}" cy="${ty + cell / 2}" r="1.2" fill="#d8a43a"/>`;
    }
  }
  return svg + `<path d="M${x} ${y} h${columns * cell}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="0.6"/>`;
}

/** Bajante de agua vertical en x. */
function downpipe(x: number): string {
  return `<path d="M${x + 1.2} ${EAVE_H} V${H - 3}" stroke="${INK}" stroke-opacity="0.2" stroke-width="2.4"/><rect x="${x - 1.2}" y="${EAVE_H - 2}" width="2.6" height="${H - EAVE_H - 1}" fill="#8f938f" stroke="${INK}" stroke-width="0.8"/><path d="M${x - 0.4} ${EAVE_H} V${H - 3}" stroke="#ffffff" stroke-opacity="0.45" stroke-width="0.6"/><path d="M${x - 2} ${EAVE_H + 18} h4.6 M${x - 2} ${EAVE_H + 42} h4.6" stroke="${INK}" stroke-width="0.8"/>`;
}

/** Modelo 0: puerta en arco, balcón con barandilla y macetas, dos ventanas y farol. */
function balconyHouse(variant: number): string {
  const seed = 100 + variant * 13;
  const frame = FRAME_COLORS[variant];
  let svg =
    wall(WALL_COLORS[variant], seed, [
      [12, 40],
      [52, 76],
      [86, 110],
    ]) + plinth(PLINTH_COLORS[variant], seed);
  svg += door(16, 20, DOOR_COLORS[variant], frame, seed + 20, { arch: true });
  svg += windowSvg(56, 18, 16, 22, { frame, seed: seed + 30, persiana: 0.45, lit: variant === 1 });
  svg += `<rect x="50" y="41" width="28" height="3" fill="#e6dfd0" stroke="${INK}" stroke-width="1.1"/><path d="M52 47 H78" stroke="${INK}" stroke-opacity="0.22" stroke-width="3"/>`;
  // Barandilla del balcón (y su sombra, desplazada).
  let railing = "";
  for (let i = 0; i <= 6; i++) railing += `M${51.5 + i * 4.2} 41 V33 `;
  svg += `<path d="${railing.replace(/M(\S+) 41 V33/g, (_match, barX: string) => `M${Number(barX) + 1.2} 42 V34`)}" stroke="${INK}" stroke-opacity="0.25" stroke-width="1"/>`;
  svg += `<path d="${railing}M50.5 33 H77.5 M50.5 37.5 H77.5" stroke="#1d1612" stroke-width="1.1" fill="none"/>`;
  svg += flowerPot(55, 33, FLOWER_COLORS[variant], seed + 80) + flowerPot(73, 33, FLOWER_COLORS[(variant + 1) % 4], seed + 81);
  svg += windowSvg(90, 22, 15, 15, { frame, seed: seed + 40, persiana: 0.3 });
  svg += windowSvg(88, 51, 18, 13, {
    frame,
    seed: seed + 45,
    reja: true,
    lit: variant === 3,
    macetas: variant % 2 ? 2 : 0,
  });
  svg += wallLantern(46, 46, seed);
  svg += azulejoPanel(40, 60, 1, 1, variant);
  return svg;
}

/** Modelo 1: portón de dos hojas en arco, dos ventanas con reja y azulejos. */
function doubleDoorHouse(variant: number): string {
  const seed = 200 + variant * 17;
  const frame = FRAME_COLORS[(variant + 1) % 4];
  let svg =
    wall(WALL_COLORS[(variant + 2) % 4], seed, [
      [8, 30],
      [36, 78],
      [84, 110],
    ]) + plinth(PLINTH_COLORS[(variant + 1) % 4], seed);
  svg += door(40, 34, DOOR_COLORS[(variant + 1) % 4], frame, seed + 20, { arch: true, double: true });
  svg += windowSvg(88, 30, 18, 21, {
    frame,
    seed: seed + 30,
    reja: true,
    persiana: 0.35,
    lit: variant === 2,
    macetas: 2,
  });
  svg += windowSvg(12, 31, 14, 18, { frame, seed: seed + 50, reja: true, persiana: 0.55 });
  svg += azulejoPanel(29, 38, 2, 2, variant);
  if (variant % 2) svg += downpipe(W - 5);
  return svg;
}

/** Modelo 2: tienda con escaparate, toldo a rayas y cartel colgante. */
function shopHouse(variant: number): string {
  const seed = 300 + variant * 19;
  const frame = FRAME_COLORS[(variant + 2) % 4];
  let svg =
    wall(WALL_COLORS[(variant + 1) % 4], seed, [
      [6, 74],
      [80, 108],
    ]) + plinth(PLINTH_COLORS[(variant + 3) % 4], seed);
  // Escaparate con género expuesto.
  svg += inkShape(rectPts(10, 40, 58, 30), "#5a3a24", { seed: seed + 10, amp: 0.6, ink: 1.6 });
  svg += inkShape(rectPts(13, 43, 52, 26), variant % 2 ? "url(#vidrioLuz)" : "url(#vidrio)", {
    seed: seed + 11,
    amp: 0.5,
    ink: 1.8,
  });
  svg += `<rect x="13" y="43" width="52" height="3" fill="${INK}" fill-opacity="0.35"/>`;
  svg += `<rect x="16" y="64" width="46" height="3" fill="#7a5a3a" stroke="${INK}" stroke-width="0.8"/>`;
  svg += `<rect x="18" y="56" width="8" height="8" fill="#c79a32" stroke="${INK}" stroke-width="1"/><rect x="29" y="59" width="6" height="5" fill="#b8423a" stroke="${INK}" stroke-width="1"/><path d="M38 64 v-9 h3 v9 M43 64 v-7 h3 v7" fill="#3f6e34" stroke="${INK}" stroke-width="0.9"/><rect x="49" y="55" width="10" height="9" fill="#e9e4d6" stroke="${INK}" stroke-width="1"/>`;
  svg += '<path d="M16 66 L30 46 L36 46 L22 66Z" fill="#ffffff" fill-opacity="0.12"/>';
  svg += '<path d="M39 41 V69" stroke="#5a3a24" stroke-width="1.6"/>';
  // Toldo a rayas.
  const awningColor = AWNING_COLORS[variant % 4];
  const awningTop = 30;
  const awningBottom = 42;
  svg += `<path d="M6 ${awningBottom + 2} H74 L72 ${awningBottom + 8} H8Z" fill="${INK}" fill-opacity="0.22"/>`;
  for (let i = 0; i < 7; i++) {
    const sx = 6 + i * 9.4;
    svg += `<path d="M${sx} ${awningTop} L${sx + 9.4} ${awningTop} L${sx + 10.4} ${awningBottom} L${sx + 1} ${awningBottom}Z" fill="${i % 2 ? "#efe6d2" : awningColor}"/>`;
  }
  svg += `<path d="M6 ${awningTop} H72 L74 ${awningBottom} H4Z" fill="url(#rollo)" opacity="0.6"/>`;
  svg += inkShape(
    [
      [6, awningTop],
      [72, awningTop],
      [74, awningBottom],
      [4, awningBottom],
    ],
    "none",
    { seed: seed + 20, amp: 0.4, ink: 2 },
  );
  for (let i = 0; i < 7; i++) {
    svg += `<path d="M${4 + i * 10} ${awningBottom} q5 5 10 0" fill="${i % 2 ? "#efe6d2" : shade(awningColor, -0.12)}" stroke="${INK}" stroke-width="1.3"/>`;
  }
  svg += door(84, 20, DOOR_COLORS[(variant + 2) % 4], frame, seed + 30, { arch: true });
  // Cartel colgante.
  svg += `<path d="M${W - 24} 21 H${W - 6} M${W - 24} 21 q4 4 8 1" stroke="#1d1612" stroke-width="1.3" fill="none"/>`;
  svg += `<path d="M${W - 21} 21 v2 M${W - 9} 21 v2" stroke="${INK}" stroke-width="0.8"/>`;
  svg += inkShape(rectPts(W - 22, 23, 15, 9), ["#c79a32", "#3f6f8a", "#b8423a", "#f0ead8"][variant], {
    seed: seed + 41,
    amp: 0.4,
    ink: 1.5,
  });
  svg += `<path d="M${W - 19} 27.5 h9" stroke="${variant === 3 ? "#3f6f8a" : "#f0ead8"}" stroke-width="1.6" stroke-linecap="round"/>`;
  svg += `<path d="M${W - 20} 32.5 h13" stroke="${INK}" stroke-opacity="0.25" stroke-width="2"/>`;
  svg += windowSvg(26, 15, 13, 9, { frame, seed: seed + 50, persiana: 0.5 });
  return svg;
}

/** Modelo 3: casa con mirador acristalado de madera, cortinas y farol. */
function bayWindowHouse(variant: number): string {
  const seed = 400 + variant * 23;
  const frame = FRAME_COLORS[(variant + 3) % 4];
  const woodColor = ["#4f6a3e", "#6a3a26", "#2f5068", "#7a5a34"][variant];
  let svg =
    wall(WALL_COLORS[(variant + 3) % 4], seed, [
      [18, 40],
      [56, 104],
    ]) + plinth(PLINTH_COLORS[(variant + 2) % 4], seed);
  svg += door(20, 18, DOOR_COLORS[(variant + 3) % 4], frame, seed + 10, { top: H - PLINTH_H - 28 });
  svg += windowSvg(86, 54, 14, 11, { frame, seed: seed + 20, reja: true, macetas: 1 });
  svg += `<path d="M62 20 H106 L110 47 H66Z" fill="${INK}" fill-opacity="0.22"/>`;
  // Ménsulas del mirador.
  for (const bracketX of [61, 99]) {
    svg += `<path d="M${bracketX} 44 h6 q0 6 -6 7Z" fill="${shade(woodColor, -0.15)}" stroke="${INK}" stroke-width="1"/>`;
  }
  svg += inkShape(rectPts(58, 37, 44, 7), woodColor, { seed: seed + 30, amp: 0.4, ink: 1.6 });
  svg += '<rect x="58" y="37" width="44" height="7" fill="url(#madera)"/>';
  svg += `<path d="M60 40.5 h40" stroke="${shade(woodColor, 0.3)}" stroke-width="0.8"/>`;
  svg += inkShape(rectPts(59, 17, 42, 20), "url(#vidrio)", { seed: seed + 31, amp: 0.4, ink: 1.6 });
  if (variant === 2) svg += '<rect x="59" y="17" width="42" height="20" fill="url(#vidrioLuz)" opacity="0.85"/>';
  // Cortinas recogidas.
  svg += '<path d="M61 19 q3 8 1 17 h4 q-2 -9 -1 -17Z M99 19 q-3 8 -1 17 h-4 q2 -9 1 -17Z" fill="#f2ecdc" fill-opacity="0.75"/>';
  let mullions = "";
  for (let i = 1; i < 4; i++) mullions += `M${59 + i * 10.5} 17 V37 `;
  mullions += "M59 27 H101";
  svg += `<path d="${mullions}" stroke="${woodColor}" stroke-width="1.8"/><path d="${mullions}" stroke="${INK}" stroke-width="0.5" stroke-opacity="0.6"/>`;
  svg += '<path d="M61 35 L66 19 L69 19 L64 35Z M82 35 L87 19 L89 19 L84 35Z" fill="#ffffff" fill-opacity="0.13"/>';
  // Tejadillo del mirador.
  svg += inkShape(
    [
      [56, 17],
      [104, 17],
      [101, 12],
      [59, 12],
    ],
    shade(ROOF_COLOR, -0.05),
    { seed: seed + 32, amp: 0.4, ink: 1.5 },
  );
  for (let tileX = 60; tileX < 101; tileX += 5) {
    svg += `<path d="M${tileX} 16.5 q2.5 -3 5 0" stroke="${INK}" stroke-width="0.6" fill="none"/>`;
  }
  svg += flowerPot(64, 37, FLOWER_COLORS[variant], seed + 40) + flowerPot(96, 37, FLOWER_COLORS[(variant + 2) % 4], seed + 41);
  svg += windowSvg(24, 17, 12, 12, { frame, seed: seed + 50, persiana: 0.6 });
  svg += wallLantern(48, 34, seed + 1);
  return svg;
}

/** Modelo 4: portada de ladrillo visto con esquinas de ladrillo y dos ventanas con reja. */
function brickPortalHouse(variant: number): string {
  const seed = 500 + variant * 29;
  const frame = FRAME_COLORS[(variant + 2) % 4];
  let svg =
    wall(WALL_COLORS[variant % 4], seed, [
      [34, 74],
      [6, 28],
      [86, 112],
    ]) + plinth(PLINTH_COLORS[(variant + 3) % 4], seed);
  // Esquinas de ladrillo alternando largo y corto.
  for (const [edgeX, direction] of [
    [2, 1],
    [W - 2, -1],
  ]) {
    for (let y = EAVE_H, course = 0; y < H - PLINTH_H - 1; y += 4, course++) {
      const brickWidth = course % 2 ? 7 : 4.5;
      const brickX = direction > 0 ? edgeX : edgeX - brickWidth;
      svg += `<rect x="${brickX}" y="${y}" width="${brickWidth}" height="3.6" fill="${shade(BRICK_COLOR, (((course * 7) % 5) * 0.03) - 0.06)}" stroke="#6a3a26" stroke-width="0.6"/>`;
    }
  }
  const portalLeft = 36;
  const portalRight = 72;
  const lintelY = 30;
  // Pilastras.
  for (const pillarX of [portalLeft, portalRight - 6]) {
    svg += inkShape(rectPts(pillarX, lintelY + 6, 6, H - 2 - lintelY - 6), BRICK_COLOR, {
      seed: seed + pillarX,
      amp: 0.4,
      ink: 1.4,
    });
    for (let y = lintelY + 9; y < H - 3; y += 3) {
      svg += `<path d="M${pillarX + 0.5} ${y} h5" stroke="#e7d4bc" stroke-width="0.55"/>`;
    }
    svg += `<rect x="${pillarX + 4.2}" y="${lintelY + 6}" width="1.8" height="${H - 2 - lintelY - 6}" fill="${INK}" fill-opacity="0.25"/>`;
  }
  // Dintel.
  svg += inkShape(rectPts(portalLeft - 2, lintelY, portalRight - portalLeft + 4, 7), BRICK_COLOR, {
    seed: seed + 3,
    amp: 0.4,
    ink: 1.6,
  });
  svg += `<rect x="${portalLeft - 3}" y="${lintelY - 2}" width="${portalRight - portalLeft + 6}" height="2.6" fill="#e6dfd0" stroke="${INK}" stroke-width="1"/>`;
  svg += `<path d="M${portalLeft} ${lintelY + 7.5} H${portalRight}" stroke="${INK}" stroke-opacity="0.3" stroke-width="2"/>`;
  for (let x = portalLeft; x < portalRight; x += 4) {
    svg += `<path d="M${x} ${lintelY + 3.5} h3.2" stroke="#e7d4bc" stroke-width="0.6"/>`;
  }
  svg += door(portalLeft + 7, portalRight - portalLeft - 14, DOOR_COLORS[(variant + 2) % 4], frame, seed + 10, {
    top: lintelY + 9,
    double: true,
  });
  svg += azulejoPanel(portalLeft + 9, lintelY - 12, 4, 2, variant);
  svg += windowSvg(10, 26, 14, 20, {
    frame,
    seed: seed + 20,
    reja: true,
    persiana: 0.4,
    macetas: variant % 2 ? 0 : 1,
  });
  svg += windowSvg(90, 26, 14, 20, {
    frame,
    seed: seed + 30,
    reja: true,
    persiana: 0.5,
    lit: variant === 0,
    macetas: variant % 2 ? 2 : 0,
  });
  return svg;
}

const FACADE_BUILDERS = [balconyHouse, doubleDoorHouse, shopHouse, bayWindowHouse, brickPortalHouse];

/** SVG completo de la fachada `model` (0..FACADE_MODELS-1) en la variante de color `variant`. */
export function houseFacade(model: number, variant: number): string {
  const body = FACADE_BUILDERS[model](variant);
  return svgDoc(HOUSE_W, HOUSE_H, DEFS + body + roofEdge(500 + model * 7 + variant));
}
