/**
 * Dibujos (SVG con trazo de tinta) y fondos de canvas de los minijuegos de las misiones.
 * Los trazos "temblorosos" usan generadores con semilla: el resultado es siempre el mismo.
 */
import { INK, ellipsePts, hatching, inkShape, inkStroke, rectPts, seededRng, shade, smoothPath, speckles, wobble } from "./svg";

/** Envuelve el contenido en un <svg> de escena (clase mg-scene) que se ajusta al hueco. */
const sceneSvg = (width: number, height: number, content: string, className = "") =>
  `<svg class="mg-scene ${className}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${content}</svg>`;

/** Rezar: estatua del Sagrado Corazón y una vela que se enciende (clases mg-halo, mg-glow, mg-flame). */
export function prayScene(): string {
  let svg =
    '<defs><radialGradient id="halo"><stop offset="0" stop-color="#ffd98a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>';
  svg += '<rect width="360" height="220" fill="#1f1a24"/>';
  svg += speckles(0, 0, 360, 220, 10, ["#2a2330", "#191520"], 30, 70, 0.7, 4);
  // Pedestal y estatua
  svg += inkShape([[130, 214], [230, 214], [222, 176], [138, 176]], "#8a7b62", { seed: 1, amp: 1, ink: 2.6 });
  svg += inkShape([[146, 176], [214, 176], [206, 150], [154, 150]], "#a99a7e", { seed: 2, amp: 1, ink: 2.4 });
  svg += inkShape([[166, 150], [194, 150], [190, 84], [185, 64], [175, 64], [170, 84]], "#e8e2d2", { seed: 3, amp: 1, ink: 2.6 });
  svg += inkShape([[118, 78], [172, 68], [188, 68], [242, 78], [240, 86], [188, 80], [172, 80], [120, 86]], "#e8e2d2", { seed: 4, amp: 0.8, ink: 2.4 });
  svg += `<circle cx="180" cy="52" r="12" fill="#e8e2d2" stroke="${INK}" stroke-width="2.4"/>`;
  svg += '<circle class="mg-halo" cx="180" cy="50" r="20" fill="none" stroke="#e2bd52" stroke-width="3"/>';
  svg += inkStroke([[174, 96], [178, 146]], 1.2, "#bdb4a0", 5, 0.6) + inkStroke([[186, 96], [184, 146]], 1.2, "#bdb4a0", 6, 0.6);
  // Vela
  svg += '<circle class="mg-glow" cx="280" cy="168" r="60" fill="url(#halo)" opacity="0"/>';
  svg += inkShape(rectPts(271, 170, 18, 42), "#efe6d2", { seed: 7, amp: 0.6, ink: 2.2 });
  svg += inkStroke([[280, 170], [280, 162]], 1.6, INK, 8, 0.1);
  svg += `<path class="mg-flame" d="M280 140 q9 12 0 22 q-9 -10 0 -22Z" fill="#ffb347" stroke="${INK}" stroke-width="1.6" opacity="0.15"/>`;
  svg += inkShape([[262, 212], [298, 212], [296, 216], [264, 216]], "#6b4a2e", { seed: 9, amp: 0.3, ink: 1.6 });
  return sceneSvg(360, 220, svg);
}

/** Lector de tarjetas del tren. */
export function cardReaderScene(): string {
  let svg = '<rect width="360" height="120" rx="14" fill="#3a3f45"/>';
  svg += inkShape(rectPts(6, 6, 348, 108), "#4c535a", { seed: 1, amp: 1, ink: 2.6 });
  svg += inkShape(rectPts(18, 50, 324, 22), "#1f2226", { seed: 2, amp: 0.6, ink: 2.4 });
  svg += '<rect x="22" y="58" width="316" height="6" fill="#0d0f11"/>';
  svg +=
    inkShape(rectPts(260, 14, 82, 26), "#1d3a2a", { seed: 3, amp: 0.5, ink: 2 }) +
    '<text x="301" y="32" font-family="Nunito,sans-serif" font-size="12" font-weight="800" fill="#7fe0a0" text-anchor="middle">PASE</text>';
  svg += `<circle cx="30" cy="27" r="7" fill="#c4483f" stroke="${INK}" stroke-width="2"/><circle cx="52" cy="27" r="7" fill="#3a5a3a" stroke="${INK}" stroke-width="2" class="mg-led"/>`;
  svg += hatching(10, 80, 340, 30, 6, INK, 0.18, 4);
  return sceneSvg(360, 120, svg, "mg-reader");
}

