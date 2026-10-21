import Phaser from "phaser";
import { Minimap } from "./minimap";
import { Card, FONT, THEME, roundButton, type RoundButtonDraw } from "./theme";
import { sfx } from "./sounds";
import { openAudioPanel } from "../ui/audioPanel";
import { fullscreenSupported, toggleFullscreen } from "../ui/fullscreen";
import { ROLE_INFO } from "../../shared/game/rules";
import { input } from "./inputState";
import type { ActionKind, Actions, TaskView, TasksInfo } from "./TownScene";
import type { PointOfInterest } from "../../shared/data/pointsOfInterest";

const JOY_RADIUS = 52;
const JOY_DEADZONE = 10;

type ActionButton = { c: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Graphics };

type RoomInfo = {
  code: string;
  players: { name: string; isHost: boolean; connected: boolean; isMe: boolean; alive?: boolean }[];
  phase?: string;
  isHost?: boolean;
  minPlayers?: number;
};

/**
 * Interfaz superpuesta, sin zoom de cámara: joystick táctil, botón de acción,
 * botones de partida, sala, misiones, minimapa y panel de los puntos de interés.
 * Se recoloca al cambiar el tamaño de la ventana (móvil en vertical u horizontal).
 */
export class UIScene extends Phaser.Scene {
  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private joyPointerId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private actionBtn!: Phaser.GameObjects.Container;
  private actionDraw!: RoundButtonDraw;
  private actionLabel!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
  private panelBody!: Phaser.GameObjects.Text;
  private header!: Phaser.GameObjects.Container;
  private roomBox!: Phaser.GameObjects.Container;
  private roomTitle!: Phaser.GameObjects.Text;
  private roomList!: Phaser.GameObjects.Text;
  private roomBg!: Card;
  private toast!: Phaser.GameObjects.Text;
  private roomCode = "";
  private roomHint!: Phaser.GameObjects.Text;
  private actionButtons = {} as Record<ActionKind, ActionButton>;
  private startBtn!: Phaser.GameObjects.Container;
  private startLabel!: Phaser.GameObjects.Text;
  private startBg!: Card;
  private canStart = false;
  private roleTag!: Phaser.GameObjects.Text;
  private nearPoiName: string | null = null;
  private taskAvailable = false;
  private tasksBox!: Phaser.GameObjects.Container;
  private tasksText!: Phaser.GameObjects.Text;
  private tasksBg!: Card;
  private tasksHit!: Phaser.GameObjects.Zone;
  private progressBg!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private minimap!: Minimap;
  private tasksCollapsed = false;
  private lastTasks: TasksInfo | null = null;
  private soundBtn!: Phaser.GameObjects.Container;
  private fsBtn: Phaser.GameObjects.Container | null = null;
  private soundIcon!: Phaser.GameObjects.Image;
  private toastBg!: Card;

  constructor() {
    super("UIScene");
  }

  create() {
    this.input.addPointer(2);
    this.buildHeader();
    this.buildJoystick();
    this.buildActionButton();
    this.buildPanel();
    this.buildRoomBox();
    this.buildActionBar();
    this.buildStartButton();
    this.buildTasksBox();
    this.tasksCollapsed = this.scale.width < 520 || this.scale.height < 520; // en móvil (vertical u horizontal) la lista empieza plegada
    this.minimap = new Minimap(this);
    this.events.on("minimap-resized", () => this.layout());

    // botón de sonido: abre el panel de volumen
    const sound = roundButton(this, 20, sfx.muted ? "icono-silencio" : "icono-sonido");
    this.soundIcon = sound.icon;
    this.soundBtn = this.add.container(0, 0, [sound.g, sound.icon]).setDepth(10).setSize(40, 40);
    this.soundBtn
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () =>
        openAudioPanel({ onMuteChange: (muted: boolean) => this.soundIcon.setTexture(muted ? "icono-silencio" : "icono-sonido") }),
      );

    // botón de pantalla completa (si el navegador lo permite)
    if (fullscreenSupported()) {
      const fs = roundButton(this, 20, "icono-pantalla");
      this.fsBtn = this.add.container(0, 0, [fs.g, fs.icon]).setDepth(10).setSize(40, 40);
      this.fsBtn.setInteractive({ useHandCursor: true }).on("pointerup", () => void toggleFullscreen());
    }

