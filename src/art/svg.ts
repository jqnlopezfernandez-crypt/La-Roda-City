// Utilidades para dibujar en SVG con aspecto de tinta a mano (trazos temblorosos,
// sombreados, motas). Todo es determinista: el azar sale de generadores con semilla.

export type Point = [number, number];
/** Parada de degradado: [desplazamiento, color, opacidad]. */
export type GradientStop = [number, string, number];

export const INK = "#2a1c14";

/** Generador pseudoaleatorio con semilla (devuelve números en [0, 1)). */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 1831565813) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Subdivide los lados del polígono (o polilínea si `closed` es false) en tramos de
 * unos `segmentLength` px y desplaza cada punto al azar hasta `amplitude` px.
 */
export function wobble(points: Point[], amplitude: number, seed: number, closed = true, segmentLength = 10): Point[] {
  const rng = seededRng(seed);
  const result: Point[] = [];
  const sideCount = closed ? points.length : points.length - 1;
  for (let i = 0; i < sideCount; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const length = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(length / segmentLength));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      // Los vértices originales tiemblan menos que los puntos intermedios.
      const factor = step === 0 ? 0.35 : 1;
      result.push([
        x0 + (x1 - x0) * t + (rng() - 0.5) * amplitude * factor,
        y0 + (y1 - y0) * t + (rng() - 0.5) * amplitude * factor,
      ]);
    }
  }
  if (!closed) {
    const last = points[points.length - 1];
    result.push([last[0] + (rng() - 0.5) * amplitude * 0.35, last[1] + (rng() - 0.5) * amplitude * 0.35]);
  }
  return result;
}

/** Redondea a una décima para acortar el SVG. */
const fmt = (value: number): string => (Math.round(value * 10) / 10).toString();

/** Camino suavizado con curvas cuadráticas que pasan por los puntos medios. */
export function smoothPath(points: Point[], closed = true): string {
  if (points.length < 3) return `M${points.map((point) => point.map(fmt).join(" ")).join(" L")}${closed ? "Z" : ""}`;
  const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const count = points.length;
  if (!closed) {
    let path = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
    for (let i = 1; i < count - 1; i++) {
      const mid = midpoint(points[i], points[i + 1]);
      path += ` Q${fmt(points[i][0])} ${fmt(points[i][1])} ${fmt(mid[0])} ${fmt(mid[1])}`;
    }
    return path + ` L${fmt(points[count - 1][0])} ${fmt(points[count - 1][1])}`;
  }
  const start = midpoint(points[count - 1], points[0]);
  let path = `M${fmt(start[0])} ${fmt(start[1])}`;
  for (let i = 0; i < count; i++) {
    const mid = midpoint(points[i], points[(i + 1) % count]);
    path += ` Q${fmt(points[i][0])} ${fmt(points[i][1])} ${fmt(mid[0])} ${fmt(mid[1])}`;
  }
  return path + "Z";
}

/** Camino de segmentos rectos. */
function polylinePath(points: Point[], closed = true): string {
  return `M${points.map((point) => `${fmt(point[0])} ${fmt(point[1])}`).join(" L")}${closed ? "Z" : ""}`;
}

export function rectPts(x: number, y: number, width: number, height: number): Point[] {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, count = 16): Point[] {
  return Array.from({ length: count }, (_, i): Point => [
    cx + Math.cos((i / count) * Math.PI * 2) * rx,
    cy + Math.sin((i / count) * Math.PI * 2) * ry,
  ]);
}

export interface InkShapeOptions {
  /** Amplitud del temblor (px). */
  amp?: number;
  seed?: number;
  /** Curvas suaves en vez de segmentos rectos. */
  smooth?: boolean;
  /** Grosor del contorno; 0 = sin contorno. */
  ink?: number;
  inkColor?: string;
  opacity?: number;
}

