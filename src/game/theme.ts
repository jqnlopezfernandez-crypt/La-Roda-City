import Phaser from "phaser";

/**
 * Estilo común de la interfaz dentro del lienzo: paneles oscuros semitransparentes
 * con borde claro, texto crema y acento dorado (a juego con las pantallas HTML).
 */
export const THEME = {
  font: "Nunito, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  title: "Rye, Georgia, serif",
  panel: 0x15100c,
  panelAlpha: 0.74,
  line: 0xf3ead6,
  lineAlpha: 0.14,
  text: "#f3ead6",
  muted: "#b9ad98",
  accent: 0xe2a33a,
  accentText: "#e8b452",
  danger: 0xb33a34,
  ok: 0x7fb069,
  radius: 14,
};

/** Recuadro redondeado (fondo + borde fino). Solo se redibuja si cambia de tamaño. */
export class Card extends Phaser.GameObjects.Graphics {
  w = 0;
  h = 0;
  radius: number;
  private fillColor_: number;
  private alpha_: number;

  constructor(scene: Phaser.Scene, radius = THEME.radius, fillColor = THEME.panel, alpha = THEME.panelAlpha) {
    super(scene);
    this.radius = radius;
    this.fillColor_ = fillColor;
    this.alpha_ = alpha;
    scene.add.existing(this);
  }

  setCardSize(w: number, h: number): this {
    if (w === this.w && h === this.h) return this;
    this.w = w;
    this.h = h;
    this.clear();
    this.fillStyle(this.fillColor_, this.alpha_).fillRoundedRect(0, 0, w, h, Math.min(this.radius, h / 2));
    this.lineStyle(1.5, THEME.line, THEME.lineAlpha).strokeRoundedRect(0.75, 0.75, w - 1.5, h - 1.5, Math.min(this.radius, h / 2));
    return this;
  }
}

/** Dibuja el círculo de fondo de un botón redondo (relleno y aro). */
export type RoundButtonDraw = (fill: number, fillAlpha: number, stroke: number, strokeAlpha: number) => void;

/** Botón redondo con un icono pintado encima. `draw` permite recolorearlo después. */
export function roundButton(
  scene: Phaser.Scene,
  radius: number,
  iconKey: string,
  stroke: number = THEME.line,
): { g: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Image; draw: RoundButtonDraw } {
  const g = scene.add.graphics();
  const draw: RoundButtonDraw = (fill, fillAlpha, strokeColor, strokeAlpha) => {
    g.clear();
    g.fillStyle(fill, fillAlpha).fillCircle(0, 0, radius);
    g.lineStyle(3, strokeColor, strokeAlpha).strokeCircle(0, 0, radius - 1.5);
  };
  draw(THEME.panel, THEME.panelAlpha, stroke, 0.35);
  // los iconos se pintan a 96 px
  const icon = scene.add.image(0, 0, iconKey).setScale((radius * 1.05) / 96);
  return { g, icon, draw };
}

export const FONT = THEME.font;
