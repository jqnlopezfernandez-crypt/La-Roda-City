import { artCanvas } from "../art/runtime";

/**
 * Grabadora de dibujo con una API parecida a Phaser.Graphics: en vez de dibujar,
 * guarda cada operación con su caja envolvente. Después cada trozo del mapa
 * reproduce en un canvas 2D solo las operaciones que le tocan (`job`), repartido
 * en varios fotogramas para no dar tirones.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Matriz de transformación de un patrón [a, b, c, d, e, f]. */
export type PatternMatrix = number[];

/** Relleno: color CSS o textura del arte (repetida) con su transformación. */
export type FillPaint = { color: string } | { pattern: string; m?: PatternMatrix; a?: number };
/** Trazo: color CSS o textura del arte. */
export interface LinePaint {
  width: number;
  color: string | { pattern: string };
}

/** Convierte un relleno en un estilo del canvas (crea y guarda los patrones). */
export type PaintResolver = (paint: FillPaint) => string | CanvasPattern;
export type DrawFn = (ctx: CanvasRenderingContext2D, resolve: PaintResolver) => void;

interface DrawOp extends Box {
  draw: DrawFn;
}

interface ArcSegment {
  x: number;
  y: number;
  r: number;
  a0: number;
  a1: number;
  ccw: boolean | undefined;
}

/** Trabajo de dibujo de un trozo: `step` dibuja hasta agotar el presupuesto y dice si ha terminado. */
export interface DrawJob {
  total: number;
  step(budgetMs: number): boolean;
}

const rgba = (color: number, alpha = 1) => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;

export class DrawRecorder {
  ops: DrawOp[] = [];
  private fill: FillPaint = { color: "#000" };
  private line: LinePaint = { width: 1, color: "#000" };
  private path: ArcSegment[] = [];

  get size(): number {
    return this.ops.length;
  }

  /** Guarda una operación; los trazos ensanchan la caja medio grosor de línea. */
  add(box: Box, draw: DrawFn, isStroke = false): this {
    const pad = isStroke ? this.line.width / 2 + 1 : 1;
    this.ops.push({ x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad, draw });
    return this;
  }

  static boxOf(points: Point[]): Box {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    return { x0, y0, x1, y1 };
  }

  /** Envuelve un dibujo con el relleno activo en este momento. */
  withFill(draw: (ctx: CanvasRenderingContext2D) => void): DrawFn {
    const fill = this.fill;
    const alpha = "a" in fill && fill.a !== undefined ? fill.a : 1;
    return (ctx, resolve) => {
      ctx.fillStyle = resolve(fill);
      if (alpha !== 1) ctx.globalAlpha = alpha;
      draw(ctx);
      if (alpha !== 1) ctx.globalAlpha = 1;
    };
  }

  /** Envuelve un dibujo con el trazo activo en este momento. */
  withLine(draw: (ctx: CanvasRenderingContext2D) => void): DrawFn {
    const line = this.line;
    return (ctx, resolve) => {
      ctx.lineWidth = line.width;
      ctx.strokeStyle = typeof line.color == "string" ? line.color : resolve(line.color);
      draw(ctx);
    };
  }

  fillStyle(color: number, alpha = 1): this {
    this.fill = { color: rgba(color, alpha) };
    return this;
  }

  fillTexture(key: string, matrix?: PatternMatrix, alpha = 1): this {
    this.fill = { pattern: key, m: matrix, a: alpha };
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.line = { width, color: rgba(color, alpha) };
    return this;
  }

  lineTexture(width: number, key: string): this {
    this.line = { width, color: { pattern: key } };
    return this;
  }

  fillRect(x: number, y: number, w: number, h: number): this {
    return this.add({ x0: x, y0: y, x1: x + w, y1: y + h }, this.withFill((ctx) => ctx.fillRect(x, y, w, h)));
  }

  strokeRect(x: number, y: number, w: number, h: number): this {
    return this.add({ x0: x, y0: y, x1: x + w, y1: y + h }, this.withLine((ctx) => ctx.strokeRect(x, y, w, h)), true);
  }

