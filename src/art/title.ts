// Ilustración de la pantalla de título: el pueblo de noche con la torre de la iglesia.
import { INK, inkShape, inkStroke, rectPts, seededRng, shade, svgDoc } from "./svg";

/** Casa de la silueta del fondo: fachada, tejado, ventanas (algunas encendidas) y puerta. */
function backdropHouse(x: number, groundY: number, width: number, height: number, color: string, seed: number): string {
  const rng = seededRng(seed);
  const top = groundY - height;
  let svg = inkShape(rectPts(x, top, width, height), color, { seed, amp: 1.4, ink: 3 });
  svg += inkShape(
    [
      [x - 6, top + 2],
      [x + width / 2, top - height * 0.32],
      [x + width + 6, top + 2],
    ],
    "#7a3a26",
    { seed: seed + 1, amp: 1.2, ink: 3 },
  );
  for (let i = 0; i < 4; i++) {
    svg += inkStroke(
      [
        [x + 4 + i * (width / 4), top],
        [x + width / 2, top - height * 0.3],
      ],
      1,
      shade("#7a3a26", -0.35),
      seed + 10 + i,
      0.6,
      0.6,
    );
  }
  const columns = Math.max(1, Math.floor(width / 34));
  for (let col = 0; col < columns; col++) {
    const windowX = x + (width / columns) * (col + 0.5) - 7;
    for (const windowY of height > 90 ? [top + 18, top + 58] : [top + 20]) {
      const lit = rng() < 0.55;
      svg += inkShape(rectPts(windowX, windowY, 14, 18), lit ? "#f6c76a" : "#2a2a33", {
        seed: seed + windowX + windowY,
        amp: 0.6,
        ink: 2,
      });
      if (lit) {
        svg += `<rect x="${windowX - 10}" y="${windowY - 8}" width="34" height="34" fill="#f6c76a" opacity="0.12" rx="17"/>`;
      }
      svg += inkStroke(
        [
          [windowX + 7, windowY],
          [windowX + 7, windowY + 18],
        ],
        1.2,
        INK,
        seed + 3,
        0.2,
      );
    }
  }
  svg += inkShape(
    [
      [x + width / 2 - 9, groundY],
      [x + width / 2 - 9, groundY - 26],
      [x + width / 2, groundY - 33],
      [x + width / 2 + 9, groundY - 26],
      [x + width / 2 + 9, groundY],
    ],
    "#4a2c1c",
    { seed: seed + 5, amp: 0.6, ink: 2.4 },
  );
  svg += inkShape(rectPts(x, groundY - 12, width, 12), "#5a4a3a", { seed: seed + 6, amp: 0.8, ink: 2.4 });
  return svg;
}

