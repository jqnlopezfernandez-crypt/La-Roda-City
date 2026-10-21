import Phaser from "phaser";
import { PLAYER_RADIUS, PLAYER_SPEED } from "../../shared/net/protocol";
import { WORLD_SIZE, defaultSpawn, isWalkable, moveAlongStreets, nearestWalkable, traceToWorld, type Vec2 } from "../../shared/map/townMap";
import { addProp, registerArt } from "../art/runtime";
import { TownRenderer, placeDecor, placeOccluders } from "./mapRenderer";
import { createAmbience } from "./ambience";
import { Character, PALETTE } from "./characters";
import { ambient, music, sfx } from "./sounds";
import { ACTIVE_MISSIONS, MISSION_RANGE, missionById, pickTasks, type AssignedTask } from "../../shared/game/missions";
import { findPath, type Path } from "../../shared/map/pathfinding";
import { input } from "./inputState";
import { RIVER_WIDTH, riverLines } from "../../shared/map/river";
import { Overlays, type MeetingPlayer } from "../ui/overlays";
import { RULES, teamOf, type Role } from "../../shared/game/rules";
import { openMiniGame } from "../ui/minigames";
import { pointsOfInterest, type PointOfInterest } from "../../shared/data/pointsOfInterest";
import type { Body, NetSession, RemotePlayer, TaskStateView } from "../net/session";

export type ActionKind = "eliminar" | "reportar" | "llevar" | "emergencia";

/** Acciones disponibles en este momento (las valida el servidor igualmente). */
export type Actions = {
  kill: string | null;
  killWaitS: number;
  isImpostor: boolean;
  carry: string | null;
  report: string | null;
  emergency: boolean;
  /** Misión que se puede hacer aquí mismo. */
  task: string | null;
};

export type TaskView = { missionId: string; nombre: string; lugar: number; lugarNombre: string; step: number; steps: number; done: boolean };

/** Lo que recibe la interfaz con el evento "tasks". */
export type TasksInfo = { list: TaskView[]; done: number; total: number; practice: boolean };

/** Distancia a la que se puede interactuar con un punto de interés. */
const INTERACT_DISTANCE = 75;

/** El sistema pide reducir el movimiento: sin animaciones decorativas. */
const REDUCED_MOTION = typeof matchMedia == "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type PoiView = {
  poi: PointOfInterest;
  world: Vec2;
  access: Vec2;
  marker: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  /** Aviso flotante «!» sobre los lugares con misión pendiente. */
  bubble: Phaser.GameObjects.Image;
};

type RemoteView = { view: Character; target: Vec2; info: RemotePlayer };

/** Misión del modo en solitario (sin servidor). */
type PracticeTask = AssignedTask & { done: boolean };

type Ambience = ReturnType<typeof createAmbience>;

/**
 * Escena del mundo: mapa de La Roda, personaje local, cámara y puntos de interés.
 * La interfaz (joystick, botones, paneles) vive en UIScene para no verse afectada
 * por el zoom de la cámara.
 */
export class TownScene extends Phaser.Scene {
  private player!: Character;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private speed = PLAYER_SPEED;
  private pois: PoiView[] = [];
  private nearest: PoiView | null = null;
  private town!: InstanceType<typeof TownRenderer>;
  private session: NetSession | null = null;
  private remotes = new Map<string, RemoteView>();
  private serverSpawnApplied = false;
  private me: RemotePlayer | null = null;
  private phase = "sala";
  private bodies = new Map<string, { view: Phaser.GameObjects.Container; data: Body }>();
  private dom: Overlays | null = null;
  private roleShown = false;
  private lastActions = "";
  /** Aro rojo bajo el vecino al que el impostor puede eliminar. */
  private killRing: Phaser.GameObjects.Graphics | null = null;
  private actions: Actions = { kill: null, killWaitS: 0, isImpostor: false, carry: null, report: null, emergency: false, task: null };
  private myTasks: TaskView[] = [];
  private lastTasksKey = "";
  /** Puntos de la ruta a la misión más cercana (se reutilizan). */
  private routeDots: Phaser.GameObjects.Image[] = [];
  /** Pasos hechos por misión en la última lectura (para celebrar los nuevos). */
  private lastProgress: Map<string, number> | null = null;
  private riverTimer = 0;
  /** Edificios que pueden tapar al personaje (se vuelven translúcidos si lo tapan). */
  private occluders: { image: Phaser.GameObjects.Image; baseY: number }[] = [];
  /** Tiempo de preparar el mapa al entrar (ms, para pruebas de rendimiento). */
  private buildMs = 0;
  private ambience!: Ambience;
  /** Anillo que señala el lugar más cercano. */
  private ring!: Phaser.GameObjects.Ellipse;
  /** Lugar tocado en el mapa: muestra su nombre un rato. */
  private selected: { poi: PoiView; until: number } | null = null;
  private routeTimer = 0;
  private practiceCelebrated = false;
  private minimapTimer = 0;
  private inMiniGame = false;
  private closeMiniGame: (() => void) | null = null;
  /** Ruta que sigue el piloto automático de pruebas (como si se usara el joystick). */
  private autopilot: Vec2[] = [];
  /** Modo en solitario (sin servidor): práctica de todas las misiones, solo en este dispositivo. */
  private practice: PracticeTask[] = [];

