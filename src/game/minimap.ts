import Phaser from "phaser";
import { SOURCE_SIZE, streetEdges, worldToTrace, type Vec2 } from "../../shared/map/townMap";

/**
 * Minimapa con las calles del trazado (en coordenadas del propio trazado, a escala).
 * Muestra al jugador y los lugares de sus misiones pendientes. Al tocarlo se amplía.
 */
export class Minimap {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private streets: Phaser.GameObjects.Graphics;
  private marks: Phaser.GameObjects.Graphics;
  private size = 150;
  private big = false;
  private me: Vec2 | null = null;
  private targets: Vec2[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.rectangle(0, 0, this.size, this.size, 0x15100c, 0.74).setOrigin(0).setStrokeStyle(1.5, 0xf3ead6, 0.16);
    this.streets = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.bg, this.streets, this.marks]).setDepth(9);
    this.bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.big = !this.big;
      this.redraw();
      scene.events.emit("minimap-resized");
    });
    this.redraw();
  }

  get width() {
    return this.big ? this.bigSize() : this.size;
  }

  private bigSize() {
    return Math.min(this.scene.scale.width - 32, this.scene.scale.height - 200, 520);
  }

  private scale() {
    return (this.width - 12) / Math.max(SOURCE_SIZE.width, SOURCE_SIZE.height);
  }

  private redraw() {
    const s = this.width;
    this.bg.setSize(s, s);
    this.bg.input?.hitArea.setSize(s, s);
    const k = this.scale();
    this.streets.clear().lineStyle(this.big ? 3 : 2, 0xcdbf9f, 0.9);
    for (const edge of streetEdges) {
      this.streets.beginPath();
      edge.points.forEach(([x, y], i) => {
        if (i) this.streets.lineTo(6 + x * k, 6 + y * k);
        else this.streets.moveTo(6 + x * k, 6 + y * k);
      });
      this.streets.strokePath();
    }
    this.drawMarks();
  }

  update(me: Vec2, targets: Vec2[]) {
    this.me = me;
    this.targets = targets;
    this.drawMarks();
  }

  private drawMarks() {
    const k = this.scale();
    const m = this.marks.clear();
    for (const t of this.targets) {
      const p = worldToTrace(t);
      m.fillStyle(0xf2b705, 1).fillCircle(6 + p.x * k, 6 + p.y * k, this.big ? 7 : 4);
    }
    if (this.me) {
      const p = worldToTrace(this.me);
      m.fillStyle(0xffffff, 1).fillCircle(6 + p.x * k, 6 + p.y * k, this.big ? 7 : 4);
      m.lineStyle(2, 0x15100c, 1).strokeCircle(6 + p.x * k, 6 + p.y * k, this.big ? 7 : 4);
    }
  }

  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
  }
}