/** Torre de la iglesia con campanario, cruz y reloj. */
function churchTower(x: number, groundY: number): string {
  let svg = inkShape(rectPts(x, groundY - 300, 70, 300), "#d8c9a6", { seed: 70, amp: 1.6, ink: 3.4 });
  svg += inkShape(rectPts(x + 8, groundY - 380, 54, 82), "#cdbd98", { seed: 71, amp: 1.4, ink: 3.2 });
  svg += inkShape(
    [
      [x + 2, groundY - 380],
      [x + 35, groundY - 450],
      [x + 68, groundY - 380],
    ],
    "#7a3a26",
    { seed: 72, amp: 1.2, ink: 3.2 },
  );
  // Cruz.
  svg +=
    inkStroke(
      [
        [x + 35, groundY - 450],
        [x + 35, groundY - 480],
      ],
      3,
      INK,
      73,
      0.2,
    ) +
    inkStroke(
      [
        [x + 24, groundY - 470],
        [x + 46, groundY - 470],
      ],
      3,
      INK,
      74,
      0.2,
    );
  // Hueco del campanario con la campana.
  svg += `<path d="M${x + 20} ${groundY - 310} v-40 a15 15 0 0 1 30 0 v40Z" fill="#1e1a22" stroke="${INK}" stroke-width="2.4"/>`;
  svg += `<path d="M${x + 27} ${groundY - 322} q8 -16 16 0Z" fill="#c79a32" stroke="${INK}" stroke-width="2"/>`;
  // Reloj.
  svg += `<circle cx="${x + 35}" cy="${groundY - 240}" r="16" fill="#efe6d2" stroke="${INK}" stroke-width="2.6"/><path d="M${x + 35} ${groundY - 240} l0 -10 M${x + 35} ${groundY - 240} l7 4" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < 3; i++) {
    svg += inkShape(rectPts(x + 26, groundY - 190 + i * 55, 18, 26), "#2a2a33", { seed: 75 + i, amp: 0.5, ink: 2.2 });
  }
  return svg;
}

/** Farola encendida con halo. */
function streetLight(x: number, groundY: number): string {
  return (
    `<circle cx="${x}" cy="${groundY - 92}" r="46" fill="#f6c76a" opacity="0.14"/>` +
    inkShape(rectPts(x - 2.5, groundY - 86, 5, 86), "#2b2420", { seed: x, amp: 0.4, ink: 2 }) +
    inkShape(
      [
        [x - 9, groundY - 84],
        [x + 9, groundY - 84],
        [x + 6, groundY - 102],
        [x - 6, groundY - 102],
      ],
      "#f6d58a",
      { seed: x + 1, amp: 0.4, ink: 2.2 },
    ) +
    inkShape(
      [
        [x - 11, groundY - 102],
        [x + 11, groundY - 102],
        [x, groundY - 112],
      ],
      "#2b2420",
      { seed: x + 2, amp: 0.3, ink: 2 },
    )
  );
}

/** SVG de 1200×800 para el fondo de la pantalla de inicio. */
export function titleScene(): string {
  const rng = seededRng(3);
  let svg =
    '<defs><linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1622"/><stop offset="0.55" stop-color="#3a2a33"/><stop offset="1" stop-color="#7a4a35"/></linearGradient></defs>';
  svg += '<rect width="1200" height="800" fill="url(#cielo)"/>';
  // Estrellas.
  for (let i = 0; i < 60; i++) {
    svg += `<circle cx="${rng() * 1200}" cy="${rng() * 360}" r="${0.8 + rng() * 1.4}" fill="#f3ead6" opacity="${0.3 + rng() * 0.5}"/>`;
  }
  // Luna.
  svg += `<circle cx="930" cy="190" r="120" fill="#f6d58a" opacity="0.12"/><circle cx="930" cy="190" r="74" fill="#efd9a0" stroke="${INK}" stroke-width="3"/>`;
  svg += '<circle cx="905" cy="170" r="12" fill="#d9c088"/><circle cx="950" cy="215" r="9" fill="#d9c088"/>';
  // Colinas con olivos.
  svg += `<path d="M0 560 Q200 480 420 540 T820 520 T1200 540 V800 H0Z" fill="#2c2a2a" stroke="${INK}" stroke-width="3"/>`;
  for (let i = 0; i < 18; i++) {
    const x = rng() * 1200;
    const y = 530 + rng() * 30;
    svg += `<circle cx="${x}" cy="${y}" r="${7 + rng() * 5}" fill="#3a3a30" stroke="${INK}" stroke-width="2"/>`;
  }
  svg += churchTower(150, 720);
  // Hilera de casas, dejando hueco para la torre (x 130..230).
  const houseColors = ["#e9dcc0", "#d8c4a2", "#efe6d2", "#e2c48c"];
  let x = -20;
  let houseIndex = 0;
  while (x < 1200) {
    const width = 110 + rng() * 70;
    const height = 100 + rng() * 70;
    if (x + width > 130 && x < 230) {
      x = 230;
      continue;
    }
    svg += backdropHouse(x, 720, width, height, houseColors[houseIndex % 4], 100 + houseIndex * 7);
    x += width + 4;
    houseIndex++;
  }
  // Calle empedrada.
  svg += '<rect x="0" y="720" width="1200" height="80" fill="#3b332b"/>';
  for (let i = 0; i < 40; i++) {
    svg += `<ellipse cx="${rng() * 1200}" cy="${734 + rng() * 60}" rx="${8 + rng() * 8}" ry="${4 + rng() * 3}" fill="#57504a" stroke="${INK}" stroke-width="1.5"/>`;
  }
  for (const lampX of [80, 420, 760, 1100]) svg += streetLight(lampX, 726);
  svg += '<rect width="1200" height="800" fill="#120c08" opacity="0.18"/>';
  return svgDoc(1200, 800, svg);
}