/** Tarjeta del tren (se arrastra por el lector). */
export function trainCardSvg(): string {
  let svg = inkShape(rectPts(2, 2, 96, 62), "#e2a33a", { seed: 11, amp: 0.8, ink: 2.4 });
  svg += inkShape(rectPts(2, 40, 96, 10), "#2a1c14", { seed: 12, amp: 0.3, ink: 0 });
  svg +=
    '<text x="10" y="22" font-family="Nunito,sans-serif" font-size="11" font-weight="900" fill="#2a1c14">TREN</text><text x="10" y="34" font-family="Nunito,sans-serif" font-size="8" font-weight="700" fill="#4a3424">La Roda \xB7 Sevilla</text>';
  svg += `<path d="M70 14 l14 0 l-4 10 l-10 0Z" fill="#c4483f" stroke="${INK}" stroke-width="1.2"/><circle cx="73" cy="27" r="2.4" fill="${INK}"/><circle cx="82" cy="27" r="2.4" fill="${INK}"/>`;
  return `<svg viewBox="0 0 100 66" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

/** Portería con red, grada y campo (penaltis). */
export function goalScene(): string {
  let svg = '<rect width="360" height="230" fill="#4f8c45"/>';
  for (let i = 0; i < 6; i++) svg += `<rect x="0" y="${130 + i * 20}" width="360" height="10" fill="#5a9a4f"/>`;
  svg +=
    '<rect width="360" height="70" fill="#3a3442"/>' + speckles(0, 0, 360, 60, 26, ["#c4483f", "#e2a33a", "#ece8de", "#3d5f8c"], 3, 6, 0.8, 8);
  svg += '<rect y="62" width="360" height="12" fill="#2a1c14"/>';
  const left = 50;
  const right = 310;
  const top = 64;
  const bottom = 168;
  svg += `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="#e9e4d6" fill-opacity="0.12"/>`;
  // Red
  let net = "";
  for (let x = left + 10; x < right; x += 12) net += `M${x} ${top} L${x + 4} ${bottom}`;
  for (let y = top + 10; y < bottom; y += 11) net += `M${left} ${y} L${right} ${y + 2}`;
  svg += `<path d="${net}" stroke="#f3ead6" stroke-opacity="0.5" stroke-width="1"/>`;
  // Postes y larguero
  svg += inkShape(
    [[left - 6, bottom + 2], [left - 6, top - 6], [right + 6, top - 6], [right + 6, bottom + 2], [right, bottom + 2], [right, top], [left, top], [left, bottom + 2]],
    "#f6f3ea",
    { seed: 3, amp: 0.6, ink: 2.6 },
  );
  // Líneas del área y punto de penalti
  svg +=
    inkStroke([[10, 168], [350, 168]], 2.5, "#f3ead6", 4, 0.5) +
    inkStroke([[30, 168], [10, 228]], 2.5, "#f3ead6", 5, 0.5) +
    inkStroke([[330, 168], [350, 228]], 2.5, "#f3ead6", 6, 0.5);
  svg += '<ellipse cx="180" cy="214" rx="5" ry="2.4" fill="#f3ead6"/>';
  return sceneSvg(360, 230, svg, "mg-pitch");
}

/** Portero con los brazos abiertos. */
export function goalkeeperSvg(): string {
  let svg = `<ellipse cx="40" cy="98" rx="24" ry="5" fill="${INK}" fill-opacity="0.3"/>`;
  svg += inkStroke([[30, 70], [24, 96]], 7, "#2c2b33", 1, 0.4) + inkStroke([[50, 70], [56, 96]], 7, "#2c2b33", 2, 0.4);
  svg += inkShape([[22, 40], [58, 40], [62, 72], [18, 72]], "#e2a33a", { seed: 3, amp: 1, ink: 2.4, smooth: true });
  svg += `<text x="40" y="64" font-family="Nunito,sans-serif" font-size="14" font-weight="900" fill="${INK}" text-anchor="middle">1</text>`;
  svg += inkStroke([[22, 44], [4, 26]], 7, "#e2a33a", 4, 0.4) + inkStroke([[58, 44], [76, 26]], 7, "#e2a33a", 5, 0.4);
  svg += `<circle cx="4" cy="24" r="7" fill="#7fb069" stroke="${INK}" stroke-width="2"/><circle cx="76" cy="24" r="7" fill="#7fb069" stroke="${INK}" stroke-width="2"/>`;
  svg += `<circle cx="40" cy="26" r="13" fill="#e2b48c" stroke="${INK}" stroke-width="2.4"/>`;
  svg += `<path d="M27 22 q13 -14 26 0 q-13 -6 -26 0Z" fill="#3b2a20" stroke="${INK}" stroke-width="1.6"/>`;
  svg += `<circle cx="35" cy="26" r="1.8" fill="${INK}"/><circle cx="45" cy="26" r="1.8" fill="${INK}"/><path d="M35 33 q5 3 10 0" stroke="${INK}" stroke-width="1.6" fill="none"/>`;
  return `<svg viewBox="0 0 80 104" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

/** Balón de fútbol. */
export function footballSvg(): string {
  return `<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="13" fill="#f6f3ea" stroke="${INK}" stroke-width="2.2"/><path d="M15 8 l6 4 -2 7 -8 0 -2 -7Z" fill="${INK}"/><path d="M15 8 V3 M21 12 L27 10 M19 19 L22 25 M11 19 L8 25 M9 12 L3 10" stroke="${INK}" stroke-width="1.6"/></svg>`;
}

export interface TobaccoBrand {
  name: string;
  color: string;
  /** Color de la franja. */
  band: string;
}

/** Marcas (inventadas) del expositor del estanco. */
export const TOBACCO_BRANDS: TobaccoBrand[] = [
  { name: "Giralda", color: "#c8322c", band: "#f3ead6" },
  { name: "Sol de Sevilla", color: "#e2a312", band: "#7a3a26" },
  { name: "Campi\xF1a", color: "#3d7a3a", band: "#f3ead6" },
  { name: "Olivar", color: "#6b7b2c", band: "#e9dcc0" },
  { name: "Guadalquivir", color: "#2d5f9a", band: "#e9dcc0" },
  { name: "La Roda", color: "#7a3fa0", band: "#e2a33a" },
  { name: "Feria", color: "#d4589a", band: "#f3ead6" },
  { name: "Albero", color: "#c98a2e", band: "#2a1c14" },
  { name: "Cal Blanca", color: "#e9e4d6", band: "#3d5f8c" },
];

/** Paquete de tabaco de una marca; `open` lo dibuja abierto, con los cigarrillos asomando. */
export function tobaccoPackSvg(brand: TobaccoBrand, seed: number, open = false): string {
  let svg = `<ellipse cx="30" cy="94" rx="24" ry="4" fill="${INK}" fill-opacity="0.3"/>`;
  if (open) {
    for (let i = 0; i < 5; i++) {
      svg +=
        inkShape(rectPts(12 + i * 7, 6, 6, 18), "#f6f3ea", { seed: seed + i, amp: 0.2, ink: 1.2 }) +
        `<rect x="${12 + i * 7}" y="16" width="6" height="8" fill="#d99a4e"/>`;
    }
  }
  svg += inkShape([[8, 20], [52, 20], [52, 92], [8, 92]], brand.color, { seed, amp: 0.8, ink: 2.4 });
  svg += inkShape([[8, 20], [52, 20], [52, 34], [8, 34]], shade(brand.color, -0.15), { seed: seed + 9, amp: 0.4, ink: 2 });
  svg += inkShape(rectPts(8, 48, 44, 16), brand.band, { seed: seed + 3, amp: 0.4, ink: 1.4 });
  svg += `<text x="30" y="${brand.name.length > 8 ? 59 : 60}" font-family="Rye,Georgia,serif" font-size="${brand.name.length > 9 ? 6.5 : 8.5}" fill="${shade(brand.color, -0.45)}" text-anchor="middle">${brand.name}</text>`;
  svg +=
    inkShape(rectPts(12, 72, 36, 14), "#f3ead6", { seed: seed + 5, amp: 0.3, ink: 1 }) +
    `<path d="M15 77 h30 M15 81 h22" stroke="${INK}" stroke-width="1.2"/>`;
  svg += '<path d="M12 24 L12 88" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3"/>';
  return `<svg viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

/** Moneda de euro (valor en céntimos: 10, 20, 50, 100 o 200). */
export function coinSvg(cents: number): string {
  const isGoldCent = cents >= 10 && cents < 100;
  const isTwoEuro = cents === 200;
  const isOneEuro = cents === 100;
  const outer = isTwoEuro ? "#c9b98a" : isOneEuro || isGoldCent ? "#d9b25a" : "#b8743a";
  const inner = isTwoEuro ? "#d9b25a" : isOneEuro ? "#c9c3b4" : outer;
  const label = cents >= 100 ? `${cents / 100}€` : `${cents}`;
  return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="31" r="27" fill="${INK}" opacity="0.35"/><circle cx="30" cy="29" r="27" fill="${outer}" stroke="${INK}" stroke-width="2.4"/><circle cx="30" cy="29" r="19" fill="${inner}" stroke="${shade(outer, -0.35)}" stroke-width="1.6"/><text x="30" y="35" font-family="Nunito,sans-serif" font-size="${cents >= 100 ? 15 : 17}" font-weight="900" fill="${INK}" text-anchor="middle">${label}</text><path d="M14 18 q8 -8 18 -9" stroke="#fff" stroke-opacity="0.45" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}

/** Mostrador del estanco con la caja registradora (el texto .mg-display muestra lo cobrado). */
export function tillScene(): string {
  let svg = '<rect width="360" height="90" fill="#3a2a20"/>';
  svg += inkShape(rectPts(4, 30, 352, 56), "#6b4a2e", { seed: 2, amp: 1, ink: 2.6 });
  svg += hatching(8, 34, 344, 48, 9, INK, 0.25, 3);
  svg += inkShape(rectPts(230, 6, 110, 60), "#4a4f55", { seed: 4, amp: 0.8, ink: 2.4 });
  svg += inkShape(rectPts(244, 14, 82, 20), "#1d3a2a", { seed: 5, amp: 0.4, ink: 1.8 });
  svg +=
    '<text class="mg-display" x="285" y="29" font-family="Nunito,sans-serif" font-size="13" font-weight="900" fill="#7fe0a0" text-anchor="middle">0,00 €</text>';
  for (let i = 0; i < 4; i++) svg += inkShape(rectPts(244 + i * 21, 40, 16, 10), "#d8cdb4", { seed: 6 + i, amp: 0.3, ink: 1.2 });
  return sceneSvg(360, 90, svg, "mg-counter");
}

/**
 * Barra del bar para preparar el cubata: estanterías con botellas, cubitera, vaso
 * (rectángulos .mg-liquid-ron / .mg-liquid-cola, grupo .mg-ice, marcas) y las dos botellas.
 */
export function barScene(): string {
  let svg = '<rect width="360" height="240" fill="#2a2024"/>';
  svg +=
    inkShape(rectPts(10, 20, 340, 8), "#6b4a2e", { seed: 1, amp: 0.5, ink: 2 }) +
    inkShape(rectPts(10, 78, 340, 8), "#6b4a2e", { seed: 2, amp: 0.5, ink: 2 });
  // Botellas de la estantería (colores con semilla fija)
  const rng = seededRng(4);
  for (let i = 0; i < 12; i++) {
    const x = 20 + i * 28;
    const color = ["#7a3a26", "#3d7a3a", "#c79a32", "#e9e4d6", "#3d5f8c"][Math.floor(rng() * 5)];
    svg += inkShape(
      [[x, 78], [x + 18, 78], [x + 18, 48], [x + 13, 40], [x + 13, 30], [x + 5, 30], [x + 5, 40], [x, 48]],
      color,
      { seed: 10 + i, amp: 0.4, ink: 1.8 },
    );
    svg += `<rect x="${x + 3}" y="56" width="12" height="9" fill="#f3ead6" opacity="0.8"/>`;
  }
  // Mostrador y cubitera con hielo
  svg += inkShape(rectPts(0, 196, 360, 44), "#5e3a22", { seed: 3, amp: 1, ink: 2.6 }) + hatching(4, 200, 352, 36, 10, INK, 0.25, 5);
  svg += inkShape([[24, 196], [76, 196], [70, 160], [30, 160]], "#b9c2c8", { seed: 5, amp: 0.6, ink: 2.4 });
  for (let i = 0; i < 5; i++) svg += inkShape(rectPts(32 + i * 7, 150 + (i % 2) * 5, 9, 9), "#e6f2f6", { seed: 20 + i, amp: 0.6, ink: 1.4 });
  // Vaso: líquidos, hielo, chorros, cristal y marcas
  svg +=
    '<g class="mg-glass"><rect class="mg-liquid-cola" x="152" y="196" width="56" height="0" fill="#5a2a14"/><rect class="mg-liquid-ron" x="152" y="196" width="56" height="0" fill="#c98a2e"/>';
  svg += '<g class="mg-ice"></g>';
  svg += '<path class="mg-stream mg-stream-ron" d="M190 104 Q186 150 184 196" stroke="#c98a2e" stroke-width="5" fill="none" stroke-linecap="round"/>';
  svg += '<path class="mg-stream mg-stream-cola" d="M190 104 Q186 150 184 196" stroke="#5a2a14" stroke-width="6" fill="none" stroke-linecap="round"/>';
  svg += '<path d="M146 88 L214 88 L210 198 L150 198Z" fill="#cfe6ee" fill-opacity="0.1" stroke="#e9f4f7" stroke-opacity="0.9" stroke-width="2"/>';
  svg += `<path d="M146 88 L214 88 L210 198 L150 198Z" fill="none" stroke="${INK}" stroke-width="3.4" stroke-opacity="0.6" transform="translate(1.5 1.5)"/>`;
  svg += '<ellipse cx="180" cy="88" rx="34" ry="5" fill="#e9f4f7" fill-opacity="0.25" stroke="#e9f4f7" stroke-width="2"/>';
  svg += '<path d="M151 190 L209 190 L210 198 L150 198Z" fill="#cfe6ee" fill-opacity="0.45" stroke="#e9f4f7" stroke-width="1.6"/>';
  svg +=
    '<path d="M156 96 L154 186" stroke="#fff" stroke-opacity="0.55" stroke-width="4" stroke-linecap="round"/><path d="M164 96 L163 130" stroke="#fff" stroke-opacity="0.3" stroke-width="2" stroke-linecap="round"/>';
  svg +=
    '<path class="mg-mark mg-mark-ron" d="M140 170 h10" stroke="#e2a33a" stroke-width="3"/><path class="mg-mark mg-mark-cola" d="M140 112 h10" stroke="#e2a33a" stroke-width="3"/></g>';
  // Botellas de ron y de cola
  svg += `<g class="mg-bottle-ron">${inkShape([[262, 196], [292, 196], [292, 130], [284, 116], [284, 96], [270, 96], [270, 116], [262, 130]], "#7a3a26", { seed: 30, amp: 0.5, ink: 2.4 })}<rect x="266" y="146" width="22" height="20" fill="#e9dcc0" stroke="${INK}" stroke-width="1.4"/><text x="277" y="160" font-family="Rye,serif" font-size="7" fill="#7a3a26" text-anchor="middle">RON</text></g>`;
  svg += `<g class="mg-bottle-cola">${inkShape([[308, 196], [338, 196], [338, 140], [330, 126], [330, 104], [316, 104], [316, 126], [308, 140]], "#3b1d12", { seed: 31, amp: 0.5, ink: 2.4 })}<rect x="310" y="152" width="26" height="16" fill="#c4483f" stroke="${INK}" stroke-width="1.4"/><text x="323" y="163" font-family="Nunito,sans-serif" font-weight="900" font-size="6.5" fill="#f3ead6" text-anchor="middle">COLA</text></g>`;
  return sceneSvg(360, 240, svg, "mg-bar-scene");
}

/** Un cubito de hielo (se añade dentro de .mg-ice). */
export function iceCubeShape(x: number, y: number, seed: number): string {
  return inkShape(rectPts(x, y, 16, 15), "#e6f2f6", { seed, amp: 1.2, ink: 1.6, opacity: 0.85 });
}

/** Barra del bar con el cliente al fondo (deslizar el cubata). */
export function barCounterScene(): string {
  let svg = '<rect width="360" height="120" fill="#2a2024"/>';
  svg += inkShape(rectPts(0, 60, 360, 60), "#5e3a22", { seed: 3, amp: 1, ink: 2.6 }) + hatching(4, 64, 352, 52, 10, INK, 0.25, 5);
  svg += inkShape([[330, 66], [352, 66], [356, 20], [326, 20]], "#3d5f8c", { seed: 6, amp: 0.6, ink: 2.4 });
  svg += `<circle cx="324" cy="58" r="8" fill="#e2b48c" stroke="${INK}" stroke-width="2"/>`;
  svg += '<path d="M300 66 h22" stroke="#e2a33a" stroke-width="3" stroke-dasharray="4 3"/>';
  return sceneSvg(360, 120, svg, "mg-reader");
}

/** Vaso de cubata (la "tarjeta" que se desliza por la barra). */
export function cubataGlassSvg(): string {
  return `<svg viewBox="0 0 50 70" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="22" width="30" height="44" fill="#5a2a14"/><rect x="13" y="16" width="10" height="9" fill="#e6f2f6" stroke="${INK}" stroke-width="1"/><rect x="24" y="20" width="10" height="9" fill="#e6f2f6" stroke="${INK}" stroke-width="1"/><path d="M6 6 L44 6 L41 68 L9 68Z" fill="#dfeef2" fill-opacity="0.2" stroke="${INK}" stroke-width="2.4"/><path d="M32 2 L28 30" stroke="#c4483f" stroke-width="3"/><circle cx="16" cy="10" r="5" fill="#e8d24a" stroke="${INK}" stroke-width="1.4"/></svg>`;
}

/** Estanque del Parque Europa. */
export function pondScene(): string {
  let svg = '<rect width="360" height="210" fill="#4f7536"/>' + speckles(0, 0, 360, 210, 12, ["#5f8a3e", "#45692f"], 20, 50, 0.7, 3);
  svg += `<path d="${smoothPath(wobble(ellipsePts(180, 105, 168, 92, 20), 4, 2))}" fill="#a99a7e" stroke="${INK}" stroke-width="3"/>`;
  svg += `<path d="${smoothPath(wobble(ellipsePts(180, 105, 152, 80, 20), 3, 3))}" fill="#2f6f86" stroke="${INK}" stroke-width="2.4"/>`;
  svg += speckles(40, 40, 280, 130, 8, ["#3f8aa2", "#2a6378"], 14, 36, 0.6, 5);
  // Nenúfares y una flor
  svg += `<g fill="#6fae4a" stroke="${INK}" stroke-width="1.6"><path d="M70 70 a16 12 0 1 0 14 -8 l-12 8Z"/><path d="M290 150 a14 10 0 1 0 12 -7 l-10 7Z"/><path d="M260 60 a12 9 0 1 0 10 -6 l-9 6Z"/></g><circle cx="76" cy="66" r="4" fill="#f0a0c0" stroke="${INK}" stroke-width="1"/>`;
  return sceneSvg(360, 210, svg, "mg-pond-scene");
}

/** Pez del color indicado. */
export function fishSvg(color: string): string {
  return `<svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg"><path d="M6 15 Q24 1 42 15 Q24 29 6 15Z" fill="${color}" stroke="${INK}" stroke-width="2"/><path d="M42 15 L56 5 L53 15 L56 25Z" fill="${color}" stroke="${INK}" stroke-width="2"/><circle cx="15" cy="13" r="2" fill="${INK}"/><path d="M24 8 q4 7 0 14" stroke="#fff" stroke-opacity="0.5" stroke-width="2" fill="none"/></svg>`;
}

/** Pista de baloncesto con canasta y balón (clases mg-bball / mg-bball-l). */
export function courtScene(): string {
  let svg = '<rect width="360" height="200" fill="#3a4a5a"/>' + speckles(0, 0, 360, 120, 8, ["#41546a", "#33424f"], 30, 60, 0.6, 3);
  svg += '<rect y="150" width="360" height="50" fill="#b85f38"/><path d="M0 160 h360" stroke="#f3ead6" stroke-width="3"/>';
  svg += inkShape(rectPts(172, 60, 10, 100), "#5a5550", { seed: 1, amp: 0.4, ink: 2.4 });
  svg += inkShape(rectPts(130, 14, 94, 62), "#f6f3ea", { seed: 2, amp: 0.6, ink: 2.6 });
  svg += inkShape(rectPts(160, 40, 34, 26), "none", { seed: 3, amp: 0.4, ink: 2.2, inkColor: "#c4483f" });
  svg += '<ellipse cx="177" cy="76" rx="22" ry="5" fill="none" stroke="#e2521f" stroke-width="3.4"/>';
  svg += '<path d="M156 77 L164 104 L190 104 L198 77 M163 90 h28 M168 77 l4 27 M186 77 l-4 27" stroke="#f3ead6" stroke-width="1.6" fill="none"/>';
  svg += `<circle class="mg-bball" cx="70" cy="150" r="13" fill="#d9772e" stroke="${INK}" stroke-width="2.2"/><path class="mg-bball-l" d="M57 150 h26 M70 137 v26" stroke="${INK}" stroke-width="1.4"/>`;
  return sceneSvg(360, 200, svg, "mg-court");
}

/** Suelo de la peluquería (damero de 8 columnas) en un canvas. */
export function drawSalonFloor(g: CanvasRenderingContext2D, width: number, height: number): void {
  const tile = width / 8;
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < Math.ceil(height / tile); row++) {
      g.fillStyle = (col + row) % 2 ? "#e9e2d0" : "#2a2a2e";
      g.fillRect(col * tile, row * tile, tile, tile);
    }
  }
  g.strokeStyle = "rgba(0,0,0,0.25)";
  g.lineWidth = 1;
  for (let col = 0; col <= 8; col++) g.strokeRect(col * tile, 0, 0.5, height);
}