/** Forma rellena con contorno de tinta tembloroso. */
export function inkShape(points: Point[], fill: string, options: InkShapeOptions = {}): string {
  const wobbled = wobble(points, options.amp ?? 1.6, options.seed ?? 1);
  const path = options.smooth ? smoothPath(wobbled) : polylinePath(wobbled);
  const inkWidth = options.ink ?? 2.4;
  const opacityAttr = options.opacity !== undefined ? ` fill-opacity="${options.opacity}"` : "";
  const strokeAttrs =
    inkWidth > 0
      ? ` stroke="${options.inkColor ?? INK}" stroke-width="${inkWidth}" stroke-linejoin="round" stroke-linecap="round"`
      : "";
  return `<path d="${path}" fill="${fill}"${opacityAttr}${strokeAttrs}/>`;
}

/** Trazo abierto de tinta tembloroso. */
export function inkStroke(points: Point[], width: number, color = INK, seed = 3, amplitude = 1.2, opacity = 1): string {
  return `<path d="${smoothPath(wobble(points, amplitude, seed, false, 8), false)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${opacity < 1 ? ` stroke-opacity="${opacity}"` : ""}/>`;
}

/** Rayado diagonal recortado al rectángulo (x, y, width, height). */
export function hatching(
  x: number,
  y: number,
  width: number,
  height: number,
  spacing: number,
  color: string,
  opacity: number,
  seed = 5,
  slope = 1,
): string {
  const rng = seededRng(seed);
  let lines = "";
  for (let offset = -height; offset < width; offset += spacing) {
    const startX = x + offset + (rng() - 0.5) * 2;
    const bottom = y + height;
    const endX = startX + height * slope;
    const top = y;
    lines += `<line x1="${fmt(Math.max(x, startX))}" y1="${fmt(startX < x ? bottom - (x - startX) / slope : bottom)}" x2="${fmt(Math.min(x + width, endX))}" y2="${fmt(endX > x + width ? top + (endX - (x + width)) / slope : top)}"/>`;
  }
  return `<g stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.2" stroke-linecap="round">${lines}</g>`;
}

/** Manchas irregulares repartidas al azar por el rectángulo. */
export function speckles(
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  colors: string[],
  minRadius: number,
  maxRadius: number,
  opacity: number,
  seed = 9,
): string {
  const rng = seededRng(seed);
  let result = "";
  for (let i = 0; i < count; i++) {
    const cx = x + rng() * width;
    const cy = y + rng() * height;
    const rx = minRadius + rng() * (maxRadius - minRadius);
    const ry = rx * (0.5 + rng() * 0.6);
    result += `<path d="${smoothPath(wobble(ellipsePts(cx, cy, rx, ry, 9), rx * 0.35, i + seed))}" fill="${colors[i % colors.length]}" fill-opacity="${opacity}"/>`;
  }
  return result;
}

export function linearGradient(id: string, stops: GradientStop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</linearGradient>`;
}

export function radialGradient(id: string, stops: GradientStop[], cx = 0.5, cy = 0.5, r = 0.5): string {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join("")}</radialGradient>`;
}

/** Grieta: línea quebrada que cambia de rumbo al azar, con una rama a mitad. */
export function jitterLine(
  x: number,
  y: number,
  length: number,
  angle: number,
  color: string,
  width: number,
  seed: number,
  opacity = 1,
): string {
  const rng = seededRng(seed);
  const points: Point[] = [[x, y]];
  let px = x;
  let py = y;
  let heading = angle;
  const steps = Math.max(3, Math.round(length / 5));
  for (let i = 0; i < steps; i++) {
    heading += (rng() - 0.5) * 0.9;
    px += Math.cos(heading) * (length / steps);
    py += Math.sin(heading) * (length / steps);
    points.push([px, py]);
  }
  const branchStart = points[Math.floor(steps / 2)];
  const branchAngle = heading + (rng() < 0.5 ? 0.9 : -0.9);
  return `<path d="${smoothPath(points, false)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-opacity="${opacity}"/><path d="M${fmt(branchStart[0])} ${fmt(branchStart[1])} l${fmt(Math.cos(branchAngle) * length * 0.3)} ${fmt(Math.sin(branchAngle) * length * 0.3)}" fill="none" stroke="${color}" stroke-width="${width * 0.6}" stroke-linecap="round" stroke-opacity="${opacity}"/>`;
}

export function svgDoc(width: number, height: number, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Aclara (amount > 0, hacia blanco) u oscurece (amount < 0) un color "#rrggbb". */
export function shade(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `#${[(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map((channel) => Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}
