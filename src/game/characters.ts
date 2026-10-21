import { WalkAnimator, roenoMeta, type Pie, type Vista } from "./animation";
import Phaser from "phaser";

/**
 * Personaje del juego: sprite pintado "roeno" (una hoja de fotogramas por color),
 * sombra y nombre. La animación de andar la decide WalkAnimator; aquí se añaden
 * los gestos (giro, inclinación, respiración, celebración, caer al suelo).
 */

/** Aspecto de un jugador: color de camiseta, piel, pelo y colores del nombre. */
export interface CharacterLook {
  label: string;
  shirt: number;
  hair: number;
  skin: number;
  /** Color del nombre (CSS). */
  name: string;
  /** Borde del nombre (CSS). */
  nameStroke: string;
}

/** Evento "paso" que emite Character cada vez que pisa un pie. */
export interface PasoEvent {
  pie: Pie;
}

const HAIR = 0xdad5c9;
const NAME_STROKE = "#1b1b1b";

export const PALETTE: CharacterLook[] = [
  { label: "Blanco", shirt: 0xece8de, hair: HAIR, skin: 0xe6b88f, name: "#ffffff", nameStroke: NAME_STROKE },
  { label: "Azul", shirt: 0x3d5f8c, hair: HAIR, skin: 0xdcab82, name: "#5c97ff", nameStroke: NAME_STROKE },
  { label: "Verde", shirt: 0x4f7a45, hair: HAIR, skin: 0xe9c09a, name: "#4fd06d", nameStroke: NAME_STROKE },
  { label: "Rojo", shirt: 0x8e3631, hair: HAIR, skin: 0xd8a47c, name: "#ff5a61", nameStroke: NAME_STROKE },
  { label: "Amarillo", shirt: 0xc39434, hair: HAIR, skin: 0xe6b88f, name: "#ffd23f", nameStroke: NAME_STROKE },
  { label: "Morado", shirt: 0x6a4282, hair: HAIR, skin: 0xc99670, name: "#b07dff", nameStroke: NAME_STROKE },
  { label: "Gris", shirt: 0x77736e, hair: HAIR, skin: 0xe9c09a, name: "#c3c9d1", nameStroke: NAME_STROKE },
  { label: "Naranja", shirt: 0xc06a2e, hair: HAIR, skin: 0xdcab82, name: "#ff9a45", nameStroke: NAME_STROKE },
  { label: "Turquesa", shirt: 0x3f8a80, hair: HAIR, skin: 0xe6b88f, name: "#3fe0d2", nameStroke: NAME_STROKE },
  { label: "Rosa", shirt: 0xc4677a, hair: HAIR, skin: 0xd8a47c, name: "#ff8cc2", nameStroke: NAME_STROKE },
  { label: "Marrón", shirt: 0x6b4a33, hair: HAIR, skin: 0xe9c09a, name: "#c98a4e", nameStroke: NAME_STROKE },
  { label: "Negro", shirt: 0x2a2a2e, hair: HAIR, skin: 0xdcab82, name: "#2a2a2e", nameStroke: "#f3f0e7" },
];

const ANIM = roenoMeta.anim;
/** Altura del personaje en px de mundo. */
const CHARACTER_HEIGHT = 74;
/** Escala del sprite (la hoja tiene 18 px de margen vertical). */
const SPRITE_SCALE = CHARACTER_HEIGHT / (roenoMeta.frameH - 18);
/** Altura de los pies respecto al origen del contenedor. */
const FEET_Y = 13;
/** Altura de la cabeza respecto al origen del contenedor. */
const HEAD_Y = FEET_Y - CHARACTER_HEIGHT;
/** Duración (ms) del gesto de giro. */
const TURN_MS = 150;
/** Duración (ms) de la celebración (salto). */
const CELEBRATE_MS = 700;
const REDUCED_MOTION = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Polvillos de pisadas vivos a la vez (para no cargar el móvil). */
let liveDust = 0;
const MAX_DUST = 10;

