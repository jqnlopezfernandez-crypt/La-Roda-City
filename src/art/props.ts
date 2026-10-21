// Elementos sueltos del pueblo: árboles, mobiliario urbano, marcadores e iconos.
import {
  INK,
  ellipsePts,
  inkShape,
  inkStroke,
  linearGradient,
  radialGradient,
  rectPts,
  seededRng,
  shade,
  smoothPath,
  svgDoc,
  wobble,
  type Point,
} from "./svg";

/** Sombra elíptica en el suelo, algo desplazada a la derecha y abajo. */
function groundShadow(cx: number, cy: number, rx: number, ry: number, opacity = 0.3): string {
  return `<ellipse cx="${cx + rx * 0.18}" cy="${cy + ry * 0.2}" rx="${rx}" ry="${ry}" fill="${INK}" fill-opacity="${opacity}"/>`;
}

interface FoliagePalette {
  dark: string;
  mid: string;
  light: string;
  /** Color de las hojas iluminadas (arriba a la izquierda). */
  top: string;
  leaf: "redonda" | "estrecha";
}

interface Clump {
  x: number;
  y: number;
  r: number;
}

/**
 * Copa de árbol: `clumpCount` bolas de follaje alrededor de (cx, cy) con tres tonos,
 * contorno de tinta y hojas sueltas. `sparse` (0..1) reduce el tamaño de las bolas.
 */
function foliage(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  clumpCount: number,
  palette: FoliagePalette,
  seed: number,
  sparse = 0,
): { svg: string; clumps: Clump[] } {
  const rng = seededRng(seed);
  const clumps: Clump[] = [];
  for (let i = 0; i < clumpCount; i++) {
    const angle = (i / clumpCount) * Math.PI * 2 + rng() * 0.5;
    // La primera bola va en el centro.
    const distance = i === 0 ? 0 : 0.42 + rng() * 0.2;
    clumps.push({
      x: cx + Math.cos(angle) * rx * distance,
      y: cy + Math.sin(angle) * ry * distance,
      r: Math.min(rx, ry) * (0.46 + rng() * 0.16) * (1 - sparse * 0.25),
    });
  }
  clumps.sort((a, b) => a.y - b.y);
  const blob = (clump: Clump, scale: number, dx = 0, dy = 0, seedOffset = 0) =>
    smoothPath(
      wobble(
        ellipsePts(clump.x + dx, clump.y + dy, clump.r * scale, clump.r * scale * 0.88, 11),
        clump.r * 0.16,
        seed + seedOffset + Math.round(clump.x * 7 + clump.y),
      ),
    );
  let svg = "";
  // Contorno de tinta común (trazo grueso bajo todas las bolas).
  for (const clump of clumps) {
    svg += `<path d="${blob(clump, 1)}" fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  }
  for (const clump of clumps) {
    svg += `<path d="${blob(clump, 1)}" fill="${palette.dark}"/>`;
    svg += `<path d="${blob(clump, 0.8, -clump.r * 0.14, -clump.r * 0.16, 3)}" fill="${palette.mid}"/>`;
    svg += `<path d="${blob(clump, 0.42, -clump.r * 0.34, -clump.r * 0.36, 5)}" fill="${palette.light}"/>`;
    svg += `<path d="M${clump.x - clump.r * 0.7} ${clump.y + clump.r * 0.55} Q${clump.x + clump.r * 0.2} ${clump.y + clump.r * 1.05} ${clump.x + clump.r * 0.85} ${clump.y + clump.r * 0.2}" stroke="${INK}" stroke-opacity="0.45" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  }
  const leaf = (x: number, y: number, angle: number, color: string, opacity = 1) =>
    palette.leaf === "redonda"
      ? `<path d="M0 0 q2.4 -2.4 4.8 0 q-2.4 2.4 -4.8 0Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)})" fill="${color}" fill-opacity="${opacity}"/>`
      : `<path d="M0 0 q3.4 -1.3 6.8 0 q-3.4 1.3 -6.8 0Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)})" fill="${color}" fill-opacity="${opacity}"/>`;
  /** Punto al azar en una bola: a distancia `radius` (fracción) o, si es < 0, dentro. */
  const pointOnClump = (radius: number) => {
    const clump = clumps[Math.floor(rng() * clumps.length)];
    const angle = rng() * Math.PI * 2;
    const distance = radius < 0 ? Math.sqrt(rng()) * 0.85 : radius;
    return {
      x: clump.x + Math.cos(angle) * clump.r * distance,
      y: clump.y + Math.sin(angle) * clump.r * distance * 0.88,
      a: angle,
    };
  };
  for (let i = 0; i < 26; i++) {
    const { x, y } = pointOnClump(-1);
    const lit = (x - cx) / rx + (y - cy) / ry < -0.1;
    svg += leaf(x, y, -30 + rng() * 80, lit ? palette.top : shade(palette.dark, -0.15), lit ? 0.9 : 0.8);
  }
  // Hojas en el borde, orientadas hacia fuera.
  for (let i = 0; i < 14; i++) {
    const { x, y, a } = pointOnClump(0.92);
    svg += leaf(x - 2, y, (a * 180) / Math.PI + (rng() - 0.5) * 40, Math.cos(a) + Math.sin(a) < 0 ? palette.mid : palette.dark);
  }
  return { svg, clumps };
}

