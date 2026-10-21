import Phaser from "phaser";
import { RIVER_WIDTH, riverLines } from "../../shared/map/river";

/**
 * Ambiente del pueblo: árboles mecidos por el viento, hojas y pétalos que caen,
 * motas de polvo con luz, halos de las farolas, bandadas de pájaros, sombras de
 * nubes, brillos en el río, luz cálida y viñeta. Con "movimiento reducido" se
 * desactiva casi todo lo que se mueve.
 */

/** Interfaz que devuelve createAmbience (la usa TownScene). */
export interface Ambience {
  update(time: number, delta: number, camera: Phaser.Cameras.Scene2D.Camera): void;
  destroy(): void;
}

export interface AmbienceOptions {
  /** Objetos de decoración del mapa (árboles, farolas…) que devuelve placeDecor. */
  decor: Phaser.GameObjects.Image[];
}

/** Amplitud (radianes) del balanceo de cada tipo de planta. */
const SWAY_AMPLITUDE: Record<string, number> = { naranjo: 0.022, olivo: 0.026, arbusto: 0.035, buganvilla: 0.03 };

interface FallingKind {
  tex: string;
  tints: number[];
  /** Probabilidad de soltar una hoja cuando le toca. */
  weight: number;
}

/** Qué suelta cada planta al caer. */
const FALLING: Record<string, FallingKind> = {
  naranjo: { tex: "amb-petalo", tints: [0xfbf6ea, 0xfbf6ea, 0x4f8040], weight: 1 },
  olivo: { tex: "amb-hoja", tints: [0x86926a, 0xb8c2a0, 0x5f6c48], weight: 1 },
  arbusto: { tex: "amb-hoja", tints: [0x4f8040, 0x6a9a4c], weight: 0.3 },
  buganvilla: { tex: "amb-petalo", tints: [0xe2479a, 0xb02a74], weight: 1.2 },
};

/** Viento (px/s): arrastra hojas, motas y nubes. */
const WIND = { x: 14, y: 5 };

type GradientStops = [number, string][];

