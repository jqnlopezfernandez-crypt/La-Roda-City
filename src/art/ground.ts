// Texturas de suelo repetibles (asfalto, acera, empedrado, tierra, campo, losas, tejas).
import {
  INK,
  ellipsePts,
  inkShape,
  jitterLine,
  linearGradient,
  seededRng,
  shade,
  smoothPath,
  speckles,
  svgDoc,
  wobble,
  type Point,
} from "./svg";

let textureSeq = 0;

/**
 * Hace una textura sin costuras: dibuja el contenido una vez dentro de un <g> y lo
 * repite con <use> en las 8 posiciones vecinas, para que lo que se sale por un borde
 * entre por el contrario.
 */
function seamlessTile(width: number, height: number, draw: (dx: number, dy: number) => string): string {
  const id = `mosaico${textureSeq++}`;
  let result = `<g id="${id}">${draw(0, 0)}</g>`;
  for (const dx of [-width, 0, width]) {
    for (const dy of [-height, 0, height]) {
      if (dx || dy) result += `<use href="#${id}" x="${dx}" y="${dy}"/>`;
    }
  }
  return result;
}

interface Cobble {
  pts: Point[];
  c: Point;
  rad: number;
  fill: string;
  seed: number;
}

/** "suelo-empedrado": cantos rodados repartidos con distancia mínima (en toro). */
export function cobblestoneTexture(size = 128): string {
  const rng = seededRng(41);
  const colors = ["#8d8577", "#968d7f", "#80786b", "#9c9284", "#8a8174", "#a0968a"];
  const centers: Point[] = [];
  for (let attempt = 0; attempt < 900 && centers.length < 34; attempt++) {
    const candidate: Point = [rng() * size, rng() * size];
    const farEnough = centers.every(([cx, cy]) => {
      const dx = Math.min(Math.abs(cx - candidate[0]), size - Math.abs(cx - candidate[0]));
      const dy = Math.min(Math.abs(cy - candidate[1]), size - Math.abs(cy - candidate[1]));
      return Math.hypot(dx, dy) > 17;
    });
    if (farEnough) centers.push(candidate);
  }
  const stones = centers.map((center, index): Cobble => {
    // Radio: la mitad de la distancia al vecino más cercano (con envoltura).
    let nearest = Infinity;
    for (const [ox, oy] of centers) {
      if (ox === center[0] && oy === center[1]) continue;
      const dx = Math.min(Math.abs(ox - center[0]), size - Math.abs(ox - center[0]));
      const dy = Math.min(Math.abs(oy - center[1]), size - Math.abs(oy - center[1]));
      nearest = Math.min(nearest, Math.hypot(dx, dy));
    }
    const radius = nearest / 2 - 1.6;
    const rotation = rng() * Math.PI;
    return {
      pts: Array.from({ length: 7 }, (_, i): Point => {
        const angle = rotation + (i / 7) * Math.PI * 2;
        const r = radius * (0.82 + rng() * 0.3);
        return [center[0] + Math.cos(angle) * r * 1.12, center[1] + Math.sin(angle) * r * 0.92];
      }),
      c: center,
      rad: radius,
      fill: colors[Math.floor(rng() * colors.length)],
      seed: index,
    };
  });
  const tiled = seamlessTile(size, size, (dx, dy) =>
    stones
      .map((stone) => {
        const pts = stone.pts.map(([px, py]): Point => [px + dx, py + dy]);
        const [cx, cy] = [stone.c[0] + dx, stone.c[1] + dy];
        const r = stone.rad;
        return `<path d="${smoothPath(wobble(pts, 1.4, stone.seed))}" fill="${stone.fill}" stroke="#3b332b" stroke-width="1.5"/><path d="${smoothPath(wobble(ellipsePts(cx - r * 0.25, cy - r * 0.3, r * 0.42, r * 0.26, 7), 0.6, stone.seed + 3))}" fill="#ffffff" fill-opacity="0.09"/><path d="M${cx - r * 0.55} ${cy + r * 0.45} Q${cx} ${cy + r * 0.75} ${cx + r * 0.6} ${cy + r * 0.3}" stroke="#2a221b" stroke-opacity="0.3" stroke-width="1.4" fill="none"/>`;
      })
      .join(""),
  );
  return svgDoc(size, size, `<rect width="${size}" height="${size}" fill="#4f463d"/>${tiled}`);
}