/** Tronco desde `bottom` hasta `top` centrado en cx; `gnarled` = olivo retorcido. */
function trunk(cx: number, top: number, bottom: number, halfWidth: number, seed: number, gnarled = false): string {
  const rng = seededRng(seed);
  const barkColor = gnarled ? "#6d5a44" : "#6b4a2e";
  const outline: Point[] = gnarled
    ? [
        [cx - halfWidth * 0.9, bottom],
        [cx - halfWidth * 0.5, bottom - 6],
        [cx - halfWidth * 0.8, top + 14],
        [cx - halfWidth * 1.2, top],
        [cx - halfWidth * 0.3, top + 8],
        [cx + halfWidth * 0.2, top - 2],
        [cx + halfWidth * 0.5, top + 10],
        [cx + halfWidth * 1.1, top + 2],
        [cx + halfWidth * 0.6, top + 16],
        [cx + halfWidth * 0.5, bottom - 5],
        [cx + halfWidth * 1, bottom],
      ]
    : [
        [cx - halfWidth * 0.7, bottom],
        [cx - halfWidth * 0.4, top + 6],
        [cx - halfWidth * 0.9, top],
        [cx + halfWidth * 0.2, top + 4],
        [cx + halfWidth * 0.9, top - 1],
        [cx + halfWidth * 0.45, top + 8],
        [cx + halfWidth * 0.75, bottom],
      ];
  let svg = inkShape(outline, barkColor, { seed, amp: 1.2, ink: 2.4 });
  svg += `<path d="M${cx + halfWidth * 0.1} ${bottom - 1} L${cx + halfWidth * 0.25} ${top + 10} L${cx + halfWidth * (gnarled ? 0.55 : 0.45)} ${top + 10} L${cx + halfWidth * (gnarled ? 0.85 : 0.7)} ${bottom - 1}Z" fill="${INK}" fill-opacity="0.3"/>`;
  // Vetas de la corteza.
  for (let i = 0; i < (gnarled ? 6 : 3); i++) {
    const x = cx + (rng() - 0.5) * halfWidth * 0.9;
    svg += inkStroke(
      [
        [x, bottom - 3],
        [x + (rng() - 0.5) * 3, top + 12 + rng() * 8],
      ],
      0.9,
      shade(barkColor, -0.45),
      seed + i,
      1.2,
    );
  }
  svg += inkStroke(
    [
      [cx - halfWidth * 0.35, bottom - 3],
      [cx - halfWidth * 0.25, top + 12],
    ],
    1.2,
    shade(barkColor, 0.35),
    seed + 9,
    0.8,
  );
  // Hueco en el tronco del olivo.
  if (gnarled) {
    svg += `<path d="${smoothPath(wobble(ellipsePts(cx - halfWidth * 0.05, bottom - 13, 1.6, 3, 6), 0.6, seed))}" fill="${INK}"/>`;
  }
  return svg;
}