export class Character extends Phaser.GameObjects.Container {
  private sprite!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private nameText!: Phaser.GameObjects.Text;
  private lookIndex = 0;
  private lying = false;
  private anim = new WalkAnimator(ANIM);
  /** Fase de la respiración en reposo (aleatoria para que no respiren todos a la vez). */
  private breath = Math.random() * 10;
  /** Orientación horizontal suavizada (-1 izquierda, 1 derecha). */
  private facing = 1;
  private giros = 0;
  private giroMs = 0;
  /** Inclinación (grados) al arrancar o frenar. */
  private lean = 0;
  private celebrarMs = 0;
  private frameIndex = ANIM.parado.frente;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, look: CharacterLook) {
    super(scene, x, y);
    this.lookIndex = Math.max(0, PALETTE.indexOf(look));
    this.shadow = scene.add.ellipse(0, FEET_Y - 1, 38, 11, 0x120b07, 0.38);
    this.sprite = scene.add
      .sprite(0, FEET_Y, `roeno-${this.lookIndex}`, ANIM.quieto)
      .setOrigin(0.5, roenoMeta.pivotY / roenoMeta.frameH)
      .setScale(SPRITE_SCALE);
    this.nameText = scene.add
      .text(0, HEAD_Y - 4, name, {
        fontFamily: "Nunito, system-ui, Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        strokeThickness: 5,
      })
      .setOrigin(0.5, 1);
    this.add([this.shadow, this.sprite, this.nameText]);
    this.setLook(look);
    this.showFrame(this.anim.frame());
    scene.add.existing(this);
  }

  /** Desplaza el nombre hacia arriba (para que no se pise con el de otro jugador cercano). */
  setNameLift(px: number): void {
    const target = HEAD_Y - 4 - px;
    this.nameText.y += (target - this.nameText.y) * 0.3;
  }

  /** Cambia el aspecto (el servidor puede asignar otro color si el elegido estaba cogido). */
  setLook(look: CharacterLook): void {
    const index = Math.max(0, PALETTE.indexOf(look));
    this.nameText.setColor(look.name).setStroke(look.nameStroke, 5);
    this.lookIndex = index;
    this.sprite.setTexture(`roeno-${index}`);
    this.showFrame(this.frameIndex);
  }

  get nameWidth(): number {
    return this.nameText.width;
  }

  setDisplayName(name: string): void {
    this.nameText.setText(name);
  }

  /** Tumba al personaje (cuerpo). Con `instant` (o movimiento reducido) sin animación. */
  lieDown(instant = false): this {
    this.lying = true;
    this.celebrarMs = 0;
    this.nameText.setVisible(false);
    const sprite = this.sprite.setFlipX(false);
    this.showFrame(ANIM.parado.lado);
    const lyingPose = { angle: -90, x: -20, y: FEET_Y - 4, scaleX: SPRITE_SCALE, scaleY: SPRITE_SCALE };
    if (instant || REDUCED_MOTION) {
      sprite.setAngle(lyingPose.angle).setPosition(lyingPose.x, lyingPose.y).setScale(SPRITE_SCALE);
      this.shadow.setSize(70, 16).setScale(1);
      return this;
    }
    const tweens = this.scene.tweens;
    sprite.setAngle(0).setPosition(0, FEET_Y).setScale(SPRITE_SCALE);
    // Encoge, cae de lado y rebota un poco al tocar el suelo
    tweens.add({
      targets: sprite,
      scaleY: SPRITE_SCALE * 0.9,
      scaleX: SPRITE_SCALE * 1.04,
      angle: 6,
      duration: 110,
      ease: "Quad.Out",
      onComplete: () => {
        tweens.add({
          targets: sprite,
          ...lyingPose,
          angle: -94,
          duration: 300,
          ease: "Quad.In",
          onComplete: () => {
            tweens.add({
              targets: sprite,
              angle: -90,
              y: lyingPose.y - 2,
              duration: 90,
              yoyo: true,
              ease: "Sine.Out",
              onComplete: () => sprite.setY(lyingPose.y),
            });
          },
        });
      },
    });
    // La sombra se alarga a la vez que cae
    const shadowSize = { w: 38, h: 11 };
    this.once(Phaser.GameObjects.Events.DESTROY, () => tweens.killTweensOf([sprite, shadowSize]));
    this.shadow.setScale(1);
    tweens.add({
      targets: shadowSize,
      w: 70,
      h: 16,
      delay: 110,
      duration: 300,
      ease: "Quad.In",
      onUpdate: () => {
        if (this.shadow.active) this.shadow.setSize(shadowSize.w, shadowSize.h);
      },
    });
    return this;
  }

  /** Pequeño salto de alegría (al completar una misión). */
  celebrate(): this {
    if (this.lying) return this;
    this.celebrarMs = CELEBRATE_MS;
    if (this.anim.estado === "quieto") this.anim.mirar("frente");
    if (!REDUCED_MOTION) this.sparkles();
    return this;
  }

  /** Anima según la velocidad (px/s) y el tiempo transcurrido; emite "paso" en cada pisada. */
  animate(vx: number, vy: number, dtMs: number): void {
    this.setDepth(20 + this.y / 1e5);
    if (this.lying) return;
    const dt = Math.max(0, Math.min(dtMs, 250));
    const anim = this.anim;
    for (const pie of anim.update(vx, vy, dt)) {
      this.emit("paso", { pie } satisfies PasoEvent);
      this.footDust(pie, vx);
    }
    if (anim.giros !== this.giros) {
      this.giros = anim.giros;
      this.giroMs = TURN_MS;
    }
    this.giroMs = Math.max(0, this.giroMs - dt);

    // Giro horizontal suavizado (el sprite se "aplasta" al darse la vuelta)
    const targetFacing = anim.izquierda ? -1 : 1;
    const turnStep = Math.min(1, dt / (TURN_MS * 0.5));
    this.facing += Math.sign(targetFacing - this.facing) * Math.min(Math.abs(targetFacing - this.facing), 2 * turnStep);
    if (REDUCED_MOTION) this.facing = targetFacing;
    const targetLean = anim.estado === "arrancando" ? 4 : anim.estado === "parando" ? -3 : 0;
    this.lean += (targetLean - this.lean) * Math.min(1, dt / 90);

    let scaleX = 1;
    let scaleY = 1;
    let spriteY = FEET_Y;
    let angle = 0;
    const turn = this.giroMs / TURN_MS;
    scaleX *= 1 - 0.28 * Math.sin(turn * Math.PI);
    scaleY *= 1 + 0.04 * Math.sin(turn * Math.PI);
    let frame = anim.frame();
    if (anim.estado === "quieto") {
      // Respiración
      this.breath += dt / 1000;
      const breathe = Math.sin(this.breath * 2.3) * 0.013;
      scaleY *= 1 + breathe;
      scaleX *= 1 - breathe * 0.4;
      this.shadow.setScale(1, 1);
    } else {
      // Aplastado al apoyar el pie
      const contact = anim.contacto();
      const squash = Math.pow(contact, 3) * 0.025;
      scaleY *= 1 - squash;
      scaleX *= 1 + squash * 0.6;
      this.shadow.setScale(0.9 + 0.1 * contact, 1);
    }
    if (anim.vista === "lado" || anim.reposo) angle = this.lean * Math.sign(this.facing || targetFacing);
    else scaleY *= 1 - Math.abs(this.lean) * 6e-3;

    if (this.celebrarMs > 0) {
      // Celebración: agacharse, saltar y caer
      this.celebrarMs = Math.max(0, this.celebrarMs - dt);
      const progress = 1 - this.celebrarMs / CELEBRATE_MS;
      if (anim.estado === "quieto") frame = ANIM.parado.frente;
      if (progress < 0.18) {
        const k = progress / 0.18;
        scaleY *= 1 - 0.1 * Math.sin(k * Math.PI * 0.5);
        scaleX *= 1 + 0.06 * Math.sin(k * Math.PI * 0.5);
      } else if (progress < 0.72) {
        const k = (progress - 0.18) / 0.54;
        spriteY -= 15 * Math.sin(k * Math.PI);
        scaleY *= 1 + 0.07 * Math.cos(k * Math.PI);
        angle += 7 * Math.sin(k * Math.PI * 2);
        this.shadow.setScale(1 - 0.3 * Math.sin(k * Math.PI), 1);
      } else {
        const k = (progress - 0.72) / 0.28;
        scaleY *= 1 - 0.09 * Math.sin(k * Math.PI);
        scaleX *= 1 + 0.05 * Math.sin(k * Math.PI);
      }
    }
    this.showFrame(frame);

    // Solo los fotogramas de perfil se voltean según hacia dónde mira
    const isSideFrame =
      frame === ANIM.quieto ||
      frame === ANIM.parado.lado ||
      (frame >= ANIM.ciclo.lado && frame < ANIM.ciclo.lado + ANIM.cicloLen);
    const flip = isSideFrame ? (REDUCED_MOTION ? targetFacing : this.facing) : 1;
    const signedScale = (flip < 0 || (flip === 0 && targetFacing < 0) ? -1 : 1) * Math.max(0.12, Math.abs(flip));
    this.sprite
      .setFlipX(signedScale < 0)
      .setScale(SPRITE_SCALE * scaleX * Math.abs(signedScale), SPRITE_SCALE * scaleY)
      .setAngle(angle)
      .setPosition(0, spriteY);
  }

  private showFrame(frame: number): void {
    this.frameIndex = frame;
    if (this.sprite.texture.has(String(frame))) this.sprite.setFrame(frame);
    else this.sprite.setFrame(this.fallbackFrame(frame));
  }

  /** Si la hoja no tiene el fotograma del ciclo, usa el parado de esa vista. */
  private fallbackFrame(frame: number): number {
    const { ciclo, cicloLen, parado } = ANIM;
    for (const vista of ["lado", "frente", "espalda"] as Vista[]) {
      if (frame >= ciclo[vista] && frame < ciclo[vista] + cicloLen) return parado[vista];
    }
    return Math.min(frame, 3);
  }

  /** Polvillo bajo el pie al pisar (solo si se ve en pantalla y hay pocos a la vez). */
  private footDust(pie: Pie, vx: number): void {
    if (REDUCED_MOTION || !this.visible || this.alpha < 0.9 || liveDust >= MAX_DUST) return;
    const scene = this.scene;
    if (!scene.textures.exists("fx-polvo") || !scene.cameras.main.worldView.contains(this.x, this.y)) return;
    liveDust++;
    const side = pie === "izq" ? -1 : 1;
    const puff = scene.add
      .image(this.x + side * 7, this.y + FEET_Y + 1, "fx-polvo")
      .setScale(0.1)
      .setAlpha(0.55)
      .setDepth(this.depth - 1e-6);
    scene.tweens.add({
      targets: puff,
      scale: 0.22,
      alpha: 0,
      x: puff.x - Math.sign(vx) * 8,
      y: puff.y - 4,
      duration: 420,
      ease: "Quad.Out",
      onComplete: () => {
        liveDust--;
        puff.destroy();
      },
    });
  }

  /** Destellos que suben sobre la cabeza al celebrar. */
  private sparkles(): void {
    for (let i = 0; i < 4; i++) {
      const star = this.scene.add
        .text((i - 1.5) * 12, HEAD_Y + 4, "✦", {
          fontSize: "13px",
          color: i % 2 ? "#ffe27a" : "#fff6d0",
          stroke: "#3a2a10",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.add(star);
      this.scene.tweens.add({
        targets: star,
        y: HEAD_Y - 18 - (i % 2) * 8,
        x: (i - 1.5) * 18,
        alpha: { from: 1, to: 0 },
        angle: 90,
        delay: 120 + i * 50,
        duration: 650,
        ease: "Quad.Out",
        onComplete: () => star.destroy(),
      });
    }
  }
}