    this.roleTag = this.add
      .text(0, 0, "", { fontFamily: FONT, fontSize: "14px", fontStyle: "bold", color: "#fff", backgroundColor: "#2f7d6b", padding: { x: 12, y: 6 } })
      .setOrigin(0.5, 0)
      .setDepth(10)
      .setVisible(false);
    this.layout();
    this.scale.on("resize", this.layout, this);
    this.game.events.on("poi-near", this.onPoiNear, this);
    this.game.events.on("poi-open", this.openPanel, this);
    this.game.events.on("room-info", this.onRoomInfo, this);
    this.game.events.on("net-status", this.onNetStatus, this);
    this.game.events.on("actions", this.onActions, this);
    this.game.events.on("toast", this.onToast, this);
    this.game.events.on("my-role", this.onMyRole, this);
    this.game.events.on("phase", this.onPhase, this);
    this.game.events.on("tasks", this.onTasks, this);
    this.game.events.on("minimap", this.onMinimap, this);
    this.game.events.on("task-done", this.onTaskDone, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
      this.game.events.off("poi-near", this.onPoiNear, this);
      this.game.events.off("poi-open", this.openPanel, this);
      this.game.events.off("room-info", this.onRoomInfo, this);
      this.game.events.off("net-status", this.onNetStatus, this);
      this.game.events.off("actions", this.onActions, this);
      this.game.events.off("toast", this.onToast, this);
      this.game.events.off("my-role", this.onMyRole, this);
      this.game.events.off("phase", this.onPhase, this);
      this.game.events.off("tasks", this.onTasks, this);
      this.game.events.off("minimap", this.onMinimap, this);
      this.game.events.off("task-done", this.onTaskDone, this);
    });
    // la escena del mundo se enlazó antes que esta: que repita el estado actual
    this.game.events.emit("ui-ready");
  }

  /** Botones de acción de partida (aparecen solo cuando están al alcance). */
  private buildActionBar() {
    const make = (key: ActionKind, icon: string, text: string, color: number) => {
      const button = roundButton(this, 34, `icono-${icon}`, color);
      button.draw(THEME.panel, THEME.panelAlpha, color, 1);
      const bg = button.g;
      const label = this.add
        .text(0, 40, text, { fontFamily: FONT, fontSize: "12px", fontStyle: "bold", color: THEME.text, stroke: "#15100c", strokeThickness: 4 })
        .setOrigin(0.5, 0);
      const c = this.add.container(0, 0, [bg, button.icon, label]).setDepth(11).setVisible(false).setSize(68, 68);
      c.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        sfx.tap();
        this.events.emit("action", key);
      });
      this.actionButtons[key] = { c, label, bg };
    };
    make("eliminar", "cuchillo", "Eliminar (Q)", THEME.danger);
    make("llevar", "cesta", "Llevarse (C)", 0x8a5cc2);
    make("reportar", "megafono", "Reportar (F)", THEME.accent);
    make("emergencia", "campana", "Reunión (X)", 0x5c97ff);
  }

  private onActions(a: Actions) {
    this.taskAvailable = !!a.task;
    this.refreshActionButton();
    const b = this.actionButtons;
    b.eliminar.c.setVisible(a.isImpostor);
    const killReady = !!a.kill && a.killWaitS === 0;
    b.eliminar.bg.setAlpha(killReady ? 1 : 0.4);
    b.eliminar.label.setText(a.killWaitS > 0 ? `Espera ${a.killWaitS} s` : a.kill ? "Eliminar (Q)" : "Nadie cerca");
    b.llevar.c.setVisible(!!a.carry);
    b.reportar.c.setVisible(!!a.report);
    b.emergencia.c.setVisible(a.emergency);
    this.layoutActions();
  }

  /** Apila hacia arriba, encima del botón de acción, los botones visibles. */
  private layoutActions() {
    const { width, height } = this.scale;
    // Pantallas bajas (móvil en horizontal): en fila, a la izquierda del botón de la mano,
    // para no quedar debajo del minimapa. Pantallas altas: en columna encima.
    const row = height < 600;
    let x = width - 46 - 30 - 110;
    let y = height - 46 - 46 - 168;
    for (const key of ["eliminar", "llevar", "reportar", "emergencia"] as const) {
      const btn = this.actionButtons[key].c;
      if (!btn.visible) continue;
      if (row) {
        btn.setPosition(x, height - 46 - 46 + 4);
        x -= 92;
      } else {
        btn.setPosition(width - 46 - 30, y);
        y -= 100;
      }
    }
  }

  private buildStartButton() {
    this.startBg = new Card(this, 26, THEME.accent, 1).setCardSize(270, 52).setPosition(-135, -26);
    this.startLabel = this.add.text(0, 0, "", { fontFamily: FONT, fontSize: "17px", fontStyle: "900", color: "#1b120c" }).setOrigin(0.5);
    this.startBtn = this.add.container(0, 0, [this.startBg, this.startLabel]).setDepth(12).setVisible(false).setSize(270, 52);
    this.startBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      if (this.canStart) this.events.emit("start-game");
    });
  }

  /** Los avisos que empiezan por «¡» son buenas noticias; el resto, errores. */
  private onToast(msg: string) {
    if (!msg.startsWith("¡")) sfx.error();
    this.showToast(msg, msg.startsWith("¡") ? 5000 : 2500);
  }

  private onMyRole(role: string) {
    const info = (ROLE_INFO as Record<string, { nombre: string; equipo: string } | undefined>)[role];
    if (!info) return;
    this.roleTag.setText(`${info.nombre} · ${info.equipo === "impostores" ? "impostor" : "vecino"}`);
    this.roleTag.setBackgroundColor(info.equipo === "impostores" ? "#9b2f2a" : "#2f6f5e");
    this.roleTag.setVisible(true);
  }

  private onPhase(phase: string) {
    if (phase === "sala") this.roleTag.setVisible(false);
  }

  private buildHeader() {
    const title = this.add.text(14, 8, "La Roda City", { fontFamily: THEME.title, fontSize: "18px", color: THEME.text });
    const bg = new Card(this, 18).setCardSize(title.width + 28, 40);
    this.header = this.add.container(16, 16, [bg, title]).setDepth(10);
  }

  private buildJoystick() {
    this.joyBase = this.add.circle(0, 0, JOY_RADIUS, THEME.panel, 0.4).setStrokeStyle(2.5, THEME.line, 0.5).setDepth(5);
    this.joyKnob = this.add.circle(0, 0, 22, THEME.line, 0.8).setStrokeStyle(2, THEME.panel, 0.6).setDepth(6);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.joyPointerId !== null || this.panel.visible) return;
      // la mitad izquierda de la pantalla (parte baja) es zona de joystick
      if (p.x > this.scale.width * 0.5 || p.y < this.scale.height * 0.35) return;
      this.joyPointerId = p.id;
      this.joyOrigin = { x: p.x, y: p.y };
      this.joyBase.setPosition(p.x, p.y);
      this.joyKnob.setPosition(p.x, p.y);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyPointerId) return;
      const dx = p.x - this.joyOrigin.x;
      const dy = p.y - this.joyOrigin.y;
      const d = Math.hypot(dx, dy);
      const reach = Math.min(d, JOY_RADIUS);
      const nx = d ? dx / d : 0;
      const ny = d ? dy / d : 0;
      this.joyKnob.setPosition(this.joyOrigin.x + nx * reach, this.joyOrigin.y + ny * reach);
      input.joystick.active = d > JOY_DEADZONE;
      // velocidad proporcional a la inclinación, máxima al borde
      const strength = Math.min(1, (d - JOY_DEADZONE) / (JOY_RADIUS - JOY_DEADZONE));
      input.joystick.x = nx * Math.max(0, strength);
      input.joystick.y = ny * Math.max(0, strength);
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyPointerId) return;
      this.joyPointerId = null;
      input.joystick.active = false;
      input.joystick.x = input.joystick.y = 0;
      this.placeJoystickHome();
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  private placeJoystickHome() {
    const x = 26 + JOY_RADIUS + 20;
    const y = this.scale.height - JOY_RADIUS - 46;
    this.joyBase.setPosition(x, y);
    this.joyKnob.setPosition(x, y);
  }

  /** Botón ✋ (tecla E): hacer la misión del lugar o ver su información. */
  private buildActionButton() {
    const button = roundButton(this, 44, "icono-mano");
    this.actionDraw = button.draw;
    button.icon.setY(-3);
    this.actionLabel = this.add
      .text(0, -56, "", {
        fontFamily: FONT,
        fontSize: "13px",
        fontStyle: "bold",
        color: THEME.text,
        stroke: "#15100c",
        strokeThickness: 4,
        align: "center",
        wordWrap: { width: 150 },
      })
      .setOrigin(0.5, 1);
    const hint = this.add.text(0, 26, "E", { fontFamily: FONT, fontSize: "11px", fontStyle: "bold", color: THEME.muted }).setOrigin(0.5);
    this.actionBtn = this.add.container(0, 0, [button.g, button.icon, hint, this.actionLabel]).setDepth(10).setVisible(false).setSize(88, 88);
    this.actionBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.events.emit("interact"));
  }

  private buildPanel() {
    const w = 340;
    const h = 220;
    const bg = new Card(this, 18, THEME.panel, 0.9).setCardSize(w, h).setPosition(-w / 2, -h / 2);
    this.panelTitle = this.add.text(-w / 2 + 20, -h / 2 + 18, "", { fontFamily: THEME.title, fontSize: "21px", color: THEME.text, wordWrap: { width: 280 } });
    this.panelBody = this.add.text(-w / 2 + 20, -h / 2 + 60, "", {
      fontFamily: FONT,
      fontSize: "14px",
      color: THEME.muted,
      wordWrap: { width: 300 },
      lineSpacing: 4,
    });
    const close = this.add.text(w / 2 - 16, -h / 2 + 12, "✕", { fontFamily: FONT, fontSize: "22px", color: THEME.text }).setOrigin(1, 0);
    close.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.panel.setVisible(false));
    const shade = this.add.rectangle(0, 0, 4000, 4000, 0x000000, 0.4).setInteractive();
    shade.on("pointerdown", () => this.panel.setVisible(false));
    this.panel = this.add.container(0, 0, [shade, bg, this.panelTitle, this.panelBody, close]).setDepth(20).setVisible(false);
    this.input.keyboard?.on("keydown-ESC", () => this.panel.setVisible(false));
  }

  /** Recuadro de la sala (código de invitación y jugadores) y el aviso flotante. */
  private buildRoomBox() {
    this.roomBg = new Card(this).setCardSize(220, 60);
    this.roomTitle = this.add.text(14, 10, "", { fontFamily: FONT, fontSize: "15px", fontStyle: "900", color: THEME.accentText });
    const hint = this.add.text(14, 31, "Toca aquí para invitar", { fontFamily: FONT, fontSize: "11px", color: THEME.muted });
    this.roomHint = hint;
    this.roomList = this.add.text(14, 52, "", { fontFamily: FONT, fontSize: "13px", color: THEME.text, lineSpacing: 3 });
    this.roomBox = this.add.container(16, 68, [this.roomBg, this.roomTitle, hint, this.roomList]).setDepth(10).setVisible(false).setSize(220, 60);
    this.roomBox
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 220, 60), Phaser.Geom.Rectangle.Contains)
      .on("pointerdown", () => void this.invite());
    this.toastBg = new Card(this, 18, THEME.panel, 0.88).setDepth(30).setVisible(false);
    this.toast = this.add
      .text(0, 0, "", { fontFamily: FONT, fontSize: "14px", fontStyle: "bold", color: THEME.text, padding: { x: 16, y: 9 } })
      .setOrigin(0.5, 0)
      .setDepth(31)
      .setVisible(false);
  }

  private onRoomInfo(info: RoomInfo) {
    const inLobby = info.phase === "sala" || info.phase === undefined;
    this.roomHint.setVisible(inLobby);
    const n = info.players.filter((p) => p.connected).length;
    const min = info.minPlayers ?? 4;
    this.canStart = inLobby && !!info.isHost && n >= min;
    this.startBtn.setVisible(inLobby);
    this.startBg.setAlpha(this.canStart ? 1 : 0.55);
    this.startLabel.setText(info.isHost ? (n >= min ? `Empezar partida (${n})` : `Faltan jugadores (${n}/${min})`) : "Esperando al anfitrión…");
    this.roomCode = info.code;
    this.roomBox.setVisible(true);
    this.roomTitle.setText(`Sala ${info.code} · ${info.players.length} jugador${info.players.length === 1 ? "" : "es"}`);
    // durante la partida la lista se pliega para dejar sitio a las misiones
    this.roomList.setText(
      inLobby
        ? info.players
            .map((p) => `${p.isHost ? "★ " : "• "}${p.name}${p.isMe ? " (tú)" : ""}${p.alive === false && !inLobby ? " — fuera" : ""}${p.connected ? "" : " — sin conexión"}`)
            .join("\n")
        : "",
    );
    const w = Math.max(220, this.roomTitle.width + 28, this.roomList.width + 28);
    const h = inLobby ? 62 + this.roomList.height : 38;
    this.roomBg.setCardSize(w, h);
    this.roomBox.input!.hitArea.setSize(w, h);
    this.layout();
  }

  private onNetStatus(status: string) {
    if (status === "reconectando") this.showToast("Conexión perdida. Reconectando…", 4000);
    else if (status === "desconectado") this.showToast("Desconectado del servidor.", 6000);
    else if (status === "conectado" && this.roomCode) this.showToast("Conectado", 1500);
  }

  private showToast(msg: string, ms: number) {
    this.toast.setText(msg).setVisible(true);
    this.toastBg
      .setCardSize(this.toast.width, this.toast.height)
      .setPosition(this.toast.x - this.toast.width / 2, this.toast.y)
      .setVisible(true);
    this.toast.setAlpha(0);
    this.toastBg.setAlpha(0);
    this.tweens.add({ targets: [this.toast, this.toastBg], alpha: 1, duration: 160 });
    this.time.delayedCall(ms, () => {
      // si mientras tanto llegó otro aviso, ese se queda
      if (this.toast.text !== msg) return;
      this.tweens.add({
        targets: [this.toast, this.toastBg],
        alpha: 0,
        duration: 220,
        onComplete: () => {
          this.toast.setVisible(false);
          this.toastBg.setVisible(false);
        },
      });
    });
  }

  /** Comparte el enlace de invitación (menú nativo en móvil o copia al portapapeles). */
  private async invite() {
    const url = `${location.origin}${location.pathname}?sala=${this.roomCode}`;
    const text = `¡Únete a mi partida de La Roda City! Código: ${this.roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "La Roda City", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      this.showToast("Enlace de invitación copiado", 2500);
    } catch {
      this.showToast(`Código de la sala: ${this.roomCode}`, 4000);
    }
  }

  isPanelOpen() {
    return this.panel.visible;
  }

  private onPoiNear(poi: PointOfInterest | null) {
    this.nearPoiName = poi?.name ?? null;
    this.refreshActionButton();
  }

  /** Con una misión al alcance el botón se pinta en dorado. */
  private refreshActionButton() {
    this.actionBtn.setVisible(this.taskAvailable || !!this.nearPoiName);
    this.actionLabel.setText(this.taskAvailable ? "Hacer misión (E)" : (this.nearPoiName ?? ""));
    if (this.taskAvailable) this.actionDraw(THEME.accent, 0.95, 0xffffff, 0.9);
    else this.actionDraw(THEME.panel, THEME.panelAlpha, THEME.line, 0.35);
  }

  private buildTasksBox() {
    this.tasksBg = new Card(this).setCardSize(240, 60);
    const icon = this.add.image(26, 26, "icono-tareas").setScale(0.3);
    this.progressText = this.add.text(48, 11, "", { fontFamily: FONT, fontSize: "15px", fontStyle: "900", color: THEME.text });
    // barra de progreso dentro del recuadro, encima de la lista
    this.progressBg = this.add.rectangle(48, 34, 170, 6, 0x000000, 0.45).setOrigin(0);
    this.progressFill = this.add.rectangle(48, 34, 0, 6, THEME.ok, 1).setOrigin(0);
    this.tasksText = this.add.text(16, 52, "", { fontFamily: FONT, fontSize: "13px", color: THEME.text, lineSpacing: 5 });
    this.tasksHit = this.add.zone(0, 0, 240, 60).setOrigin(0);
    this.tasksBox = this.add
      .container(16, 0, [this.tasksBg, icon, this.progressBg, this.progressFill, this.progressText, this.tasksText, this.tasksHit])
      .setDepth(10)
      .setVisible(false);
    // tocar la lista la pliega o despliega (para ver más mapa en el móvil)
    this.tasksHit.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.tasksCollapsed = !this.tasksCollapsed;
      if (this.lastTasks) this.onTasks(this.lastTasks);
    });
  }

  /** Tarjeta breve de «tarea/paso completado» con una marca de verificación. */
  private onTaskDone(info: { nombre: string; done: boolean; lugar: string }) {
    const { width, height } = this.scale;
    const w = Math.min(320, width - 40);
    const h = 128;
    const bg = new Card(this, 20, THEME.panel, 0.9).setCardSize(w, h).setPosition(-w / 2, -h / 2);
    const circle = this.add.circle(0, -22, 24, THEME.ok, 0.18).setStrokeStyle(3, THEME.ok, 1);
    const check = this.add.graphics().lineStyle(5, THEME.ok, 1);
    check.beginPath().moveTo(-10, -22).lineTo(-3, -14).lineTo(11, -30).strokePath();
    const title = this.add
      .text(0, 14, info.done ? "Tarea completada" : "Paso completado", { fontFamily: FONT, fontSize: "18px", fontStyle: "900", color: THEME.text })
      .setOrigin(0.5, 0);
    const name = this.add.text(0, 38, info.nombre, { fontFamily: FONT, fontSize: "13px", color: THEME.muted }).setOrigin(0.5, 0);
    const card = this.add.container(width / 2, height * 0.32, [bg, circle, check, title, name]).setDepth(40).setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 220, ease: "Back.Out" });
    this.tweens.add({ targets: card, alpha: 0, y: card.y - 16, delay: 1600, duration: 300, onComplete: () => card.destroy() });
  }

  private onMinimap(info: { me: { x: number; y: number }; targets: { x: number; y: number }[] }) {
    this.minimap.update(info.me, info.targets);
  }

  private onTasks(info: TasksInfo) {
    this.lastTasks = info;
    const show = info.list.length > 0;
    this.tasksBox.setVisible(show);
    const pending = info.list.filter((t) => !t.done).length;
    const line = (t: TaskView) =>
      `${t.done ? "●" : "○"}  ${t.nombre}${t.steps > 1 && !t.done ? ` (${t.step + 1}/${t.steps})` : ""}\n     ${t.done ? "hecha" : t.lugarNombre}`;
    this.tasksText.setText(this.tasksCollapsed ? `${pending} pendientes  ▸` : info.list.map(line).join("\n"));
    this.tasksText.setColor(this.tasksCollapsed ? THEME.muted : THEME.text);
    const w = Math.max(240, this.tasksText.width + 32);
    const h = this.tasksText.height + 66;
    this.tasksBg.setCardSize(w, h);
    this.tasksHit.setSize(w, h);
    this.tasksHit.input?.hitArea.setSize(w, h);
    this.progressBg.width = w - 64;
    this.progressFill.width = info.total > 0 ? (w - 64) * Math.min(1, info.done / info.total) : 0;
    this.progressText.setText(`${info.practice ? "Práctica" : "Tareas"}  ${info.done}/${info.total}`);
    this.layout();
  }

  private openPanel(poi: PointOfInterest) {
    const estado =
      poi.status === "referencia"
        ? "Posición tomada del punto rojo de tu dibujo. Pendiente de confirmar."
        : poi.status === "aproximada"
          ? "Posición aproximada: en el dibujo solo aparece el número, sin punto."
          : "Sin posición en el dibujo.";
    this.panelTitle.setText(poi.name);
    this.panelBody.setText(`${estado}\n\nAquí irán las misiones de este lugar.`);
    this.panel.setVisible(true);
  }

  private layout() {
    const { width, height } = this.scale;
    this.placeJoystickHome();
    this.actionBtn.setPosition(width - 46 - 30, height - 46 - 46);
    this.panel.setPosition(width / 2, height / 2);
    this.toast.setPosition(width / 2, 16);
    this.toastBg.setPosition(width / 2 - this.toast.width / 2, 16);
    this.roleTag.setPosition(width / 2, 52);
    // la lista de misiones va debajo del recuadro de la sala
    const roomBottom = this.roomBox.visible ? this.roomBox.y + this.roomBg.h * this.roomBox.scaleY + 10 : 68;
    this.tasksBox.setPosition(16, roomBottom).setScale(width < 520 ? 0.85 : 1);
    // minimapa arriba a la derecha y, debajo, el botón de sonido
    this.minimap.setPosition(width - 16 - this.minimap.width, 16);
    this.soundBtn.setPosition(width - 16 - 20, 16 + this.minimap.width + 28);
    this.fsBtn?.setPosition(width - 16 - 20 - 48, 16 + this.minimap.width + 28);
    this.startBtn.setPosition(width / 2, height - 60);
    this.layoutActions();
    this.roomBox.setScale(width < 520 ? 0.85 : 1);
    // en móviles estrechos, la cabecera se reduce para no tapar los botones
    this.header.setScale(width < 520 ? 0.82 : 1);
  }
}