/** "naranjo". */
export function orangeTree(): string {
  const crown = foliage(
    32,
    31,
    25,
    23,
    8,
    { dark: "#24492a", mid: "#336032", light: "#4f8040", top: "#7aa65a", leaf: "redonda" },
    11,
  );
  const rng = seededRng(12);
  let fruit = "";
  for (let i = 0; i < 11; i++) {
    const clump = crown.clumps[i % crown.clumps.length];
    const x = clump.x + (rng() - 0.5) * clump.r * 1.2;
    const y = clump.y + (rng() - 0.3) * clump.r * 0.9;
    const lit = x < 34;
    fruit += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.7" fill="${lit ? "#f09a30" : "#d4741e"}" stroke="${INK}" stroke-width="0.9"/><circle cx="${(x - 0.9).toFixed(1)}" cy="${(y - 0.9).toFixed(1)}" r="0.9" fill="#ffd9a0"/>`;
  }
  // Azahar.
  for (let i = 0; i < 6; i++) {
    fruit += `<circle cx="${(14 + rng() * 34).toFixed(1)}" cy="${(14 + rng() * 26).toFixed(1)}" r="1.1" fill="#fbf6ea"/>`;
  }
  return svgDoc(64, 84, groundShadow(33, 78, 22, 5) + trunk(32, 48, 79, 5, 5) + crown.svg + fruit);
}

/** "olivo". */
export function oliveTree(): string {
  const crown = foliage(
    36,
    30,
    29,
    22,
    9,
    { dark: "#3f4a30", mid: "#5f6c48", light: "#86926a", top: "#b8c2a0", leaf: "estrecha" },
    23,
    1,
  );
  let branches = "";
  for (const [x, y] of [
    [24, 32],
    [48, 30],
    [36, 22],
    [30, 38],
  ]) {
    branches += inkStroke(
      [
        [36, 50],
        [x, y],
      ],
      2.2,
      "#5a4a38",
      Math.round(x + y),
      1.4,
    );
  }
  return svgDoc(72, 84, groundShadow(38, 78, 25, 5) + trunk(36, 46, 79, 6, 6, true) + branches + crown.svg);
}

/** "arbusto". */
export function bush(): string {
  const crown = foliage(
    22,
    17,
    16,
    11,
    6,
    { dark: "#24492a", mid: "#386a34", light: "#5a8e48", top: "#86b062", leaf: "redonda" },
    31,
  );
  return svgDoc(44, 32, groundShadow(23, 27, 18, 4, 0.26) + crown.svg);
}

/** "farola": farola de forja con farol encendido. */
export function streetLamp(): string {
  const iron = "#24221f";
  let svg =
    "<defs>" +
    radialGradient(
      "fl",
      [
        [0, "#fff1c4", 1],
        [0.6, "#ffcf6a", 1],
        [1, "#e59a3a", 1],
      ],
      0.45,
      0.4,
      0.7,
    ) +
    linearGradient(
      "fu",
      [
        [0, "#ffffff", 0.3],
        [0.35, "#ffffff", 0],
        [1, "#000000", 0.4],
      ],
      0,
      0,
      1,
      0,
    ) +
    "</defs>";
  svg += groundShadow(13, 76, 8, 2.6, 0.32);
  // Base y fuste.
  svg += inkShape(
    [
      [7.5, 77],
      [18.5, 77],
      [17, 71],
      [9, 71],
    ],
    iron,
    { seed: 1, amp: 0.3, ink: 1.6 },
  );
  svg += inkShape(
    [
      [9.5, 71],
      [16.5, 71],
      [15, 66],
      [11, 66],
    ],
    iron,
    { seed: 2, amp: 0.2, ink: 1.4 },
  );
  svg += '<path d="M7.5 77 L18.5 77 L17 71 L9 71Z" fill="url(#fu)"/>';
  svg += inkShape(rectPts(11.6, 24, 2.8, 42), iron, { seed: 3, amp: 0.3, ink: 1.3 });
  svg += '<rect x="11.6" y="24" width="2.8" height="42" fill="url(#fu)"/>';
  for (const ringY of [34, 52]) {
    svg += `<rect x="10.6" y="${ringY}" width="4.8" height="2" fill="${iron}" stroke="${INK}" stroke-width="0.8"/>`;
  }
  // Volutas y farol.
  svg += `<path d="M13 26 q-6 -1 -6 -5 M13 26 q6 -1 6 -5" stroke="${iron}" stroke-width="1.3" fill="none"/>`;
  svg += inkShape(
    [
      [6.5, 22],
      [19.5, 22],
      [21, 10.5],
      [5, 10.5],
    ],
    "url(#fl)",
    { seed: 4, amp: 0.3, ink: 1.8 },
  );
  svg += `<path d="M10.5 22 L9.6 10.5 M15.5 22 L16.4 10.5" stroke="${iron}" stroke-width="1.1"/>`;
  svg += '<path d="M7 20.5 L6 12" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.9"/>';
  svg += '<path d="M15.5 21.5 L19 21.5 L20.3 11.5 L16.6 11.5Z" fill="#a8541e" fill-opacity="0.25"/>';
  svg += inkShape(
    [
      [3.5, 10.5],
      [22.5, 10.5],
      [16, 5.5],
      [10, 5.5],
    ],
    iron,
    { seed: 5, amp: 0.3, ink: 1.6 },
  );
  svg += `<path d="M10 5.5 L13 1.6 L16 5.5Z" fill="${iron}" stroke="${INK}" stroke-width="1"/><circle cx="13" cy="1.6" r="1.2" fill="${iron}"/>`;
  svg += '<path d="M5 10 L11 6" stroke="#ffffff" stroke-opacity="0.25" stroke-width="0.8"/>';
  svg += inkShape(rectPts(6, 22, 14, 2), iron, { seed: 6, amp: 0.2, ink: 1 });
  return svgDoc(26, 80, svg);
}