/** Piedrecita con sombra y brillo. */
function pebble(cx: number, cy: number, rx: number, ry: number, fill: string, seed: number): string {
  const path = smoothPath(wobble(ellipsePts(cx, cy, rx, ry, 7), Math.min(rx, ry) * 0.4, seed));
  return `<ellipse cx="${(cx + rx * 0.35).toFixed(1)}" cy="${(cy + ry * 0.55).toFixed(1)}" rx="${(rx * 1.05).toFixed(1)}" ry="${(ry * 0.8).toFixed(1)}" fill="${INK}" fill-opacity="0.28"/><path d="${path}" fill="${fill}" stroke="${INK}" stroke-opacity="0.55" stroke-width="0.8"/><ellipse cx="${(cx - rx * 0.3).toFixed(1)}" cy="${(cy - ry * 0.35).toFixed(1)}" rx="${(rx * 0.4).toFixed(1)}" ry="${(ry * 0.3).toFixed(1)}" fill="#ffffff" fill-opacity="0.3"/>`;
}

/** "suelo-tierra": tierra con rodada, grietas, paja, hojas, piedras y matojos. */
export function dirtTexture(size = 256): string {
  const rng = seededRng(7);
  // Escala la cantidad de elementos con el área respecto a 256×256.
  const scaled = (count: number) => Math.round(count * (size / 256) ** 2);
  const stones = Array.from({ length: scaled(16) }, (_, i) => ({
    x: rng() * size,
    y: rng() * size,
    rx: 1.8 + rng() * 3.2,
    i,
    c: ["#a08a6e", "#8c7a62", "#b3a184"][i % 3],
  }));
  const tufts = Array.from({ length: scaled(9) }, () => ({ x: rng() * size, y: rng() * size, k: 0.8 + rng() * 0.6 }));
  const straws = Array.from({ length: scaled(22) }, () => ({
    x: rng() * size,
    y: rng() * size,
    a: rng() * Math.PI,
    l: 3 + rng() * 4,
  }));
  const leaves = Array.from({ length: scaled(6) }, () => ({ x: rng() * size, y: rng() * size, a: rng() * 180 }));
  const cracks = [
    { x: size * 0.28, y: size * 0.72 },
    { x: size * 0.78, y: size * 0.22 },
  ];
  const details = seamlessTile(
    size,
    size,
    (dx, dy) =>
      `<path d="M${-20 + dx} ${size * 0.55 + dy} C${size * 0.3 + dx} ${size * 0.35 + dy} ${size * 0.6 + dx} ${size * 0.8 + dy} ${size + 20 + dx} ${size * 0.55 + dy}" stroke="#94785a" stroke-opacity="0.45" stroke-width="26" fill="none" stroke-linecap="round"/>` +
      cracks
        .map(
          (crack, i) =>
            jitterLine(crack.x + dx, crack.y + dy, 26, 0.4 + i, "#5a4430", 1.1, 90 + i, 0.6) +
            jitterLine(crack.x + dx + 6, crack.y + dy + 4, 16, 2.2 + i, "#5a4430", 0.9, 95 + i, 0.5),
        )
        .join("") +
      straws
        .map(
          (straw) =>
            `<path d="M${(straw.x + dx).toFixed(1)} ${(straw.y + dy).toFixed(1)} l${(Math.cos(straw.a) * straw.l).toFixed(1)} ${(Math.sin(straw.a) * straw.l).toFixed(1)}" stroke="#c9ad6a" stroke-opacity="0.75" stroke-width="0.9" stroke-linecap="round"/>`,
        )
        .join("") +
      leaves
        .map(
          (leaf) =>
            `<path d="M0 0 q3 -2 6 0 q-3 2 -6 0Z" transform="translate(${(leaf.x + dx).toFixed(1)} ${(leaf.y + dy).toFixed(1)}) rotate(${leaf.a.toFixed(0)})" fill="#7d7a4a" stroke="${INK}" stroke-opacity="0.4" stroke-width="0.5"/>`,
        )
        .join("") +
      stones.map((stone) => pebble(stone.x + dx, stone.y + dy, stone.rx, stone.rx * 0.7, stone.c, stone.i)).join("") +
      tufts
        .map((tuft) => {
          const x = tuft.x + dx;
          const y = tuft.y + dy;
          const k = tuft.k;
          return `<ellipse cx="${x + 1}" cy="${y + 1}" rx="${6 * k}" ry="${2 * k}" fill="${INK}" fill-opacity="0.18"/><path d="M${x - 4 * k} ${y} q1 ${-5 * k} ${3 * k} ${-7 * k} M${x - 1} ${y} q0 ${-7 * k} ${1.5 * k} ${-9 * k} M${x + 2 * k} ${y} q1 ${-5 * k} ${4 * k} ${-6 * k} M${x + 4 * k} ${y} q-1 ${-4 * k} ${-0.5 * k} ${-5 * k}" stroke="#8a8a46" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M${x - 2} ${y} q0 ${-4 * k} ${1 * k} ${-6 * k}" stroke="#c4b064" stroke-width="1" fill="none" stroke-linecap="round"/>`;
        })
        .join(""),
  );
  return svgDoc(
    size,
    size,
    `<rect width="${size}" height="${size}" fill="#77593c"/>` +
      seamlessTile(size, size, (dx, dy) =>
        speckles(dx, dy, size, size, scaled(14), ["#6b5036", "#84674a", "#7c5d3f"], 18, 40, 0.5, 12),
      ) +
      details,
  );
}