  constructor() {
    super("TownScene");
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_SIZE.width, WORLD_SIZE.height);
    this.cameras.main.setBackgroundColor("#55603c");
    registerArt(this);
    const t0 = performance.now();
    this.town = new TownRenderer(this);
    const decor = placeDecor(this);
    this.occluders = placeOccluders(this);
    this.buildMs = Math.round(performance.now() - t0);
    this.ambience = createAmbience(this, { decor });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ambience.destroy());
    this.drawPoints();
    this.ring = this.add.ellipse(0, 0, 54, 22).setStrokeStyle(3, 0xf3ead6, 0.9).setDepth(9).setVisible(false);
    if (!REDUCED_MOTION) this.tweens.add({ targets: this.ring, scale: 1.18, alpha: 0.45, duration: 800, yoyo: true, repeat: -1 });

    const spawn = defaultSpawn();
    const name = (this.registry.get("playerName") as string) || "Tú";
    const look = (this.registry.get("look") as number) ?? 0;
    this.player = new Character(this, spawn.x, spawn.y, name, PALETTE[look % PALETTE.length]);
    this.player.setDepth(20 + spawn.y / 100000);
    this.player.on("paso", () => sfx.pisada(0.5));
    this.session = (this.registry.get("session") as NetSession | null) ?? null;

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (!REDUCED_MOTION) this.cameras.main.fadeIn(450, 23, 37, 31);
    this.applyZoom();
    this.scale.on("resize", this.applyZoom, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.applyZoom, this));

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,E,Q,F,C,X") as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on("down", () => this.interact());
    this.keys.Q.on("down", () => this.doAction("eliminar"));
    this.keys.F.on("down", () => this.doAction("reportar"));
    this.keys.C.on("down", () => this.doAction("llevar"));
    this.keys.X.on("down", () => this.doAction("emergencia"));

    if (this.session) this.bindSession(this.session);
    else {
      // Sin sala: se explora el mapa y se practican todas las misiones activas
      this.practice = pickTasks(Math.random, ACTIVE_MISSIONS.length).map((t) => ({ ...t, done: false }));
      this.phase = "partida";
      music.setPhase("partida");
    }
    this.scene.launch("UIScene");
    const ui = this.scene.get("UIScene");
    ui.events.on("interact", () => this.interact());
    ui.events.on("action", (kind: ActionKind) => this.doAction(kind));
    ui.events.on("start-game", () => this.session?.send("empezar"));
    this.game.events.on("ui-ready", () => {
      this.emitRoomInfo();
      this.game.events.emit("phase", this.phase);
      this.lastActions = "";
      if (this.roleShown && this.me?.role) this.game.events.emit("my-role", this.me.role);
    });

    // Permite a las pruebas automáticas leer el estado sin acceder a internos.
    (window as unknown as { __laRoda?: unknown }).__laRoda = {
      player: () => ({ x: this.player.x, y: this.player.y }),
      teleport: (x: number, y: number) => this.player.setPosition(x, y),
      nearestPoi: () => this.nearest?.poi.name ?? null,
      goToPoi: (n: number) => {
        const p = this.pois.find((v) => v.poi.number === n);
        if (p) {
          this.player.setPosition(p.access.x, p.access.y);
          this.cameras.main.centerOn(p.access.x, p.access.y);
        }
        return !!p;
      },
      panelOpen: () => (this.scene.get("UIScene") as unknown as { isPanelOpen(): boolean }).isPanelOpen(),
      chunks: () => this.town.chunkCount,
      occluders: () => this.occluders.length,
      buildMs: () => this.buildMs,
      // (bakeTimes se declara en mapRenderer.ts, todavía sin tipar)
      bakeTimes: () => [...(this.town as unknown as { bakeTimes: number[] }).bakeTimes],
      walkable: () => isWalkable({ x: this.player.x, y: this.player.y }, PLAYER_RADIUS),
      remotes: () => [...this.remotes.values()].map((r) => ({ name: r.info.name, x: r.view.x, y: r.view.y, connected: r.info.connected })),
      code: () => this.session?.code ?? null,
      phase: () => this.phase,
      role: () => this.me?.role ?? null,
      roleShown: () => this.roleShown,
      tasks: () => this.myTasks.map((t) => ({ ...t })),
      taskHere: () => this.taskHere()?.missionId ?? null,
      inMiniGame: () => this.inMiniGame,
      walkTo: (n: number) => {
        const poi = this.pois.find((p) => p.poi.number === n);
        if (poi) this.autopilot = findPath({ x: this.player.x, y: this.player.y }, poi.access).points.slice(1);
        return !!poi;
      },
      walking: () => this.autopilot.length > 0,
      // solo en desarrollo: marcar la práctica como hecha para probar el aviso final
      ...(import.meta.env.DEV
        ? {
            completePractice: () =>
              this.practice.forEach((t) => {
                t.step = t.lugares.length;
                t.done = true;
              }),
          }
        : {}),
      routeLength: (n: number) => {
        const poi = this.pois.find((p) => p.poi.number === n);
        return poi ? findPath({ x: this.player.x, y: this.player.y }, poi.access).length : Infinity;
      },
      labelsVisible: () => this.pois.filter((p) => p.label.visible).length,
      townProgress: () => ({ done: this.session?.state.tasksDone ?? 0, total: this.session?.state.tasksTotal ?? 0 }),
      clockErrorMs: () => (this.session ? this.session.serverNow() - Date.now() : null),
      alive: () => this.me?.alive ?? null,
      actions: () => ({ ...this.actions }),
      bodies: () => [...this.bodies.keys()],
      act: (kind: ActionKind) => this.doAction(kind),
      start: () => this.session?.send("empezar"),
      vote: (target: string) => this.session?.send("votar", { target }),
      sessionId: () => this.session?.sessionId ?? null,
      remoteIds: () => [...this.remotes.entries()].map(([id, r]) => ({ id, name: r.info.name, alive: r.info.alive, visible: r.view.visible })),
    };
  }

  update(time: number, delta: number) {
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;
    if (input.joystick.active) {
      x = input.joystick.x;
      y = input.joystick.y;
    } else if (this.autopilot.length) {
      const t = this.autopilot[0];
      const dx = t.x - this.player.x;
      const dy = t.y - this.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) this.autopilot.shift();
      else {
        // al acercarse al punto se frena para no pasarse en un solo fotograma
        const k = Math.min(1, d / Math.max(1e-6, this.speed * (Math.min(this.game.loop.delta, 100) / 1000)));
        x = (dx / d) * k;
        y = (dy / d) * k;
      }
    }

    // durante reuniones, resultados y minijuegos nadie se mueve
    if (this.phase === "reunion" || this.phase === "resultado" || this.inMiniGame) x = y = 0;
    const len = Math.hypot(x, y);
    const dt = Math.min(delta, 100) / 1000; // evita saltos tras una pausa de pestaña
    const prev = { x: this.player.x, y: this.player.y };
    if (len > 0) {
      const k = (this.speed * dt * Math.min(1, len)) / len;
      const next = moveAlongStreets(prev, { x: x * k, y: y * k }, PLAYER_RADIUS);
      this.player.setPosition(next.x, next.y);
    }
    this.player.animate((this.player.x - prev.x) / dt, (this.player.y - prev.y) / dt, delta);
    if (this.session && this.serverSpawnApplied) this.session.sendPosition(this.player.x, this.player.y, this.time.now);
    this.updateRemotes(delta);
    this.updateNearestPoi();
    this.updateTasks(delta);
    this.updateActions();
    this.town.update(this.cameras.main);
    this.ambience.update(time, delta, this.cameras.main);
    this.fadeOccluders();

    // sonido del río: más fuerte cuanto más cerca (se mide cada 0,3 s)
    this.riverTimer -= delta;
    if (this.riverTimer <= 0) {
      this.riverTimer = 300;
      let best = Infinity;
      for (const line of riverLines) {
        for (let i = 1; i < line.length; i++) {
          const a = line[i - 1];
          const b = line[i];
          const ex = b.x - a.x;
          const ey = b.y - a.y;
          const len2 = ex * ex + ey * ey || 1;
          const u = Phaser.Math.Clamp(((this.player.x - a.x) * ex + (this.player.y - a.y) * ey) / len2, 0, 1);
          best = Math.min(best, Math.hypot(this.player.x - a.x - ex * u, this.player.y - a.y - ey * u));
        }
      }
      ambient.setNearWater(Phaser.Math.Clamp(1 - (best - RIVER_WIDTH / 2) / 260, 0, 1));
    }
  }

  private bindSession(session: NetSession) {
    const me = session.sessionId;
    // las pantallas deben existir antes de enlazar: al reconectar en mitad de una
    // reunión, el estado llega enseguida y hay que poder mostrarla
    this.dom = new Overlays();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dom?.destroy());
    session.bind({
      onAdd: (p) => {
        if (p.id === me) {
          // posición inicial decidida por el servidor
          this.player.setPosition(p.x, p.y);
          this.player.setDisplayName(p.name);
          this.player.setLook(PALETTE[p.look % PALETTE.length]);
          this.serverSpawnApplied = true;
          this.me = p;
        } else {
          const view = new Character(this, p.x, p.y, p.name, PALETTE[p.look % PALETTE.length]);
          this.remotes.set(p.id, { view, target: { x: p.x, y: p.y }, info: p });
          this.applyVisibility(p.id);
        }
        this.emitRoomInfo();
      },
      onChange: (p) => {
        if (p.id === me) {
          const wasAlive = this.me?.alive;
          this.me = p;
          this.player.setDisplayName(p.alive ? p.name : `👻 ${p.name}`);
          this.player.setAlpha(p.alive ? 1 : 0.5);
          if (wasAlive !== p.alive) for (const id of this.remotes.keys()) this.applyVisibility(id);
          this.maybeShowRole();
        } else {
          const r = this.remotes.get(p.id);
          if (r) {
            r.target = { x: p.x, y: p.y };
            r.info = p;
            r.view.setDisplayName(`${p.alive ? "" : "👻 "}${p.name}${p.connected ? "" : " (sin conexión)"}`);
            this.applyVisibility(p.id);
          }
        }
        this.emitRoomInfo();
        if (this.phase === "reunion") this.refreshMeeting();
      },
      onRemove: (id) => {
        this.remotes.get(id)?.view.destroy();
        this.remotes.delete(id);
        this.emitRoomInfo();
      },
      onCorrected: (pos) => this.player.setPosition(pos.x, pos.y),
      onStatus: (status) => this.game.events.emit("net-status", status),
      onPhase: (phase) => this.onPhase(phase),
      onBodyAdd: (b) => this.addBody(b),
      onBodyRemove: (id) => {
        this.bodies.get(id)?.view.destroy();
        this.bodies.delete(id);
      },
      onDenied: (d) => this.game.events.emit("toast", d.reason),
      onVoteResult: (v) => {
        const names: Record<string, string> = {};
        session.state.players.forEach((p, id) => (names[id] = p.name));
        sfx.expulsion();
        this.dom?.showVoteResult(v, names);
      },
      onGameOver: (g) => {
        const mine = g.roles.find((r) => r.id === session.sessionId);
        const won = !!mine && teamOf(mine.role as Role) === g.winner;
        sfx.fin(won);
        music.setPhase(won ? "fin" : "derrota");
        this.dom?.showGameOver(g, session.sessionId, session.state.hostId === session.sessionId, () => session.send("volver"));
      },
    });
  }

  // ---------------------------------------------------------------- partida

  private isImpostorRole(role: string | undefined) {
    return !!role && teamOf(role as Role) === "impostores";
  }

  /** Los vivos no ven a los fantasmas; los fantasmas lo ven todo. */
  private applyVisibility(id: string) {
    const r = this.remotes.get(id);
    if (!r) return;
    const iAmGhost = this.me ? !this.me.alive : false;
    r.view.setVisible(r.info.alive || iAmGhost);
    r.view.setAlpha(r.info.alive ? (r.info.connected ? 1 : 0.45) : 0.4);
  }

  private onPhase(phase: string) {
    music.setPhase(phase);
    const prev = this.phase;
    this.phase = phase;
    if (phase !== "partida") this.closeMiniGame?.();
    this.game.events.emit("phase", phase);
    this.emitRoomInfo();
    if (phase === "partida" && prev === "sala") {
      this.roleShown = false;
      this.maybeShowRole();
    }
    if (phase === "reunion") {
      sfx.campana();
      if (!REDUCED_MOTION) this.cameras.main.flash(250, 255, 240, 220);
      const st = this.session!.state;
      this.dom?.showMeeting({
        reason: st.meetingReason,
        caller: st.meetingCaller,
        victim: st.meetingVictim,
        endsAt: () => Date.now() + (st.phaseEndsAt - this.session!.serverNow()),
        amAlive: !!this.me?.alive,
        onVote: (target) => {
          sfx.voto();
          this.session?.send("votar", { target });
        },
      });
      this.refreshMeeting();
    } else {
      this.dom?.closeMeeting();
    }
    if (phase === "sala") {
      this.dom?.clear();
      for (const id of this.remotes.keys()) this.applyVisibility(id);
    }
  }

  private maybeShowRole() {
    if (this.roleShown || this.phase !== "partida" || !this.me?.role) return;
    this.roleShown = true;
    let partner: string | null = null;
    if (this.isImpostorRole(this.me.role)) {
      for (const r of this.remotes.values()) if (this.isImpostorRole(r.info.role)) partner = r.info.name;
    }
    this.dom?.showRole(this.me.role, partner);
    sfx.rol();
    this.game.events.emit("my-role", this.me.role);
  }

  private refreshMeeting() {
    if (!this.session) return;
    const list: MeetingPlayer[] = [];
    this.session.state.players.forEach((p, id) =>
      list.push({ id, name: p.name, look: p.look, alive: p.alive, hasVoted: p.hasVoted, isMe: id === this.session!.sessionId }),
    );
    this.dom?.updateMeeting(list, !!this.me?.alive);
  }

  /** Cuerpo tendido en el suelo con una cruz encima. */
  private addBody(b: Body) {
    const look = PALETTE[b.look % PALETTE.length];
    const figure = new Character(this, 0, 0, "", look).lieDown();
    const mark = this.add.text(0, -30, "✝", { fontSize: "18px", color: "#ffffff", stroke: "#1b1b1b", strokeThickness: 4 }).setOrigin(0.5);
    const view = this.add.container(b.x, b.y, [figure, mark]).setDepth(15);
    sfx.eliminar();
    if (!REDUCED_MOTION) {
      view.setScale(0.2).setAlpha(0);
      this.tweens.add({ targets: view, scale: 1, alpha: 1, duration: 320, ease: "Back.Out" });
      this.cameras.main.shake(180, 0.004);
    }
    this.bodies.set(b.id, { view, data: b });
  }

  /** Si un edificio tapa al propio personaje (está detrás de él), se vuelve translúcido. */
  private fadeOccluders() {
    const px = this.player.x;
    const py = this.player.y;
    for (const o of this.occluders) {
      const img = o.image;
      const left = img.x;
      const top = img.y;
      const right = left + img.displayWidth;
      const bottom = top + img.displayHeight;
      const hides = py < o.baseY && px > left + 6 && px < right - 6 && py - 50 > top && py - 50 < bottom;
      const target = hides ? 0.45 : 1;
      const diff = target - img.alpha;
      if (diff !== 0) img.setAlpha(Math.abs(diff) < 0.03 ? target : img.alpha + diff * 0.25);
    }
  }

  /** Calcula qué acciones están al alcance y avisa a la interfaz si cambian. */
  private updateActions() {
    const a: Actions = { kill: null, killWaitS: 0, isImpostor: false, carry: null, report: null, emergency: false, task: null };
    if (((this.session && this.me) || !this.session) && this.phase === "partida") a.task = this.taskHere()?.missionId ?? null;
    const me = this.me;
    if (this.session && me && me.alive && this.phase === "partida") {
      const pos = { x: this.player.x, y: this.player.y };
      const near = (q: Vec2, r: number) => Math.hypot(q.x - pos.x, q.y - pos.y) <= r;
      a.isImpostor = this.isImpostorRole(me.role);
      if (a.isImpostor) {
        a.killWaitS = Math.max(0, Math.ceil((me.killReadyAt - this.session.serverNow()) / 1000));
        let best = Infinity;
        for (const [id, r] of this.remotes) {
          if (!r.info.alive || this.isImpostorRole(r.info.role)) continue;
          const d = Math.hypot(r.target.x - pos.x, r.target.y - pos.y);
          if (d <= RULES.killRange && d < best) {
            best = d;
            a.kill = id;
          }
        }
      }
      for (const [id, b] of this.bodies) {
        if (near(b.data, RULES.reportRange)) a.report = id;
        if (me.role === "gitano" && near(b.data, RULES.carryRange)) a.carry = id;
      }
      // reunión de emergencia: en el Ayuntamiento (n.º 11) o, para Vilchez, en cualquier sitio
      const hall = this.pois.find((p) => p.poi.number === 11);
      a.emergency = (!!hall && near(hall.access, RULES.emergencyRange) && me.emergenciesLeft > 0) || (me.role === "vilchez" && me.specialLeft);
    }
    this.actions = a;
    // Aro bajo la víctima posible (solo lo ve el impostor)
    const target = a.kill ? this.remotes.get(a.kill) : null;
    if (target) {
      if (!this.killRing) this.killRing = this.add.graphics().setDepth(5);
      const ready = a.killWaitS === 0;
      this.killRing
        .clear()
        .lineStyle(4, 0xe0412f, ready ? 0.95 : 0.4)
        .strokeEllipse(0, 0, 54, 22)
        .setPosition(target.view.x, target.view.y + 2)
        .setVisible(true);
    } else this.killRing?.setVisible(false);
    const key = JSON.stringify(a);
    if (key !== this.lastActions) {
      this.lastActions = key;
      this.game.events.emit("actions", a);
    }
  }

  /** Lee mis misiones del estado sincronizado, marca los lugares y dibuja la ruta. */
  private updateTasks(delta: number) {
    const s = this.session;
    const mine: { tasks?: Iterable<TaskStateView> } | undefined = s
      ? s.state.players?.get(s.sessionId)
      : { tasks: this.practice.map((t) => ({ ...t, lugares: t.lugares.join(","), steps: t.lugares.length })) };
    const list: TaskView[] = [];
    if (mine?.tasks && this.phase !== "sala") {
      for (const t of mine.tasks) {
        const m = missionById(t.missionId);
        const lugares = String(t.lugares).split(",").map(Number);
        const lugar = lugares[Math.min(t.step, lugares.length - 1)];
        const poi = this.pois.find((p) => p.poi.number === lugar);
        list.push({
          missionId: t.missionId,
          nombre: m?.nombre ?? t.missionId,
          lugar,
          lugarNombre: poi?.poi.name ?? `n.º ${lugar}`,
          step: t.step,
          steps: t.steps,
          done: t.done,
        });
      }
    }
    this.myTasks = list;
    const doneCount = s ? s.state.tasksDone : list.reduce((n, t) => n + t.step, 0);
    const totalCount = s ? s.state.tasksTotal : list.reduce((n, t) => n + t.steps, 0);
    const key = JSON.stringify([list, doneCount, totalCount]);
    if (key !== this.lastTasksKey) {
      this.lastTasksKey = key;
      // ¿algún paso nuevo hecho? se celebra (no en la primera lectura)
      const progress = new Map(list.map((t) => [t.missionId, t.done ? t.steps : t.step]));
      if (this.lastProgress) {
        for (const t of list) {
          const before = this.lastProgress.get(t.missionId) ?? 0;
          if ((progress.get(t.missionId) ?? 0) > before) {
            this.game.events.emit("task-done", { nombre: t.nombre, done: t.done, lugar: t.lugarNombre });
            this.player.celebrate();
          }
        }
      }
      this.lastProgress = progress;
      const pending = new Set(list.filter((t) => !t.done).map((t) => t.lugar));
      for (const p of this.pois) p.bubble.setVisible(pending.has(p.poi.number));
      const info: TasksInfo = { list, done: doneCount, total: totalCount, practice: !s };
      this.game.events.emit("tasks", info);
    }
    // nombres de lugares: solo el más cercano y el que se haya tocado (evita el amontonamiento)
    const zoom = this.cameras.main.zoom;
    if (this.selected && this.time.now > this.selected.until) this.selected = null;
    for (const p of this.pois) {
      const show = p === this.nearest || p === this.selected?.poi;
      if (p.label.visible !== show) p.label.setVisible(show);
      if (show) p.label.setScale(1 / zoom);
    }
    // práctica completa
    if (!s && !this.practiceCelebrated && list.length > 0 && list.every((t) => t.done)) {
      this.practiceCelebrated = true;
      sfx.fin(true);
      this.game.events.emit("toast", "¡Has completado todas las misiones de práctica!");
    }
    // minimapa: yo y los lugares de mis misiones pendientes
    this.minimapTimer -= delta;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 120;
      const targets = list
        .filter((t) => !t.done)
        .map((t) => this.pois.find((p) => p.poi.number === t.lugar)?.world)
        .filter((w): w is Vec2 => !!w);
      this.game.events.emit("minimap", { me: { x: this.player.x, y: this.player.y }, targets });
    }
    // ruta a la misión pendiente más cercana (se recalcula cada 0,6 s)
    this.routeTimer -= delta;
    if (this.routeTimer > 0) return;
    this.routeTimer = 600;
    const dots: Vec2[] = [];
    if (this.phase === "partida") {
      const here = { x: this.player.x, y: this.player.y };
      let best: Path | null = null;
      for (const t of list) {
        if (t.done) continue;
        const poi = this.pois.find((p) => p.poi.number === t.lugar);
        if (!poi) continue;
        const path = findPath(here, poi.access);
        if (!best || path.length < best.length) best = path;
      }
      if (best && best.length > MISSION_RANGE) {
        // puntos cada 30 px a lo largo de la ruta (como mucho 120)
        let acc = 0;
        for (let i = 1; i < best.points.length && dots.length < 120; i++) {
          const a = best.points[i - 1];
          const b = best.points[i];
          const segLen = Math.hypot(b.x - a.x, b.y - a.y);
          for (let d = (30 - acc) % 30; d < segLen; d += 30) dots.push({ x: a.x + ((b.x - a.x) * d) / segLen, y: a.y + ((b.y - a.y) * d) / segLen });
          acc = (acc + segLen) % 30;
        }
      }
    }
    while (this.routeDots.length < dots.length) this.routeDots.push(addProp(this, "punto", 0, 0).setDepth(8));
    this.routeDots.forEach((dot, i) => {
      if (i < dots.length) dot.setPosition(dots[i].x, dots[i].y).setVisible(true);
      else dot.setVisible(false);
    });
  }

  private taskHere(): TaskView | null {
    for (const t of this.myTasks) {
      if (t.done) continue;
      const poi = this.pois.find((p) => p.poi.number === t.lugar);
      if (poi && Math.hypot(poi.access.x - this.player.x, poi.access.y - this.player.y) <= MISSION_RANGE * 0.9) return t;
    }
    return null;
  }

  private startTask(t: TaskView) {
    const s = this.session;
    const step = missionById(t.missionId)?.pasos[t.step];
    if (!step || this.inMiniGame) return;
    s?.send("tarea-inicio", { mission: t.missionId });
    this.inMiniGame = true;
    const started = Date.now();
    sfx.abrir();
    this.closeMiniGame = openMiniGame({
      title: t.steps > 1 ? `${t.nombre} (${t.step + 1}/${t.steps})` : t.nombre,
      text: step.texto,
      game: step.juego,
      minMs: step.minMs,
      missionId: t.missionId,
      onDone: () => {
        // el servidor exige un tiempo mínimo: si el minijuego fue más rápido, se espera
        const wait = Math.max(0, step.minMs - (Date.now() - started) + 150);
        window.setTimeout(() => {
          if (s) {
            sfx.mision();
            return s.send("tarea-fin", { mission: t.missionId });
          }
          const local = this.practice.find((x) => x.missionId === t.missionId);
          if (local && !local.done) {
            local.step++;
            local.done = local.step >= local.lugares.length;
            if (local.done) sfx.mision();
            else sfx.paso();
          }
        }, wait);
      },
      onClose: () => {
        sfx.cerrar();
        this.inMiniGame = false;
        this.closeMiniGame = null;
      },
    });
  }

  private doAction(kind: ActionKind) {
    const s = this.session;
    const a = this.actions;
    if (!s) return;
    if (kind === "eliminar" && a.kill) s.send("eliminar", { target: a.kill });
    if (kind === "reportar" && a.report) {
      sfx.reporte();
      s.send("reportar", { body: a.report });
    }
    if (kind === "llevar" && a.carry) s.send("llevar", { body: a.carry });
    if (kind === "emergencia" && a.emergency) s.send("emergencia");
  }

  /** Interpolación suave de los demás jugadores hacia su última posición conocida. */
  private updateRemotes(delta: number) {
    const k = 1 - Math.exp(-delta / 70);
    for (const r of this.remotes.values()) {
      const px = r.view.x;
      const py = r.view.y;
      r.view.setPosition(px + (r.target.x - px) * k, py + (r.target.y - py) * k);
      r.view.animate(((r.view.x - px) * 1000) / Math.max(delta, 1), ((r.view.y - py) * 1000) / Math.max(delta, 1), delta);
    }
    this.stackNames();
  }

  /** Si varios personajes están juntos, apila sus nombres para que se lean todos. */
  private stackNames() {
    const chars = [this.player, ...[...this.remotes.values()].map((r) => r.view)].filter((c) => c.visible);
    chars.sort((a, b) => a.y - b.y || a.x - b.x);
    const placed: { x: number; y: number; w: number }[] = [];
    for (const c of chars) {
      let lift = 0;
      for (let tries = 0; tries < 12; tries++) {
        const y = c.y - 30 - lift;
        const clash = placed.some((p) => Math.abs(p.x - c.x) < (p.w + c.nameWidth) / 2 + 4 && Math.abs(p.y - y) < 16);
        if (!clash) break;
        lift += 16;
      }
      c.setNameLift(lift);
      placed.push({ x: c.x, y: c.y - 30 - lift, w: c.nameWidth });
    }
  }

  private emitRoomInfo() {
    if (!this.session) return;
    const players: { name: string; isHost: boolean; connected: boolean; isMe: boolean; alive: boolean }[] = [];
    this.session.room.state.players?.forEach((p, id) =>
      players.push({ name: p.name, isHost: p.isHost, connected: p.connected, isMe: id === this.session!.sessionId, alive: p.alive }),
    );
    this.game.events.emit("room-info", {
      code: this.session.code,
      players,
      phase: this.phase,
      isHost: this.session.state.hostId === this.session.sessionId,
      minPlayers: RULES.minPlayers,
    });
  }

  private applyZoom() {
    // En pantallas pequeñas se aleja un poco la cámara para ver los cruces cercanos.
    const short = Math.min(this.scale.width, this.scale.height);
    this.cameras.main.setZoom(Phaser.Math.Clamp(short / 520, 0.78, 1.2));
  }

  /** Marcadores de los lugares del dibujo, con su aviso de misión y su nombre. */
  private drawPoints() {
    for (const poi of pointsOfInterest) {
      if (!poi.trace) continue;
      const world = traceToWorld(poi.trace);
      const access = nearestWalkable(world, PLAYER_RADIUS);
      const marker = addProp(this, "marcador", world.x, world.y, 0.9).setDepth(19);
      const bubble = addProp(this, "aviso", world.x, world.y - 34, 0.9).setDepth(19).setVisible(false);
      if (!REDUCED_MOTION) {
        this.tweens.add({ targets: bubble, y: world.y - 40, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: Math.random() * 700 });
      }
      const label = this.add
        .text(world.x, world.y - 96, poi.name, {
          fontFamily: "Nunito, system-ui, Arial, sans-serif",
          fontSize: "15px",
          fontStyle: "bold",
          color: "#f3ead6",
          backgroundColor: "rgba(24,17,13,0.84)",
          padding: { x: 9, y: 4 },
        })
        .setOrigin(0.5, 1)
        .setDepth(60)
        .setVisible(false);
      // línea discreta hasta la calle si el local queda dentro de la manzana
      if (Math.hypot(access.x - world.x, access.y - world.y) > 18) {
        this.add.line(0, 0, world.x, world.y, access.x, access.y, 0xf3ead6, 0.5).setOrigin(0).setLineWidth(2).setDepth(9);
      }
      const view: PoiView = { poi, world, access, marker, label, bubble };
      // tocar el marcador muestra el nombre del lugar durante 3 s
      marker.setInteractive({ useHandCursor: true }).on("pointerdown", () => (this.selected = { poi: view, until: this.time.now + 3000 }));
      this.pois.push(view);
    }
  }

  private updateNearestPoi() {
    let best: PoiView | null = null;
    let bestD = INTERACT_DISTANCE;
    for (const p of this.pois) {
      const d = Math.hypot(p.access.x - this.player.x, p.access.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best !== this.nearest) {
      if (best) this.ring.setPosition(best.world.x, best.world.y + 2).setVisible(true);
      else this.ring.setVisible(false);
      this.nearest = best;
      this.game.events.emit("poi-near", best?.poi ?? null);
    }
  }

  private interact() {
    const t = this.phase === "partida" ? this.taskHere() : null;
    if (t) return this.startTask(t);
    if (this.nearest) this.game.events.emit("poi-open", this.nearest.poi);
  }
}