/** "banco": banco de listones de madera con patas de forja. */
export function bench(): string {
  const wood = "#9a6a3c";
  const iron = "#2a2622";
  let svg = groundShadow(27, 26, 24, 3.5, 0.3);
  for (const legX of [6, 43]) {
    svg += `<path d="M${legX} 26 V15 q0 -3 3 -3 M${legX + 3} 26 V18 q0 -2 -2 -2" stroke="${iron}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    svg += `<path d="M${legX - 1.5} 26 h6" stroke="${iron}" stroke-width="2"/>`;
  }
  const slat = (y: number, height: number, color: string, seed: number) =>
    inkShape(rectPts(2, y, 48, height), color, { seed, amp: 0.5, ink: 1.6 }) +
    `<path d="M3.5 ${y + 1} H48" stroke="#ffffff" stroke-opacity="0.32" stroke-width="0.9"/><path d="M3.5 ${y + height - 0.8} H48.5" stroke="${INK}" stroke-opacity="0.3" stroke-width="1"/><path d="M${10 + seed * 3} ${y + height / 2} h8 M${30 - seed} ${y + height / 2 + 0.5} h9" stroke="${shade(color, -0.3)}" stroke-width="0.6"/>`;
  // Respaldo (dos listones), sombra y asiento (dos listones).
  svg += slat(2.5, 4, shade(wood, -0.12), 1) + slat(7.5, 3.6, shade(wood, -0.06), 2);
  svg += `<path d="M4 12 H48" stroke="${INK}" stroke-opacity="0.45" stroke-width="2"/>`;
  svg += slat(12.5, 3.8, wood, 3) + slat(16.8, 3.8, shade(wood, 0.08), 4);
  // Tornillos.
  for (const x of [8, 45]) for (const y of [4.5, 9.3, 14.4, 18.7]) svg += `<circle cx="${x}" cy="${y}" r="0.6" fill="${iron}"/>`;
  return svgDoc(52, 30, svg);
}

/** Maceta grande de barro con geranios; (x, y) es la base. */
function bigFlowerPot(x: number, y: number, width: number, height: number, seed: number): string {
  const rng = seededRng(seed);
  let svg = `<defs>${linearGradient(
    "bp" + seed,
    [
      [0, "#ffffff", 0.25],
      [0.4, "#ffffff", 0],
      [1, "#000000", 0.35],
    ],
    0,
    0,
    1,
    0,
  )}</defs>`;
  const pot: Point[] = [
    [x - width / 2, y - height],
    [x + width / 2, y - height],
    [x + width * 0.38, y],
    [x - width * 0.38, y],
  ];
  svg += inkShape(pot, "#b8643e", { seed, amp: 0.4, ink: 1.6 });
  svg += `<path d="M${x - width / 2} ${y - height} L${x + width / 2} ${y - height} L${x + width * 0.38} ${y} L${x - width * 0.38} ${y}Z" fill="url(#bp${seed})"/>`;
  svg += inkShape(rectPts(x - width / 2 - 1, y - height - 2.4, width + 2, 3), "#c97a50", { seed: seed + 1, amp: 0.2, ink: 1.2 });
  for (let i = 0; i < 7; i++) {
    const lx = x + (i - 3) * width * 0.14;
    const ly = y - height - 4 - (i % 2) * 2.5;
    svg += `<circle cx="${lx}" cy="${ly}" r="${width * 0.17}" fill="${i < 3 ? "#4f8540" : "#3a6630"}" stroke="${INK}" stroke-width="0.9"/>`;
  }
  for (let i = 0; i < 4; i++) {
    const fx = x + (rng() - 0.5) * width * 0.8;
    const fy = y - height - 7 - rng() * 4;
    svg += `<circle cx="${fx}" cy="${fy}" r="2" fill="#d8323a" stroke="${INK}" stroke-width="0.6"/><circle cx="${fx - 0.6}" cy="${fy - 0.6}" r="0.7" fill="#ffb0a0"/>`;
  }
  return svg;
}