/**
 * "suelo-campo" / "suelo-cesped": hierba con matas, tréboles, flores y piedras.
 * `wild` = campo (más matas secas, amapolas); false = césped cuidado.
 */
export function fieldTexture(size = 256, baseColor = "#6c7a48", seed = 21, wild = true): string {
  const rng = seededRng(seed);
  const scaled = (count: number) => Math.round(count * (size / 256) ** 2);
  const darkGreen = shade(baseColor, -0.3);
  const lightGreen = shade(baseColor, 0.22);
  const dryColor = "#a49a5a";
  const tufts = Array.from({ length: scaled(wild ? 20 : 16) }, () => ({
    x: rng() * size,
    y: rng() * size,
    k: (wild ? 0.8 : 0.55) + rng() * 0.6,
    dry: rng() < (wild ? 0.25 : 0.05),
  }));
  const clovers = Array.from({ length: scaled(7) }, () => ({ x: rng() * size, y: rng() * size }));
  const dryPatches = Array.from({ length: scaled(wild ? 3 : 1) }, () => ({
    x: rng() * size,
    y: rng() * size,
    rx: 10 + rng() * 16,
    ry: 6 + rng() * 9,
  }));
  const flowers = Array.from({ length: scaled(wild ? 5 : 4) }, () => ({ x: rng() * size, y: rng() * size, c: rng() }));
  const stones = Array.from({ length: scaled(wild ? 5 : 2) }, (_, i) => ({
    x: rng() * size,
    y: rng() * size,
    rx: 1.5 + rng() * 2,
    i,
  }));
  /** Brizna de hierba curvada. */
  const blade = (x: number, y: number, height: number, lean: number, color: string, width = 1.4) =>
    `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(lean * 0.3).toFixed(1)} ${(-height * 0.6).toFixed(1)} ${lean.toFixed(1)} ${(-height).toFixed(1)}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`;
  const details = seamlessTile(
    size,
    size,
    (dx, dy) =>
      dryPatches
        .map(
          (patch, i) =>
            `<path d="${smoothPath(wobble(ellipsePts(patch.x + dx, patch.y + dy, patch.rx, patch.ry, 9), 6, seed + i))}" fill="${dryColor}" fill-opacity="0.35"/>`,
        )
        .join("") +
      stones.map((stone) => pebble(stone.x + dx, stone.y + dy, stone.rx, stone.rx * 0.7, "#a59c88", stone.i + seed)).join("") +
      clovers
        .map((clover, index) => {
          let result = "";
          const cloverRng = seededRng(seed * 13 + index);
          for (let leaf = 0; leaf < 6; leaf++) {
            const lx = clover.x + dx + (cloverRng() - 0.5) * 14;
            const ly = clover.y + dy + (cloverRng() - 0.5) * 9;
            for (let petal = 0; petal < 3; petal++) {
              result += `<circle cx="${(lx + Math.cos(petal * 2.1) * 1.6).toFixed(1)}" cy="${(ly + Math.sin(petal * 2.1) * 1.6).toFixed(1)}" r="1.5" fill="${petal === 0 ? lightGreen : shade(baseColor, 0.08)}"/>`;
            }
          }
          return result;
        })
        .join("") +
      tufts
        .map((tuft, index) => {
          const x = tuft.x + dx;
          const y = tuft.y + dy;
          const k = tuft.k;
          const tuftRng = seededRng(seed * 31 + index);
          let result = `<ellipse cx="${(x + 2 * k).toFixed(1)}" cy="${(y + 1).toFixed(1)}" rx="${(8 * k).toFixed(1)}" ry="${(2.6 * k).toFixed(1)}" fill="${INK}" fill-opacity="0.2"/>`;
          const bladeCount = 5 + Math.floor(tuftRng() * 5);
          const sway = (tuftRng() - 0.5) * 3;
          for (let b = 0; b < bladeCount; b++) {
            const bx = x + (b - bladeCount / 2) * 1.5 * k + (tuftRng() - 0.5) * 1.5;
            const height = (5 + tuftRng() * 7) * k;
            const lean = (b - bladeCount / 2) * (0.6 + tuftRng() * 0.8) * k + sway + (tuftRng() - 0.5) * 2.5;
            result += blade(bx, y, height, lean, b < 3 ? darkGreen : tuft.dry ? dryColor : shade(baseColor, -0.12));
          }
          // Dos briznas claras por delante.
          result += blade(x - 3 * k, y - 0.5, 8 * k, -2.5 * k, tuft.dry ? "#d8cc8a" : lightGreen, 1.1);
          result += blade(x - 0.5 * k, y - 0.5, 10 * k, -0.6 * k, tuft.dry ? "#d8cc8a" : lightGreen, 1);
          return result;
        })
        .join("") +
      flowers
        .map((flower, index) => {
          const flowerRng = seededRng(seed * 7 + index);
          const color = wild
            ? flower.c < 0.35
              ? "#d8382e"
              : flower.c < 0.7
                ? "#f3efe2"
                : "#e8c94a"
            : flower.c < 0.6
              ? "#f3efe2"
              : "#e8c94a";
          let result = "";
          for (let i = 0; i < 4; i++) {
            const fx = flower.x + dx + (flowerRng() - 0.5) * 12;
            const fy = flower.y + dy + (flowerRng() - 0.5) * 8;
            result += `<path d="M${fx.toFixed(1)} ${(fy + 3).toFixed(1)} v-3" stroke="${darkGreen}" stroke-width="0.8"/><circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="1.9" fill="${color}" stroke="${INK}" stroke-opacity="0.4" stroke-width="0.5"/>`;
            // Margaritas: botón amarillo en el centro.
            if (color === "#f3efe2") result += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="0.7" fill="#e8b92a"/>`;
          }
          return result;
        })
        .join(""),
  );
  return svgDoc(
    size,
    size,
    `<rect width="${size}" height="${size}" fill="${baseColor}"/>` +
      seamlessTile(size, size, (dx, dy) =>
        speckles(
          dx,
          dy,
          size,
          size,
          scaled(14),
          [shade(baseColor, -0.1), shade(baseColor, 0.07), shade(baseColor, -0.05)],
          20,
          44,
          0.55,
          seed + 3,
        ),
      ) +
      details,
  );
}

/** "suelo-losas": hileras de losas de piedra de ancho variable, desplazadas por fila. */
export function slabTexture(size = 128): string {
  const rng = seededRng(61);
  const rows = 4;
  const rowHeight = size / rows;
  const colors = ["#cdbfa1", "#c4b596", "#d4c7aa", "#bfb08f", "#c9b893"];
  let result = "";
  for (let row = 0; row < rows; row++) {
    const edges = [0];
    while (edges[edges.length - 1] < size - 20) edges.push(edges[edges.length - 1] + 22 + Math.floor(rng() * 18));
    edges[edges.length - 1] = size;
    const shift = (row * 37) % size;
    for (let col = 0; col < edges.length - 1; col++) {
      const left = edges[col] + shift;
      const right = edges[col + 1] + shift;
      const top = row * rowHeight;
      const bottom = top + rowHeight;
      const fill = colors[Math.floor(rng() * colors.length)];
      const cracked = rng() < 0.18;
      const mossy = rng() < 0.4;
      const seed = row * 50 + col;
      // Se dibuja dos veces (desplazada -size) para que envuelva horizontalmente.
      for (const wrap of [0, -size]) {
        const x0 = left + wrap + 1.2;
        const x1 = right + wrap - 1.2;
        const y0 = top + 1.2;
        const y1 = bottom - 1.2;
        result += inkShape(
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ],
          fill,
          { seed, amp: 1.2, ink: 1.3, inkColor: "#5f5444" },
        );
        result += `<path d="M${x0 + 1} ${y1 - 1.5} V${y0 + 1.2} H${x1 - 1.5}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.1" fill="none"/>`;
        result += `<path d="M${x0 + 1.5} ${y1 - 0.8} H${x1 - 0.8} V${y0 + 1.5}" stroke="#4e4436" stroke-opacity="0.35" stroke-width="1.1" fill="none"/>`;
        result += `<ellipse cx="${(x0 + x1) / 2}" cy="${(y0 + y1) / 2}" rx="${(x1 - x0) * 0.3}" ry="${(y1 - y0) * 0.25}" fill="#ffffff" fill-opacity="0.08"/>`;
        if (cracked) result += jitterLine(x0 + (x1 - x0) * 0.3, y0 + 2, (y1 - y0) * 0.8, 1.2, "#6a5e4c", 0.8, seed);
        if (mossy) {
          result += `<path d="M${x1 - 6} ${y1 + 0.4} h7" stroke="#6f7c3c" stroke-opacity="0.75" stroke-width="1.6" stroke-linecap="round"/>`;
        }
        // Esquina desconchada (consume rng en cada pasada).
        if (rng() < 0.3) result += `<path d="M${x1 - 1} ${y0} l-3 0 l2 3Z" fill="#8d806a"/>`;
      }
    }
  }
  return svgDoc(size, size, `<rect width="${size}" height="${size}" fill="#8a7d66"/>${result}`);
}

interface TileMark {
  y: number;
  lichen: boolean;
}

/** "teja-N": tejado de tejas árabes (canales y cobijas) del color dado. */
export function roofTileTexture(color: string, size = 96): string {
  const tileWidth = size / 8;
  const tileHeight = size / 4;
  const rng = seededRng(parseInt(color.slice(1), 16));
  const tileColors = Array.from({ length: 32 }, () => shade(color, (rng() - 0.5) * 0.26 + (rng() < 0.08 ? -0.12 : 0)));
  const marks = Array.from({ length: 32 }, (): TileMark | null =>
    rng() < 0.14 ? { y: 0.3 + rng() * 0.5, lichen: rng() < 0.5 } : null,
  );
  const defs =
    "<defs>" +
    linearGradient(
      "cv",
      [
        [0, "#ffffff", 0.32],
        [0.35, "#ffffff", 0.05],
        [0.7, "#000000", 0],
        [1, "#000000", 0.38],
      ],
      0,
      0,
      1,
      0,
    ) +
    linearGradient(
      "cc",
      [
        [0, "#000000", 0.4],
        [0.5, "#000000", 0.12],
        [1, "#ffffff", 0.12],
      ],
      0,
      0,
      1,
      0,
    ) +
    linearGradient("ao", [
      [0, "#000000", 0],
      [0.7, "#000000", 0],
      [1, "#000000", 0.35],
    ]) +
    "</defs>";
  let result = `<rect width="${size}" height="${size}" fill="${shade(color, -0.45)}"/>`;
  /** Una teja: `cover` = cobija (convexa, encima); si no, canal (cóncava, debajo). */
  const tile = (column: number, row: number, cover: boolean) => {
    const rowMod = ((row % 4) + 4) % 4;
    const x = column * tileWidth;
    const y = row * tileHeight + (cover ? 0 : tileHeight / 2);
    const width = cover ? tileWidth + 2 : tileWidth - 1.5;
    const left = cover ? x - 1 : x + 0.75;
    const baseColor = tileColors[column * 4 + rowMod];
    const fill = cover ? baseColor : shade(baseColor, -0.2);
    const path = `M${left} ${y + 3} Q${left + width / 2} ${y - 2.5} ${left + width} ${y + 3} L${left + width - (cover ? 0.6 : 0)} ${y + tileHeight + 2} L${left + (cover ? 0.6 : 0)} ${y + tileHeight + 2}Z`;
    let svg = `<path d="${path}" fill="${fill}"/>`;
    svg += `<path d="${path}" fill="url(#${cover ? "cv" : "cc"})"/>`;
    svg += `<path d="${path}" fill="url(#ao)"/>`;
    svg += `<path d="${path}" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="1"/>`;
    svg += `<path d="M${left + 1.5} ${y + 2.6} Q${left + width / 2} ${y - 1.4} ${left + width - 1.5} ${y + 2.6}" stroke="#ffffff" stroke-opacity="${cover ? 0.38 : 0.18}" stroke-width="1" fill="none"/>`;
    const mark = marks[column * 4 + rowMod];
    if (mark && cover) {
      const my = y + tileHeight * mark.y;
      const mx = left + width * 0.45;
      svg += mark.lichen
        ? `<circle cx="${mx}" cy="${my}" r="1.6" fill="#d9b64a" fill-opacity="0.85"/><circle cx="${mx + 2}" cy="${my + 2.2}" r="1" fill="#e2c86a" fill-opacity="0.8"/><circle cx="${mx - 1.5}" cy="${my + 3}" r="0.8" fill="#cfd0b0" fill-opacity="0.8"/>`
        : `<path d="${smoothPath(wobble(ellipsePts(mx, my, 2.6, 1.8, 7), 1, column * 9 + rowMod))}" fill="#6f7f38"/><circle cx="${mx - 0.8}" cy="${my - 0.6}" r="0.8" fill="#9aae52"/>`;
    }
    return svg;
  };
  for (let row = -1; row <= 4; row++) for (let column = 1; column < 8; column += 2) result += tile(column, row, false);
  for (let row = -1; row <= 4; row++) for (let column = 0; column < 8; column += 2) result += tile(column, row, true);
  return svgDoc(size, size, defs + result);
}

/** "suelo-asfalto": asfalto con parches, alcantarillas, grietas, charco y gravilla. */
export function asphaltTexture(size = 256): string {
  const rng = seededRng(77);
  const blotches = Array.from({ length: 7 }, () => ({
    x: rng() * size,
    y: rng() * size,
    rx: 14 + rng() * 22,
    ry: 8 + rng() * 12,
  }));
  const gravel: { x: number; y: number; s: number; c: string }[] = [];
  for (const blotch of blotches) {
    for (let i = 0; i < 26; i++) {
      const angle = rng() * Math.PI * 2;
      const distance = Math.sqrt(rng());
      gravel.push({
        x: blotch.x + Math.cos(angle) * blotch.rx * distance,
        y: blotch.y + Math.sin(angle) * blotch.ry * distance,
        s: 0.5 + rng() * 0.9,
        c: rng() < 0.55 ? "#77716a" : rng() < 0.7 ? "#8d877e" : "#2e2a27",
      });
    }
  }
  const patches = [
    { x: size * 0.08, y: size * 0.18, w: 54, h: 30 },
    { x: size * 0.58, y: size * 0.62, w: 40, h: 48 },
  ];
  const tarLines = Array.from({ length: 3 }, (_, i) => {
    let x = rng() * size;
    let y = rng() * size;
    let heading = rng() * Math.PI;
    const pts: Point[] = [[x, y]];
    for (let step = 0; step < 7; step++) {
      heading += (rng() - 0.5) * 0.8;
      x += Math.cos(heading) * 12;
      y += Math.sin(heading) * 12;
      pts.push([x, y]);
    }
    return { pts, i };
  });
  const crack = { x: size * 0.72, y: size * 0.2 };
  const details = seamlessTile(
    size,
    size,
    (dx, dy) =>
      blotches
        .map(
          (blotch, i) =>
            `<path d="${smoothPath(wobble(ellipsePts(blotch.x + dx, blotch.y + dy, blotch.rx, blotch.ry, 9), 6, i + 3))}" fill="#4f4a45" fill-opacity="0.55"/>`,
        )
        .join("") +
      patches
        .map((patch, i) => {
          const corners: Point[] = [
            [patch.x + dx, patch.y + dy],
            [patch.x + dx + patch.w, patch.y + dy + 1],
            [patch.x + dx + patch.w - 1, patch.y + dy + patch.h],
            [patch.x + dx + 1, patch.y + dy + patch.h - 1],
          ];
          return (
            inkShape(corners, i ? "#3b3734" : "#403c38", { seed: i + 4, amp: 1.2, ink: 2, inkColor: "#24201d" }) +
            `<path d="M${patch.x + dx + 2} ${patch.y + dy + 1.5} H${patch.x + dx + patch.w - 2}" stroke="#6a645d" stroke-opacity="0.6" stroke-width="0.9"/>`
          );
        })
        .join("") +
      jitterLine(crack.x + dx, crack.y + dy, 30, 0.3, "#25211e", 1.2, 404) +
      jitterLine(crack.x + dx + 4, crack.y + dy + 6, 20, 2.6, "#25211e", 1, 405) +
      // Charco con reflejo.
      `<ellipse cx="${size * 0.3 + dx}" cy="${size * 0.82 + dy}" rx="13" ry="8" fill="#2a2725" fill-opacity="0.55"/><ellipse cx="${size * 0.3 - 3 + dx}" cy="${size * 0.82 - 2 + dy}" rx="5" ry="2.4" fill="#6a6a78" fill-opacity="0.18"/>` +
      tarLines
        .map((line) => {
          const pts = line.pts.map(([px, py]): Point => [px + dx, py + dy]);
          const path = smoothPath(wobble(pts, 2, line.i, false, 6), false);
          return `<path d="${path}" stroke="#1d1a18" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="${path}" stroke="#5a5652" stroke-opacity="0.45" stroke-width="0.8" fill="none" transform="translate(-0.8 -0.8)"/>`;
        })
        .join("") +
      gravel
        .map(
          (stone) =>
            `<circle cx="${(stone.x + dx).toFixed(1)}" cy="${(stone.y + dy).toFixed(1)}" r="${stone.s.toFixed(2)}" fill="${stone.c}"/>`,
        )
        .join(""),
  );
  return svgDoc(
    size,
    size,
    `<rect width="${size}" height="${size}" fill="#45413d"/>` +
      seamlessTile(size, size, (dx, dy) => speckles(dx, dy, size, size, 12, ["#4a4541", "#403c39"], 24, 50, 0.6, 31)) +
      details,
  );
}

/** "suelo-acera": baldosas de botones (8×8) con alguna lisa, grietas y desconchones. */
export function sidewalkTexture(size = 128): string {
  const cell = size / 8;
  const rng = seededRng(19);
  const colors = ["#a39c90", "#9b9488", "#aaa397", "#968f83", "#a09787"];
  let result = "";
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 8; row++) {
      const x = col * cell;
      const y = row * cell;
      const plain = rng() < 0.05;
      const fill = plain ? "#b5a58a" : colors[Math.floor(rng() * colors.length)];
      result += `<rect x="${x + 0.8}" y="${y + 0.8}" width="${cell - 1.6}" height="${cell - 1.6}" fill="${fill}"/>`;
      result += `<path d="M${x + 1} ${y + cell - 1.2} V${y + 1} H${x + cell - 1.2}" stroke="#ffffff" stroke-opacity="0.22" stroke-width="0.9" fill="none"/>`;
      if (!plain) {
        // Botones en relieve 3×3.
        for (let bx = 0; bx < 3; bx++) {
          for (let by = 0; by < 3; by++) {
            const cx = x + cell * (0.25 + bx * 0.25);
            const cy = y + cell * (0.25 + by * 0.25);
            result += `<circle cx="${cx + 0.4}" cy="${cy + 0.4}" r="${cell * 0.075}" fill="#000000" fill-opacity="0.16"/><circle cx="${cx}" cy="${cy}" r="${cell * 0.07}" fill="${shade(fill, 0.07)}"/>`;
          }
        }
      }
      if (rng() < 0.08) {
        result += `<path d="M${x + 2} ${y + 3} L${x + cell * 0.5} ${y + cell * 0.55} L${x + cell - 2} ${y + cell - 4}" stroke="#5f584e" stroke-width="0.8" fill="none"/>`;
      }
      if (rng() < 0.12) result += `<path d="M${x + cell - 1} ${y + 1} l-3.5 0 l3.5 3.5Z" fill="#6d665c"/>`;
      if (rng() < 0.06) {
        result += `<circle cx="${x + cell * rng()}" cy="${y + cell * rng()}" r="1.3" fill="#5a544c" fill-opacity="0.6"/>`;
      }
    }
  }
  return svgDoc(size, size, `<rect width="${size}" height="${size}" fill="#625b52"/>${result}`);
}