/** Plato sobre el fregadero, en un canvas. */
export function drawPlate(g: CanvasRenderingContext2D, width: number, height: number): void {
  // Fregadero
  g.fillStyle = "#8a959c";
  g.fillRect(0, 0, width, height);
  g.fillStyle = "#6b757b";
  g.fillRect(8, 8, width - 16, height - 16);
  // Sombra y plato
  g.fillStyle = "#2a1c14";
  g.beginPath();
  g.ellipse(width / 2, height / 2 + 4, 104, 92, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f6f3ea";
  g.beginPath();
  g.ellipse(width / 2, height / 2, 102, 90, 0, 0, Math.PI * 2);
  g.fill();
  // Filete azul, borde y fondo
  g.strokeStyle = "#3d5f8c";
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(width / 2, height / 2, 90, 78, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "#2a1c14";
  g.lineWidth = 2.4;
  g.beginPath();
  g.ellipse(width / 2, height / 2, 102, 90, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "rgba(42,28,20,0.25)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(width / 2, height / 2, 58, 50, 0, 0, Math.PI * 2);
  g.stroke();
}

/** Bandeja de la farmacia para contar pastillas. */
export function pillTrayScene(): string {
  let svg = '<rect width="360" height="170" rx="16" fill="#2f6f5e"/>';
  svg += inkShape(rectPts(8, 8, 344, 154), "#3f8a74", { seed: 1, amp: 1, ink: 2.6 });
  svg += hatching(12, 12, 336, 146, 14, "#2a1c14", 0.12, 2);
  svg += inkShape([[300, 12], [348, 12], [348, 158], [300, 158]], "#2f6f5e", { seed: 2, amp: 0.6, ink: 2 });
  svg +=
    '<text x="324" y="92" font-family="Nunito,sans-serif" font-size="10" font-weight="900" fill="#9ed6c2" text-anchor="middle" transform="rotate(-90 324 88)">FARMACIA</text>';
  return sceneSvg(360, 170, svg, "mg-tray");
}

/** Pastilla: cápsula (índice par) o comprimido redondo (impar). */
export function pillSvg(index: number): string {
  return index % 2 === 0
    ? `<svg viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2 h10 v16 h-10 a8 8 0 0 1 0 -16Z" fill="#c4483f" stroke="${INK}" stroke-width="1.8"/><path d="M20 2 h10 a8 8 0 0 1 0 16 h-10Z" fill="#f3ead6" stroke="${INK}" stroke-width="1.8"/><path d="M8 6 h8" stroke="#fff" stroke-opacity="0.5" stroke-width="2"/></svg>`
    : `<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><circle cx="13" cy="13" r="10.5" fill="#f3ead6" stroke="${INK}" stroke-width="1.8"/><path d="M6 13 h14" stroke="${INK}" stroke-opacity="0.5" stroke-width="1.4"/><path d="M8 8 q3 -3 7 -3" stroke="#fff" stroke-width="2" fill="none"/></svg>`;
}

/** Asador de kebab con la carne (grupo .mg-meat, que se encoge al cortar). */
export function kebabScene(): string {
  let svg = '<rect width="360" height="230" fill="#3a2a20"/>';
  // Resistencias del asador
  svg += inkShape(rectPts(250, 10, 90, 210), "#8a3a26", { seed: 1, amp: 1, ink: 2.6 });
  for (let i = 0; i < 8; i++) {
    svg += `<rect x="262" y="${24 + i * 24}" width="66" height="10" rx="5" fill="#ff8a3a" opacity="${0.5 + (i % 2) * 0.3}"/>`;
  }
  // Espetón
  svg += inkShape(rectPts(176, 4, 8, 222), "#9aa3a8", { seed: 2, amp: 0.3, ink: 2 });
  // Capas de carne (anchura con semilla fija)
  let meat = "";
  const rng = seededRng(6);
  for (let i = 0; i < 9; i++) {
    const y = 22 + i * 20;
    const halfWidth = 70 - i * 3.2 + rng() * 5;
    meat += inkShape(
      [[180 - halfWidth, y], [180 + halfWidth * 0.9, y], [180 + halfWidth * 0.88, y + 21], [180 - halfWidth * 0.96, y + 21]],
      i % 2 ? "#9a5a32" : "#8a4a28",
      { seed: 10 + i, amp: 1.6, ink: 1.6 },
    );
    meat += inkStroke([[180 - halfWidth + 8, y + 9], [180 + halfWidth * 0.6, y + 11]], 1.6, "#c98a4e", 20 + i, 1.2, 0.8);
  }
  svg += `<g class="mg-meat">${meat}</g>`;
  // Bandeja
  svg += inkShape(rectPts(110, 206, 140, 14), "#9aa3a8", { seed: 3, amp: 0.4, ink: 2.2 });
  return sceneSvg(360, 230, svg, "mg-kebab-scene");
}

/** Cuchillo del kebab (sigue al dedo). */
export function knifeSvg(): string {
  return `<svg viewBox="0 0 30 110" xmlns="http://www.w3.org/2000/svg"><path d="M8 4 L22 4 L22 72 L15 84 L8 72Z" fill="#d8dde0" stroke="${INK}" stroke-width="2.2"/><path d="M11 10 L11 68" stroke="#fff" stroke-opacity="0.6" stroke-width="2"/><rect x="6" y="84" width="18" height="24" rx="4" fill="#3a2a20" stroke="${INK}" stroke-width="2.2" transform="rotate(180 15 96)"/></svg>`;
}