/** "maceta". */
export function flowerPot(): string {
  return svgDoc(20, 24, groundShadow(10, 22.5, 7, 1.8, 0.28) + bigFlowerPot(10, 23, 13, 10, 3));
}

/** "buganvilla": buganvilla en macetón con brácteas fucsia. */
export function bougainvillea(): string {
  const rng = seededRng(71);
  let svg = `<defs>${linearGradient(
    "tin",
    [
      [0, "#ffffff", 0.28],
      [0.35, "#ffffff", 0],
      [1, "#000000", 0.4],
    ],
    0,
    0,
    1,
    0,
  )}</defs>`;
  svg += groundShadow(20, 53, 15, 3.2, 0.3);
  const planter = smoothPath(
    wobble(
      [
        [11, 34],
        [29, 34],
        [33, 42],
        [28, 53],
        [12, 53],
        [7, 42],
      ],
      0.6,
      2,
    ),
  );
  svg += `<path d="${planter}" fill="#b05e3a" stroke="${INK}" stroke-width="2"/><path d="${planter}" fill="url(#tin)"/>`;
  svg += inkShape(rectPts(10, 31.5, 20, 3.4), "#c2724a", { seed: 4, amp: 0.3, ink: 1.4 });
  svg += `<path d="M10 44 q10 3 20 0" stroke="${INK}" stroke-opacity="0.35" stroke-width="0.9" fill="none"/>`;
  // Tutores de caña.
  svg +=
    inkStroke(
      [
        [16, 33],
        [13, 6],
      ],
      1.3,
      "#8a7a4a",
      5,
      0.6,
    ) +
    inkStroke(
      [
        [24, 33],
        [27, 8],
      ],
      1.3,
      "#8a7a4a",
      6,
      0.6,
    );
  const crown = foliage(
    20,
    20,
    15,
    15,
    7,
    { dark: "#2c4a26", mid: "#3c6232", light: "#557f42", top: "#7aa65a", leaf: "redonda" },
    77,
  );
  svg += crown.svg;
  for (let i = 0; i < 26; i++) {
    const angle = rng() * Math.PI * 2;
    const distance = Math.sqrt(rng());
    const x = 20 + Math.cos(angle) * 15 * distance;
    const y = 20 + Math.sin(angle) * 15 * distance;
    const lit = x + y < 40;
    svg += `<path d="M0 -2 L1.8 0.8 L-1.8 0.8Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(rng() * 120).toFixed(0)}) scale(1.25)" fill="${lit ? "#e2479a" : "#b02a74"}" stroke="${INK}" stroke-opacity="0.35" stroke-width="0.5"/>`;
  }
  // Pétalos caídos.
  for (let i = 0; i < 4; i++) {
    svg += `<circle cx="${(26 + rng() * 12).toFixed(1)}" cy="${(51 + rng() * 3).toFixed(1)}" r="1" fill="#d83a8e"/>`;
  }
  return svgDoc(40, 56, svg);
}