/** Crea (una sola vez) las texturas pequeñas del ambiente dibujadas en canvas. */
function createAmbienceTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  const makeCanvas = (key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (textures.exists(key)) return;
    const canvas = textures.createCanvas(key, width, height)!;
    draw(canvas.getContext());
    canvas.refresh();
  };
  const radial = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: GradientStops) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    return gradient;
  };

  makeCanvas("amb-mota", 16, 16, (ctx) => {
    ctx.fillStyle = radial(ctx, 8, 8, 8, [
      [0, "rgba(255,255,255,1)"],
      [0.35, "rgba(255,255,255,0.5)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    ctx.fillRect(0, 0, 16, 16);
  });
  makeCanvas("amb-halo", 128, 128, (ctx) => {
    ctx.fillStyle = radial(ctx, 64, 64, 64, [
      [0, "rgba(255,226,150,0.95)"],
      [0.18, "rgba(255,206,110,0.55)"],
      [0.55, "rgba(255,170,70,0.16)"],
      [1, "rgba(255,160,60,0)"],
    ]);
    ctx.fillRect(0, 0, 128, 128);
  });
  makeCanvas("amb-hoja", 12, 6, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(42,28,20,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, 3);
    ctx.quadraticCurveTo(6, -1, 11, 3);
    ctx.quadraticCurveTo(6, 7, 1, 3);
    ctx.fill();
    ctx.stroke();
  });
  makeCanvas("amb-petalo", 8, 8, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(42,28,20,0.55)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(4, 4, 3.2, 2.2, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  if (!textures.exists("amb-pajaro")) {
    // Pájaro visto desde arriba en dos fotogramas: alas abiertas y plegadas
    makeCanvas("amb-pajaro", 64, 20, (ctx) => {
      ctx.fillStyle = "#ffffff";
      for (const [ox, open] of [
        [0, 1],
        [32, 0.45],
      ]) {
        ctx.beginPath();
        ctx.moveTo(ox + 16, 4);
        ctx.quadraticCurveTo(ox + 10, 8 - 4 * open, ox + 1, 6 + 4 * (1 - open));
        ctx.quadraticCurveTo(ox + 10, 11, ox + 14, 12);
        ctx.lineTo(ox + 12, 19);
        ctx.lineTo(ox + 16, 14);
        ctx.lineTo(ox + 20, 19);
        ctx.lineTo(ox + 18, 12);
        ctx.quadraticCurveTo(ox + 22, 11, ox + 31, 6 + 4 * (1 - open));
        ctx.quadraticCurveTo(ox + 22, 8 - 4 * open, ox + 16, 4);
        ctx.fill();
      }
    });
    const bird = textures.get("amb-pajaro");
    bird.add(0, 0, 0, 0, 32, 20);
    bird.add(1, 0, 32, 0, 32, 20);
  }
  makeCanvas("amb-nube", 256, 160, (ctx) => {
    const puffs = [
      [80, 85, 60],
      [130, 70, 70],
      [180, 90, 55],
      [120, 105, 50],
      [60, 100, 40],
      [205, 75, 38],
    ];
    for (const [x, y, r] of puffs) {
      ctx.fillStyle = radial(ctx, x, y, r, [
        [0, "rgba(0,0,0,0.55)"],
        [0.6, "rgba(0,0,0,0.3)"],
        [1, "rgba(0,0,0,0)"],
      ]);
      ctx.fillRect(0, 0, 256, 160);
    }
  });
  makeCanvas("amb-brillo", 24, 6, (ctx) => {
    ctx.fillStyle = radial(ctx, 12, 3, 12, [
      [0, "rgba(255,255,255,1)"],
      [0.4, "rgba(230,245,255,0.6)"],
      [1, "rgba(230,245,255,0)"],
    ]);
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.fillRect(0, 0, 24, 24);
    ctx.restore();
  });
  makeCanvas("amb-luz", 256, 256, (ctx) => {
    ctx.fillStyle = radial(ctx, 0, 0, 340, [
      [0, "rgba(255,190,110,1)"],
      [0.45, "rgba(255,170,90,0.45)"],
      [1, "rgba(255,150,80,0)"],
    ]);
    ctx.fillRect(0, 0, 256, 256);
  });
  makeCanvas("amb-vineta", 256, 256, (ctx) => {
    ctx.fillStyle = radial(ctx, 128, 128, 182, [
      [0, "rgba(26,15,8,0)"],
      [0.62, "rgba(26,15,8,0)"],
      [1, "rgba(26,15,8,1)"],
    ]);
    ctx.fillRect(0, 0, 256, 256);
  });
}

/** Parpadeo suave (suma de senos) para la luz de las farolas. */
const flicker = (t: number, seed: number) =>
  Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 3.1 + seed * 2.3) * 0.3 + Math.sin(t * 7.3 + seed * 0.7) * 0.2;

interface SwayingPlant {
  img: Phaser.GameObjects.Image;
  amp: number;
  phase: number;
  /** Escala vertical original (para restaurarla). */
  sy: number;
}

interface FallingLeaf {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  x: number;
  y: number;
  vy: number;
  /** Altura a la que toca el suelo. */
  ground: number;
  t: number;
  spin: number;
  phase: number;
  /** Tiempo en el suelo antes de desvanecerse. */
  rest: number;
}

interface DustMote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  /** Opacidad base. */
  a: number;
}

interface LampHalo {
  img: Phaser.GameObjects.Image;
  lamp: Phaser.GameObjects.Image | null;
  seed: number;
}

interface Bird {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  turn: number;
  flap: number;
  /** >0: planeando (alas quietas). */
  glide: number;
}

interface CloudShadow {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RiverPoint {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface RiverGlint {
  img: Phaser.GameObjects.Image;
  t: number;
  life: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function createAmbience(scene: Phaser.Scene, options: AmbienceOptions): Ambience {
  const reducedMotion = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  createAmbienceTextures(scene);
  const rand = Phaser.Math.FloatBetween;
  // Objetos creados aquí (se destruyen en destroy)
  const owned: Phaser.GameObjects.Image[] = [];
  const own = (obj: Phaser.GameObjects.Image) => {
    owned.push(obj);
    return obj;
  };

  const swaying: SwayingPlant[] = [];
  const lamps: Phaser.GameObjects.Image[] = [];
  for (const img of options.decor) {
    const key = img.texture.key;
    if (key in SWAY_AMPLITUDE) swaying.push({ img, amp: SWAY_AMPLITUDE[key] * rand(0.75, 1.25), phase: rand(0, Math.PI * 2), sy: img.scaleY });
    else if (key === "farola") lamps.push(img);
  }

  // Hojas y pétalos que caen de las plantas visibles
  const visiblePlants: SwayingPlant[] = [];
  const leaves: FallingLeaf[] = Array.from({ length: reducedMotion ? 0 : 12 }, () => ({
    img: own(scene.add.image(0, 0, "amb-hoja").setVisible(false)),
    alive: false,
    x: 0,
    y: 0,
    vy: 0,
    ground: 0,
    t: 0,
    spin: 0,
    phase: 0,
    rest: 0,
  }));
  let leafTimer = 0;
  const spawnLeaf = () => {
    if (!visiblePlants.length) return;
    const leaf = leaves.find((l) => !l.alive);
    if (!leaf) return;
    const plant = visiblePlants[Math.floor(Math.random() * visiblePlants.length)];
    const kind = FALLING[plant.img.texture.key];
    if (!kind || Math.random() > kind.weight) return;
    const { img } = plant;
    const width = img.displayWidth;
    const height = img.displayHeight;
    leaf.alive = true;
    leaf.x = img.x + rand(-0.32, 0.32) * width;
    leaf.y = img.y - height * rand(0.45, 0.75);
    leaf.ground = img.y + rand(-4, 14);
    leaf.vy = rand(14, 24);
    leaf.t = 0;
    leaf.rest = 0;
    leaf.spin = rand(-3, 3);
    leaf.phase = rand(0, 6);
    leaf.img
      .setTexture(kind.tex)
      .setTint(kind.tints[Math.floor(Math.random() * kind.tints.length)])
      .setScale(rand(0.55, 0.85))
      .setAlpha(1)
      .setDepth(plant.img.depth + 1e-6)
      .setVisible(true);
  };

  // Motas de polvo iluminadas
  const motes: DustMote[] = Array.from({ length: reducedMotion ? 8 : 22 }, () => ({
    img: own(
      scene.add
        .image(0, 0, "amb-mota")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffe2a8)
        .setDepth(45)
        .setScale(rand(0.18, 0.42)),
    ),
    x: NaN,
    y: 0,
    vx: rand(-4, 4),
    vy: rand(-6, -1),
    phase: rand(0, 6),
    a: rand(0.12, 0.35),
  }));

  // Halos de las farolas más cercanas al centro de la vista
  const halos: LampHalo[] = Array.from({ length: 14 }, (_, i) => ({
    img: own(scene.add.image(0, 0, "amb-halo").setBlendMode(Phaser.BlendModes.ADD).setDepth(44).setVisible(false)),
    lamp: null,
    seed: i * 1.9,
  }));
  let lampTimer = 0;
  const visibleLamps: Phaser.GameObjects.Image[] = [];

  // Pájaros (con su sombra en el suelo)
  const birds: Bird[] = Array.from({ length: reducedMotion ? 0 : 4 }, () => ({
    img: own(scene.add.image(0, 0, "amb-pajaro", 0).setTint(0x2a1c14).setAlpha(0.9).setDepth(47).setVisible(false)),
    shadow: own(scene.add.image(0, 0, "amb-pajaro", 0).setTint(0).setAlpha(0.16).setDepth(4).setVisible(false)),
    alive: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    turn: 0,
    flap: 0,
    glide: 0,
  }));
  let birdTimer = rand(4, 8);
  /** Lanza una bandada que cruza la vista desde un lado. */
  const launchFlock = (view: Phaser.Geom.Rectangle) => {
    const count = Phaser.Math.Between(2, birds.length);
    const fromLeft = Math.random() < 0.6;
    const speed = rand(150, 210);
    const heading = (fromLeft ? 0 : Math.PI) + rand(-0.45, 0.45);
    const startY = view.y + view.height * rand(0.15, 0.85);
    const startX = fromLeft ? view.x - 40 : view.right + 40;
    const turn = rand(-0.25, 0.25);
    for (let i = 0; i < count; i++) {
      const bird = birds[i];
      bird.alive = true;
      bird.x = startX - Math.cos(heading) * i * rand(26, 48);
      bird.y = startY + rand(-30, 30) - Math.sin(heading) * i * 20;
      bird.vx = Math.cos(heading) * speed;
      bird.vy = Math.sin(heading) * speed;
      bird.turn = turn + rand(-0.08, 0.08);
      bird.flap = rand(0, 1);
      bird.glide = 0;
      const scale = rand(0.7, 0.95);
      bird.img.setScale(scale).setVisible(true);
      bird.shadow.setScale(scale * 0.9).setVisible(true);
    }
  };

  // Sombras de nubes
  const clouds: CloudShadow[] = Array.from({ length: reducedMotion ? 0 : 3 }, () => {
    const w = rand(900, 1400);
    const h = w * rand(0.5, 0.7);
    return {
      img: own(
        scene.add
          .image(0, 0, "amb-nube")
          .setDisplaySize(w, h)
          .setAlpha(rand(0.16, 0.24))
          .setDepth(3)
          .setFlipX(Math.random() < 0.5),
      ),
      x: NaN,
      y: 0,
      w,
      h,
    };
  });

  // Puntos del río cada 24 px (con su dirección) para los brillos del agua
  const riverPoints: RiverPoint[] = [];
  for (const line of riverLines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (let d = 0; d < length; d += 24) {
        riverPoints.push({
          x: a.x + ((b.x - a.x) * d) / length,
          y: a.y + ((b.y - a.y) * d) / length,
          dx: (b.x - a.x) / length,
          dy: (b.y - a.y) / length,
        });
      }
    }
  }
  const glints: RiverGlint[] = Array.from({ length: reducedMotion ? 0 : 16 }, () => ({
    img: own(scene.add.image(0, 0, "amb-brillo").setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setVisible(false)),
    t: 0,
    life: 0,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
  }));
  /** Índices de riverPoints cerca de la vista. */
  const visibleRiver: number[] = [];
  let riverTimer = 0;

  // Luz cálida y viñeta fijas a la cámara
  const warmLight = own(scene.add.image(0, 0, "amb-luz").setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.09).setDepth(50));
  const vignette = own(scene.add.image(0, 0, "amb-vineta").setScrollFactor(0).setAlpha(0.36).setDepth(51));
  const isNear = (rect: Phaser.Geom.Rectangle, x: number, y: number, margin: number) =>
    x > rect.x - margin && x < rect.right + margin && y > rect.y - margin && y < rect.bottom + margin;

  return {
    update(time, delta, camera) {
      const dt = Math.min(delta, 50) / 1000;
      const t = time / 1000;
      const view = camera.worldView;
      const viewW = camera.width / camera.zoom;
      const viewH = camera.height / camera.zoom;
      warmLight.setPosition(camera.width / 2, camera.height / 2).setDisplaySize(viewW * 1.02, viewH * 1.02);
      vignette.setPosition(camera.width / 2, camera.height / 2).setDisplaySize(viewW * 1.04, viewH * 1.04);

      // Plantas mecidas por el viento, con rachas que recorren el pueblo
      visiblePlants.length = 0;
      for (const plant of swaying) {
        if (!isNear(view, plant.img.x, plant.img.y, 140)) continue;
        visiblePlants.push(plant);
        if (reducedMotion) continue;
        const gust = Math.max(0, Math.sin(t * 0.35 - plant.img.x * 12e-4 - plant.img.y * 5e-4)) ** 3;
        const sway =
          Math.sin(t * 1.3 + plant.phase) * 0.6 +
          Math.sin(t * 2.9 + plant.phase * 1.7) * 0.25 +
          gust * (0.9 + Math.sin(t * 5 + plant.phase) * 0.4);
        plant.img.setRotation(plant.amp * sway);
        plant.img.scaleY = plant.sy * (1 + 0.012 * Math.sin(t * 1.9 + plant.phase));
      }

      if (leaves.length) {
        leafTimer -= dt;
        if (leafTimer <= 0) {
          leafTimer = rand(0.35, 0.8);
          spawnLeaf();
        }
        for (const leaf of leaves) {
          if (!leaf.alive) continue;
          leaf.t += dt;
          if (leaf.y < leaf.ground) {
            // Cayendo con vaivén
            leaf.y += leaf.vy * dt;
            leaf.x += (WIND.x * 0.6 + Math.sin(leaf.t * 2.4 + leaf.phase) * 16) * dt;
            leaf.img.setRotation(Math.sin(leaf.t * 3 + leaf.phase) * 0.9 + leaf.spin * leaf.t * 0.2);
            leaf.img.scaleY = leaf.img.scaleX * (0.6 + 0.4 * Math.abs(Math.sin(leaf.t * 3 + leaf.phase)));
          } else {
            // En el suelo: se desvanece
            leaf.rest += dt;
            leaf.img.setAlpha(Math.max(0, 1 - leaf.rest / 2.5));
            if (leaf.rest > 2.5) {
              leaf.alive = false;
              leaf.img.setVisible(false);
            }
          }
          leaf.img.setPosition(leaf.x, leaf.y);
          if (!isNear(view, leaf.x, leaf.y, 200)) {
            leaf.alive = false;
            leaf.img.setVisible(false);
          }
        }
      }

      for (const mote of motes) {
        if (Number.isNaN(mote.x) || !isNear(view, mote.x, mote.y, 60)) {
          mote.x = view.x + rand(0, view.width);
          mote.y = view.y + rand(0, view.height);
        }
        if (!reducedMotion) {
          mote.x += (mote.vx + WIND.x * 0.4 + Math.sin(t * 0.7 + mote.phase) * 6) * dt;
          mote.y += (mote.vy + Math.cos(t * 0.9 + mote.phase) * 4) * dt;
        }
        mote.img
          .setPosition(mote.x, mote.y)
          .setAlpha(reducedMotion ? mote.a * 0.7 : mote.a * (0.55 + 0.45 * Math.sin(t * 1.3 + mote.phase * 3)));
      }

      // Cada 0,3 s se reparten los halos entre las farolas visibles más cercanas
      lampTimer -= dt;
      if (lampTimer <= 0) {
        lampTimer = 0.3;
        visibleLamps.length = 0;
        for (const lamp of lamps) if (isNear(view, lamp.x, lamp.y, 80)) visibleLamps.push(lamp);
        const cx = view.centerX;
        const cy = view.centerY;
        if (visibleLamps.length > halos.length) {
          visibleLamps.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
        }
        halos.forEach((halo, i) => {
          const lamp = visibleLamps[i] ?? null;
          if (lamp !== halo.lamp) {
            halo.lamp = lamp;
            halo.img.setVisible(!!lamp);
            if (lamp) halo.img.setPosition(lamp.x, lamp.y - lamp.displayHeight * 0.75).setScale((lamp.displayHeight / 80) * 0.62);
          }
        });
      }
      for (const halo of halos) {
        if (!halo.lamp) continue;
        const blink = !reducedMotion && Math.sin(t * 0.8 + halo.seed * 5) > 0.985 ? 0.55 : 1;
        halo.img.setAlpha(reducedMotion ? 0.56 : (0.56 + 0.08 * flicker(t * 2.2, halo.seed)) * blink);
      }

      if (birds.length) {
        birdTimer -= dt;
        if (birdTimer <= 0 && !birds.some((b) => b.alive)) {
          birdTimer = rand(9, 18);
          launchFlock(view);
        }
        for (const bird of birds) {
          if (!bird.alive) continue;
          const heading = Math.atan2(bird.vy, bird.vx) + bird.turn * dt * Math.sin(t * 0.8 + bird.flap * 6);
          const speed = Math.hypot(bird.vx, bird.vy);
          bird.vx = Math.cos(heading) * speed;
          bird.vy = Math.sin(heading) * speed;
          bird.x += bird.vx * dt;
          bird.y += bird.vy * dt;
          bird.glide -= dt;
          if (bird.glide < -0.9) bird.glide = rand(0.3, 0.9);
          const frame = bird.glide > 0 ? 0 : Math.floor((t * 11 + bird.flap) % 2);
          const rotation = heading + Math.PI / 2;
          bird.img.setPosition(bird.x, bird.y).setRotation(rotation).setFrame(frame);
          bird.shadow
            .setPosition(bird.x + 46, bird.y + 80)
            .setRotation(rotation)
            .setFrame(frame);
          if (!isNear(view, bird.x, bird.y, 140)) {
            bird.alive = false;
            bird.img.setVisible(false);
            bird.shadow.setVisible(false);
          }
        }
      }

      for (const cloud of clouds) {
        if (Number.isNaN(cloud.x)) {
          cloud.x = view.x + rand(-0.3, 1.3) * view.width;
          cloud.y = view.y + rand(-0.3, 1.3) * view.height;
        }
        cloud.x += WIND.x * dt;
        cloud.y += WIND.y * dt;
        if (!isNear(view, cloud.x, cloud.y, Math.max(cloud.w, cloud.h) * 0.75)) {
          // Vuelve a entrar por el lado de barlovento
          cloud.x = view.x - cloud.w * 0.5 - rand(0, 300);
          cloud.y = view.y + rand(-0.2, 1.1) * view.height;
        }
        cloud.img.setPosition(cloud.x, cloud.y);
      }

      if (glints.length && riverPoints.length) {
        riverTimer -= dt;
        if (riverTimer <= 0) {
          riverTimer = 0.5;
          visibleRiver.length = 0;
          for (let i = 0; i < riverPoints.length; i++) {
            if (isNear(view, riverPoints[i].x, riverPoints[i].y, 30)) visibleRiver.push(i);
          }
        }
        for (const glint of glints) {
          glint.t += dt;
          if (glint.t >= glint.life) {
            if (!visibleRiver.length) {
              glint.img.setVisible(false);
              continue;
            }
            const point = riverPoints[visibleRiver[Math.floor(Math.random() * visibleRiver.length)]];
            const across = rand(-0.35, 0.35) * RIVER_WIDTH;
            glint.x = point.x - point.dy * across + point.dx * rand(-12, 12);
            glint.y = point.y + point.dx * across + point.dy * rand(-12, 12);
            glint.dx = point.dx;
            glint.dy = point.dy;
            glint.t = 0;
            glint.life = rand(0.7, 1.6);
            glint.img
              .setRotation(Math.atan2(point.dy, point.dx))
              .setScale(rand(0.7, 1.4), rand(0.9, 1.3))
              .setVisible(true);
          }
          glint.x += glint.dx * 10 * dt;
          glint.y += glint.dy * 10 * dt;
          glint.img.setPosition(glint.x, glint.y).setAlpha(Math.sin((Math.PI * glint.t) / glint.life) * 0.8);
        }
      }
    },
    destroy() {
      for (const plant of swaying) {
        if (plant.img.active) {
          plant.img.setRotation(0);
          plant.img.scaleY = plant.sy;
        }
      }
      for (const obj of owned) obj.destroy();
      owned.length = 0;
    },
  };
}