  fillRoundedRect(x: number, y: number, w: number, h: number, radius: number): this {
    return this.add(
      { x0: x, y0: y, x1: x + w, y1: y + h },
      this.withFill((ctx) => {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.fill();
      }),
    );
  }

  fillCircle(x: number, y: number, r: number): this {
    return this.add(
      { x0: x - r, y0: y - r, x1: x + r, y1: y + r },
      this.withFill((ctx) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }),
    );
  }

  strokeCircle(x: number, y: number, r: number): this {
    return this.add(
      { x0: x - r, y0: y - r, x1: x + r, y1: y + r },
      this.withLine((ctx) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }),
      true,
    );
  }

  fillEllipse(x: number, y: number, w: number, h: number): this {
    return this.add(
      { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 },
      this.withFill((ctx) => {
        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }),
    );
  }

  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this {
    return this.fillPoints([
      { x: x0, y: y0 },
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ]);
  }

  /** `_closeShape` se acepta por compatibilidad con Phaser.Graphics (siempre se cierra). */
  fillPoints(points: Point[], _closeShape = true): this {
    const pts = points.map((p) => ({ x: p.x, y: p.y }));
    return this.add(
      DrawRecorder.boxOf(pts),
      this.withFill((ctx) => {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fill();
      }),
    );
  }

  /** `_closePath` se acepta por compatibilidad con Phaser.Graphics (no se usa). */
  strokePoints(points: Point[], closeShape = false, _closePath = false): this {
    const pts = points.map((p) => ({ x: p.x, y: p.y }));
    return this.add(
      DrawRecorder.boxOf(pts),
      this.withLine((ctx) => {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        if (closeShape) ctx.closePath();
        ctx.stroke();
      }),
      true,
    );
  }

  lineBetween(x0: number, y0: number, x1: number, y1: number): this {
    return this.add(
      DrawRecorder.boxOf([
        { x: x0, y: y0 },
        { x: x1, y: y1 },
      ]),
      this.withLine((ctx) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }),
      true,
    );
  }

  beginPath(): this {
    this.path = [];
    return this;
  }

  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): this {
    this.path.push({ x, y, r, a0, a1, ccw });
    return this;
  }

  /** Traza los arcos acumulados desde `beginPath`. */
  strokePath(): this {
    const segments = this.path;
    this.path = [];
    const box = DrawRecorder.boxOf(
      segments.flatMap((s) => [
        { x: s.x - s.r, y: s.y - s.r },
        { x: s.x + s.r, y: s.y + s.r },
      ]),
    );
    return this.add(
      box,
      this.withLine((ctx) => {
        ctx.beginPath();
        for (const s of segments) ctx.arc(s.x, s.y, s.r, s.a0, s.a1, s.ccw);
        ctx.stroke();
      }),
      true,
    );
  }

  /** Dibuja una imagen del arte con origen (ox, oy), opcionalmente volteada. */
  image(key: string, x: number, y: number, w: number, h: number, originX: number, originY: number, flipX = false, alpha = 1): this {
    const left = x - w * originX;
    const top = y - h * originY;
    return this.add({ x0: left, y0: top, x1: left + w, y1: top + h }, (ctx) => {
      const canvas = artCanvas(key);
      if (canvas) {
        ctx.globalAlpha = alpha;
        if (flipX) {
          ctx.save();
          ctx.translate(left + w, top);
          ctx.scale(-1, 1);
          ctx.drawImage(canvas, 0, 0, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(canvas, left, top, w, h);
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  /** Dibuja una imagen deformada en el paralelogramo a, b, (b + d - a), d (fachadas). */
  imageQuad(key: string, a: Point, b: Point, d: Point): this {
    const c = { x: b.x + d.x - a.x, y: b.y + d.y - a.y };
    return this.add(DrawRecorder.boxOf([a, b, c, d]), (ctx) => {
      const canvas = artCanvas(key);
      if (canvas) {
        ctx.save();
        ctx.transform(
          (b.x - a.x) / canvas.width,
          (b.y - a.y) / canvas.width,
          (d.x - a.x) / canvas.height,
          (d.y - a.y) / canvas.height,
          a.x,
          a.y,
        );
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
      }
    });
  }

  /**
   * Sombra difuminada de un polígono desplazado (dx, dy). El polígono se dibuja
   * muy lejos (10000 px) y solo su sombra cae en su sitio.
   */
  softShadow(points: Point[], blur: number, alpha: number, dx: number, dy: number): this {
    const pts = points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const box = DrawRecorder.boxOf(pts);
    return this.add({ x0: box.x0 - blur * 2, y0: box.y0 - blur * 2, x1: box.x1 + blur * 2, y1: box.y1 + blur * 2 }, (ctx) => {
      const transform = ctx.getTransform();
      ctx.save();
      ctx.shadowColor = `rgba(16,10,6,${alpha})`;
      ctx.shadowBlur = blur * transform.a;
      ctx.shadowOffsetX = 1e4 * transform.a;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x - 1e4, p.y) : ctx.moveTo(p.x - 1e4, p.y)));
      ctx.closePath();
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();
    });
  }

  /**
   * Bruma oscura en los bordes del mundo (w × h): degradado desde el borde hacia dentro en `band`
   * píxeles, para que el final del mapa se funda en niebla en lugar de cortarse.
   */
  edgeFade(w: number, h: number, band: number, color: number, alpha: number): this {
    const sides: [Box, number, number, number, number][] = [
      [{ x0: 0, y0: 0, x1: w, y1: band }, 0, 0, 0, band],
      [{ x0: 0, y0: h - band, x1: w, y1: h }, 0, h, 0, h - band],
      [{ x0: 0, y0: 0, x1: band, y1: h }, 0, 0, band, 0],
      [{ x0: w - band, y0: 0, x1: w, y1: h }, w, 0, w - band, 0],
    ];
    for (const [box, gx0, gy0, gx1, gy1] of sides) {
      this.add(box, (ctx) => {
        const gradient = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        gradient.addColorStop(0, rgba(color, alpha));
        gradient.addColorStop(0.18, rgba(color, alpha * 0.92));
        gradient.addColorStop(0.45, rgba(color, alpha * 0.55));
        gradient.addColorStop(0.75, rgba(color, alpha * 0.18));
        gradient.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      });
    }
    return this;
  }

  /** Halo radial de luz. */
  glow(x: number, y: number, r: number, color: number, alpha: number): this {
    return this.add({ x0: x - r, y0: y - r, x1: x + r, y1: y + r }, (ctx) => {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    });
  }

  /** Prepara el dibujo en `ctx` de las operaciones que tocan la caja `area`. */
  job(ctx: CanvasRenderingContext2D, area: Box): DrawJob {
    const ops = this.ops.filter((op) => !(op.x1 < area.x0 || op.x0 > area.x1 || op.y1 < area.y0 || op.y0 > area.y1));
    const patterns = new Map<string, CanvasPattern>();
    const resolve: PaintResolver = (paint) => {
      if ("color" in paint) return paint.color;
      const cacheKey = paint.pattern + (paint.m ? paint.m.join(",") : "");
      let pattern = patterns.get(cacheKey);
      if (!pattern) {
        const canvas = artCanvas(paint.pattern);
        if (!canvas) return "#777";
        pattern = ctx.createPattern(canvas, "repeat") as CanvasPattern;
        // Las texturas se hornean a otra escala: el patrón vuelve a su tamaño lógico
        const scale = (Number(canvas.dataset.w) || canvas.width) / canvas.width;
        const m = paint.m ?? [1, 0, 0, 1, 0, 0];
        pattern.setTransform(new DOMMatrix([m[0] * scale, m[1] * scale, m[2] * scale, m[3] * scale, m[4], m[5]]));
        patterns.set(cacheKey, pattern);
      }
      return pattern;
    };
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    let index = 0;
    return {
      total: ops.length,
      step(budgetMs) {
        const start = performance.now();
        while (index < ops.length) {
          ops[index++].draw(ctx, resolve);
          // Mira el reloj cada 8 operaciones
          if ((index & 7) === 0 && performance.now() - start > budgetMs) break;
        }
        return index >= ops.length;
      },
    };
  }
}