/** "pilon": pilón (fuente abrevadero) de piedra con caño. */
export function waterTrough(): string {
  const stone = "#cbbd9f";
  const stoneDark = "#9c8e74";
  let svg = `<defs>${linearGradient("ag", [
    [0, "#7fb1c4", 1],
    [1, "#3f7891", 1],
  ])}${linearGradient(
    "pd",
    [
      [0, "#ffffff", 0.25],
      [0.35, "#ffffff", 0],
      [1, "#000000", 0.3],
    ],
    0,
    0,
    1,
    0,
  )}</defs>`;
  svg += groundShadow(33, 39, 30, 4.5, 0.3);
  // Frontal con el caño.
  svg += inkShape(
    [
      [22, 22],
      [42, 22],
      [42, 6],
      [38, 2],
      [26, 2],
      [22, 6],
    ],
    stone,
    { seed: 1, amp: 0.6, ink: 2.2 },
  );
  svg += '<path d="M22 22 L42 22 L42 6 L38 2 L26 2 L22 6Z" fill="url(#pd)"/>';
  svg += `<path d="M27 8 h10 v8 h-10Z" fill="none" stroke="${stoneDark}" stroke-width="1.1"/>`;
  svg += `<circle cx="32" cy="12" r="2" fill="#4f7393" stroke="${INK}" stroke-width="0.8"/>`;
  svg += inkShape(rectPts(30.5, 16, 3, 3), "#8a7a5a", { seed: 2, amp: 0.1, ink: 1 });
  // Pila con agua.
  svg += inkShape(
    [
      [5, 22],
      [59, 22],
      [57, 38],
      [7, 38],
    ],
    stone,
    { seed: 3, amp: 0.8, ink: 2.4 },
  );
  svg += '<path d="M5 22 L59 22 L57 38 L7 38Z" fill="url(#pd)"/>';
  svg += inkShape(
    [
      [9, 23.5],
      [55, 23.5],
      [54, 29],
      [10, 29],
    ],
    "url(#ag)",
    { seed: 4, amp: 0.5, ink: 1.4 },
  );
  svg += `<path d="M9 25 H55" stroke="${INK}" stroke-opacity="0.3" stroke-width="1.6"/>`;
  // Chorro y ondas.
  svg += '<path d="M32 19 q0.6 3 0 6" stroke="#dff1f6" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
  svg +=
    '<ellipse cx="32" cy="26.5" rx="4" ry="1.1" fill="none" stroke="#dff1f6" stroke-width="0.8"/><ellipse cx="32" cy="26.5" rx="8" ry="2" fill="none" stroke="#dff1f6" stroke-opacity="0.5" stroke-width="0.6"/>';
  svg += '<path d="M14 26.5 h6 M44 27.5 h7" stroke="#ffffff" stroke-opacity="0.45" stroke-width="0.8"/>';
  svg += `<path d="M24 30 v8 M42 30 v8" stroke="${stoneDark}" stroke-width="1"/>`;
  // Musgo al pie.
  svg +=
    '<path d="M8 37 q8 -2 14 0 q6 1 10 -1 M44 37 q6 -2 12 0" stroke="#6f7c3c" stroke-opacity="0.8" stroke-width="2" fill="none" stroke-linecap="round"/>';
  svg += '<path d="M6.5 23 L8 37" stroke="#ffffff" stroke-opacity="0.4" stroke-width="1"/>';
  return svgDoc(64, 44, svg);
}

/** "papelera": papelera verde sobre poste. */
export function litterBin(): string {
  let svg = `<defs>${linearGradient(
    "pp",
    [
      [0, "#ffffff", 0.3],
      [0.35, "#ffffff", 0],
      [1, "#000000", 0.4],
    ],
    0,
    0,
    1,
    0,
  )}</defs>`;
  svg += groundShadow(8, 24.5, 5.5, 1.6, 0.3);
  svg += inkShape(rectPts(6.8, 12, 2.4, 13), "#2a2622", { seed: 1, amp: 0.1, ink: 1 });
  svg += inkShape(
    [
      [2.5, 4],
      [13.5, 4],
      [12.5, 17],
      [3.5, 17],
    ],
    "#3f6a46",
    { seed: 2, amp: 0.3, ink: 1.6 },
  );
  svg += '<path d="M2.5 4 L13.5 4 L12.5 17 L3.5 17Z" fill="url(#pp)"/>';
  for (const x of [5.5, 8, 10.5]) svg += `<path d="M${x} 7 V15" stroke="#2c4a30" stroke-width="0.8"/>`;
  svg += `<ellipse cx="8" cy="4" rx="5.8" ry="1.6" fill="#1d2a1e" stroke="${INK}" stroke-width="1.1"/>`;
  svg += '<path d="M5 3.4 q2 -1 4 0" stroke="#e9e2d0" stroke-width="0.9" fill="none"/>';
  return svgDoc(16, 26, svg);
}

/** "estatua": figura de piedra con aureola sobre pedestal. */
export function statue(headless = false): string {
  const stone = "#e8e2d2";
  const stoneShadow = "#bdb4a0";
  let svg = `<ellipse cx="34" cy="122" rx="26" ry="6" fill="${INK}" fill-opacity="0.3"/>`;
  // Pedestal escalonado.
  svg += inkShape(
    [
      [10, 122],
      [58, 122],
      [58, 104],
      [10, 104],
    ],
    "#9c8e74",
    { seed: 1, amp: 0.8, ink: 2.4 },
  );
  svg += inkShape(
    [
      [7, 104],
      [61, 104],
      [56, 97],
      [12, 97],
    ],
    "#cbbd9f",
    { seed: 2, amp: 0.6, ink: 2.2 },
  );
  svg += inkShape(
    [
      [18, 97],
      [50, 97],
      [48, 72],
      [20, 72],
    ],
    "#a99a7e",
    { seed: 3, amp: 0.8, ink: 2.4 },
  );
  svg += inkShape(
    [
      [15, 72],
      [53, 72],
      [50, 66],
      [18, 66],
    ],
    "#cbbd9f",
    { seed: 4, amp: 0.5, ink: 2 },
  );
  svg += `<path d="M22 100 l24 0" stroke="${INK}" stroke-opacity="0.3" stroke-width="1.2"/>`;
  // Figura: cuerpo, sombra lateral, brazos abiertos, cabeza y aureola.
  svg += inkShape(
    [
      [26, 66],
      [42, 66],
      [40, 36],
      [37, 26],
      [31, 26],
      [28, 36],
    ],
    stone,
    { seed: 5, amp: 0.8, ink: 2.4 },
  );
  svg += inkShape(
    [
      [37, 28],
      [41, 40],
      [42, 66],
      [38, 66],
      [37, 40],
    ],
    stoneShadow,
    { seed: 6, amp: 0.4, ink: 0 },
  );
  svg += inkShape(
    [
      [8, 33],
      [30, 28],
      [38, 28],
      [60, 33],
      [58, 37],
      [37, 34],
      [31, 34],
      [10, 37],
    ],
    stone,
    { seed: 7, amp: 0.6, ink: 2.2 },
  );
  if (headless) {
    // Muñón roto del cuello y la aureola apagada y torcida
    svg += `<path d="M30 28 l1 -4 l2 3 l2 -4 l2 3 l2 -2 l0 4Z" fill="#d6cfbd" stroke="${INK}" stroke-width="1.8"/>`;
    svg += '<ellipse cx="36" cy="17" rx="11" ry="9" transform="rotate(-18 36 17)" fill="none" stroke="#8a7a52" stroke-width="2" stroke-dasharray="4 3"/>';
  } else {
    svg += `<circle cx="34" cy="20" r="7" fill="${stone}" stroke="${INK}" stroke-width="2.2"/>`;
    svg += `<path d="M30 17 q4 -5 8 0" stroke="${stoneShadow}" stroke-width="2" fill="none"/>`;
    svg += '<circle cx="34" cy="18" r="11" fill="none" stroke="#e2bd52" stroke-width="2.2"/>';
  }
  svg +=
    inkStroke(
      [
        [30, 44],
        [33, 62],
      ],
      1,
      stoneShadow,
      8,
      0.6,
    ) +
    inkStroke(
      [
        [36, 44],
        [37, 62],
      ],
      1,
      stoneShadow,
      9,
      0.6,
    );
  return svgDoc(68, 128, svg);
}

/** "marcador": chincheta de mapa. */
export function mapMarker(color = "#c4642f"): string {
  const pin = smoothPath(
    wobble(
      [
        [14, 34],
        [5, 18],
        [5, 11],
        [9, 5],
        [14, 3],
        [19, 5],
        [23, 11],
        [23, 18],
      ],
      0.6,
      3,
    ),
    true,
  );
  return svgDoc(
    28,
    38,
    `<ellipse cx="14" cy="35" rx="7" ry="2.6" fill="${INK}" fill-opacity="0.35"/><path d="${pin}" fill="${color}" stroke="${INK}" stroke-width="2.2"/><circle cx="14" cy="12" r="4" fill="#f3ead6" stroke="${INK}" stroke-width="1.6"/>`,
  );
}

/** "aviso": bocadillo amarillo con exclamación. */
export function alertSign(): string {
  return svgDoc(
    30,
    34,
    inkShape(
      [
        [3, 3],
        [27, 3],
        [27, 23],
        [19, 23],
        [15, 31],
        [12, 23],
        [3, 23],
      ],
      "#f2b705",
      { seed: 2, amp: 0.6, ink: 2.4 },
    ) + `<path d="M15 7 L15 15" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><circle cx="15" cy="19.5" r="2" fill="${INK}"/>`,
  );
}

/** "punto". */
export function dot(): string {
  return svgDoc(14, 14, `<circle cx="7" cy="7" r="4.6" fill="#f2b705" stroke="${INK}" stroke-width="1.8"/>`);
}

/** Trazos de los iconos de la interfaz (lienzo de 48×48). */
export const ICONS = {
  mano: '<path d="M17 26 V12 a2.6 2.6 0 0 1 5.2 0 V23 M22.2 22 V9 a2.6 2.6 0 0 1 5.2 0 V22 M27.4 22 V11 a2.6 2.6 0 0 1 5.2 0 V24 M32.6 24 V16 a2.6 2.6 0 0 1 5.2 0 V29 c0 8 -5 13 -12 13 c-6 0 -9 -3 -12 -8 l-5 -8 a2.8 2.8 0 0 1 4.6 -3.2 L17 26"/>',
  cuchillo: '<path d="M10 38 L30 18 L36 12 c3 -3 5 0 3 3 L19 38 Z M10 38 l-3 3 M13 35 l5 5"/>',
  cesta: '<path d="M8 20 H40 L36 39 H12 Z M15 20 C15 9 33 9 33 20 M16 26 V34 M24 26 V34 M32 26 V34"/>',
  megafono: '<path d="M8 20 V29 H14 L34 38 V11 L14 20 Z M14 29 L17 39 H22 L20 31 M38 19 c3 3 3 8 0 11"/>',
  campana: '<path d="M24 7 c-7 0 -11 5 -11 12 V28 L9 34 H39 L35 28 V19 C35 12 31 7 24 7 Z M20 38 c1 3 7 3 8 0 M24 4 V7"/>',
  sonido: '<path d="M8 19 V29 H15 L25 37 V11 L15 19 Z M30 18 c3 3 3 9 0 12 M34 14 c6 6 6 14 0 20"/>',
  silencio: '<path d="M8 19 V29 H15 L25 37 V11 L15 19 Z M30 19 L40 29 M40 19 L30 29"/>',
  saludo: '<path d="M16 28 V14 a2.4 2.4 0 0 1 4.8 0 V24 M20.8 23 V11 a2.4 2.4 0 0 1 4.8 0 V23 M25.6 23 V13 a2.4 2.4 0 0 1 4.8 0 V25 M30.4 25 V18 a2.4 2.4 0 0 1 4.8 0 V30 c0 7 -4.5 11 -10.5 11 c-5.5 0 -8 -2.5 -10.7 -7 l-4.4 -7 a2.6 2.6 0 0 1 4.3 -3 L16 28 M8 12 c-2 3 -2 6 0 9 M39 9 c2 2 3 5 2 8"/>',
  fuego: '<path d="M24 42 c-8 0 -13 -5 -13 -12 c0 -7 6 -10 6 -17 c4 3 6 6 6 10 c2 -3 2 -7 1 -11 c8 4 13 11 13 18 c0 7 -5 12 -13 12 Z M24 42 c-3 0 -5 -2 -5 -5 c0 -3 3 -5 5 -9 c2 4 5 6 5 9 c0 3 -2 5 -5 5"/>',
  cubo: '<path d="M10 14 H38 L34 40 H14 Z M10 14 C10 6 38 6 38 14 M18 22 c2 2 4 2 6 0 s4 -2 6 0 M30 6 c2 -3 4 -3 5 0"/>',
  sabotaje: '<path d="M16 32 a6 6 0 1 0 0.01 0 M32 32 a6 6 0 1 0 0.01 0 M20 28 L34 8 M28 28 L14 8"/>',
  llave: '<path d="M30 8 a10 10 0 1 0 8 14 l-4 -4 l-5 1 l-1 -5 l-4 -4 Z M22 22 L9 35 l4 4 l13 -13"/>',
  moneda: '<path d="M24 8 a16 16 0 1 0 0.01 0 Z M24 14 a10 10 0 1 0 0.01 0 Z M21 20 h6 l-4 10 M20 24 h7"/>',
  pantalla: '<path d="M9 18 V9 H18 M30 9 H39 V18 M39 30 V39 H30 M18 39 H9 V30"/>',
  tareas: '<path d="M12 8 H36 V40 H12 Z M17 16 l2.5 2.5 L24 14 M27 16 H32 M17 25 l2.5 2.5 L24 23 M27 25 H32 M17 34 H22 M27 34 H32"/>',
};

export type IconName = keyof typeof ICONS;

/** "icono-<nombre>": icono de trazo claro sobre transparente. */
export function iconTexture(name: IconName): string {
  return svgDoc(
    48,
    48,
    `<g fill="none" stroke="#f3ead6" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`,
  );
}
