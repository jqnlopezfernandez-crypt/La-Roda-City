import { ROLE_INFO, SABOTAGES, SKIP_VOTE, type SabotageKind } from "../../shared/game/rules";
import { floodScene, headlessStatueScene, poolScene } from "../art/sabotages";
import { SLOT_ART, SLOT_SYMBOLS, slotCabinetSvg, slotLeverSvg, type SlotSymbol } from "../art/slot";
import { coinSvg } from "../art/minigames";
import { sfx } from "../game/sounds";
import { PALETTE } from "../game/characters";
import type { GameOver, VoteResult } from "../net/session";
import type { SlotResult } from "../../shared/net/protocol";

/** Cómo se usa cada rol (botones), debajo de la descripción. */
const ROLE_HINT: Record<string, string> = {
  sapo: "Acércate a un vecino y pulsa el cuchillo (Q). Con las tijeras (Z) saboteas el pueblo.",
  gitano: "Tras eliminar, pulsa la cesta (C) junto al cuerpo para llevártelo. Con las tijeras (Z) saboteas.",
  piromano: "Pulsa el fuego (G) para prender el pueblo. Mientras arde, los vecinos casi no ven. Con las tijeras (Z) saboteas.",
  roeno: "Sigue los puntos amarillos hasta tus misiones. Si ves un cuerpo, repórtalo (F).",
  vilchez: "Acércate a alguien y pulsa la mano que saluda (V): quedará marcado en azul en tu minimapa.",
  conserje: "Incendios (cubo, B) y sabotajes (llave, R): tú solo los arreglas, sin esperar a nadie.",
  ludopata: "En cualquier bar pulsa la moneda (T), una vez por ronda. Con premio sabrás de alguien bueno (✔).",
};

/**
 * Pantallas superpuestas en HTML (más cómodas de leer y pulsar en el móvil que
 * dentro del lienzo): rol al empezar, reunión con votación, resultado y final.
 */
export type MeetingPlayer = { id: string; name: string; look: number; alive: boolean; hasVoted: boolean; isMe: boolean };

export type MeetingOptions = {
  reason: string;
  caller: string;
  victim: string;
  endsAt: () => number;
  amAlive: boolean;
  onVote: (target: string) => void;
};

type RoleInfo = { nombre: string; equipo: string; descripcion: string };
const roleInfo = (role: string): RoleInfo | undefined => (ROLE_INFO as Record<string, RoleInfo>)[role];

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const hexColor = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export class Overlays {
  private root: HTMLDivElement;
  private meetingEl: HTMLDivElement | null = null;
  private onVote: ((target: string) => void) | null = null;
  private myVote: string | null = null;
  private timerId = 0;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "overlays";
    document.body.appendChild(this.root);
  }

  destroy() {
    window.clearInterval(this.timerId);
    this.root.remove();
  }

  private card(cls: string, html: string) {
    const el = document.createElement("div");
    el.className = `ov ${cls}`;
    el.innerHTML = `<div class="ov-card">${html}</div>`;
    this.root.appendChild(el);
    return el;
  }

  /** Rol secreto al empezar la partida (se cierra solo). */
  showRole(role: string, partner: string | null) {
    const info = roleInfo(role)!;
    const imp = info.equipo === "impostores";
    const el = this.card(
      `ov-role ${imp ? "imp" : "crew"}`,
      `<p class="ov-kicker">Tu papel en La Roda</p>
       <h2>${info.nombre}</h2>
       <p class="ov-team">${imp ? "Impostor" : "Vecino"}</p>
       <p>${escapeHtml(info.descripcion)}</p>
       ${ROLE_HINT[role] ? `<p class="ov-hint">${escapeHtml(ROLE_HINT[role])}</p>` : ""}
       ${partner ? `<p class="ov-partner">Tu compañero impostor: <b>${escapeHtml(partner)}</b></p>` : ""}
       <button class="btn btn-primary" data-close>¡Vamos!</button>`,
    );
    const close = () => el.remove();
    el.querySelector("[data-close]")!.addEventListener("click", close);
    window.setTimeout(close, 6000);
  }

  /** Reunión: motivo, cuenta atrás y votación. */
  showMeeting(opts: MeetingOptions) {
    this.closeMeeting();
    this.onVote = opts.onVote;
    this.myVote = null;
    const title =
      opts.reason === "cadaver"
        ? `¡${escapeHtml(opts.caller)} ha encontrado el cuerpo de ${escapeHtml(opts.victim)}!`
        : opts.reason === "vilchez"
          ? `${escapeHtml(opts.caller)} (Vilchez) convoca una reunión`
          : `${escapeHtml(opts.caller)} ha convocado una reunión de emergencia`;
    this.meetingEl = this.card(
      "ov-meeting",
      `<h2>Reunión en el Ayuntamiento</h2>
       <p class="ov-sub">${title}</p>
       <p class="ov-timer" data-timer></p>
       <div class="ov-players" data-list></div>
       ${opts.amAlive ? '<button class="btn" data-skip>Saltar voto</button>' : '<p class="ov-sub">Estás fuera de la partida: no puedes votar.</p>'}`,
    );
    this.meetingEl.querySelector("[data-skip]")?.addEventListener("click", () => this.castVote(SKIP_VOTE));
    const timer = this.meetingEl.querySelector<HTMLElement>("[data-timer]")!;
    const tick = () => (timer.textContent = `Votación: ${Math.max(0, Math.ceil((opts.endsAt() - Date.now()) / 1000))} s`);
    tick();
    this.timerId = window.setInterval(tick, 250);
  }

  updateMeeting(players: MeetingPlayer[], amAlive: boolean) {
    const list = this.meetingEl?.querySelector<HTMLElement>("[data-list]");
    if (!list) return;
    list.innerHTML = players
      .map(
        (p) => `<button class="ov-player ${p.alive ? "" : "dead"} ${this.myVote === p.id ? "chosen" : ""}" data-id="${p.id}"
          ${!amAlive || !p.alive || this.myVote ? "disabled" : ""}>
          <span class="dot" style="background:${hexColor(PALETTE[p.look % PALETTE.length].shirt)}"></span>
          <span class="nm">${escapeHtml(p.name)}${p.isMe ? " (tú)" : ""}</span>
          <span class="st">${p.alive ? (p.hasVoted ? "✓ ha votado" : "") : "fuera"}</span>
        </button>`,
      )
      .join("");
    list.querySelectorAll<HTMLButtonElement>(".ov-player").forEach((b) => b.addEventListener("click", () => this.castVote(b.dataset.id!)));
    const skip = this.meetingEl?.querySelector<HTMLButtonElement>("[data-skip]");
    if (skip) skip.disabled = !!this.myVote;
  }

  private castVote(target: string) {
    if (this.myVote) return;
    this.myVote = target;
    this.onVote?.(target);
    this.meetingEl?.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = true));
    if (target !== SKIP_VOTE) this.meetingEl?.querySelector(`[data-id="${target}"]`)?.classList.add("chosen");
  }

  closeMeeting() {
    window.clearInterval(this.timerId);
    this.meetingEl?.remove();
    this.meetingEl = null;
  }

  showVoteResult(v: VoteResult, names: Record<string, string>) {
    this.closeMeeting();
    const rows = Object.entries(v.counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `<li>${id === SKIP_VOTE ? "Saltar" : escapeHtml(names[id] ?? "?")}: <b>${n}</b></li>`)
      .join("");
    const msg = v.ejectedName
      ? `<b>${escapeHtml(v.ejectedName)}</b> ha sido expulsado. ${v.ejectedWasImpostor ? "<span class='imp'>Era impostor.</span>" : "No era impostor."}`
      : "Nadie ha sido expulsado.";
    const el = this.card("ov-result", `<h2>Resultado</h2><p>${msg}</p><ul class="ov-counts">${rows || "<li>Sin votos</li>"}</ul>`);
    window.setTimeout(() => el.remove(), 4800);
  }

  showGameOver(g: GameOver, myId: string, isHost: boolean, onBack: () => void) {
    this.closeMeeting();
    const mine = g.roles.find((r) => r.id === myId);
    const won = mine ? roleInfo(mine.role)?.equipo === g.winner : false;
    const el = this.card(
      `ov-end ${g.winner === "impostores" ? "imp" : "crew"}`,
      `<p class="ov-kicker">${won ? "¡Has ganado!" : "Has perdido"}</p>
       <h2>Ganan ${g.winner === "impostores" ? "los impostores" : "los vecinos"}</h2>
       <p>${escapeHtml(g.reason)}</p>
       <ul class="ov-roles">${g.roles
         .map((r) => `<li><span>${escapeHtml(r.name)}</span><b class="${roleInfo(r.role)?.equipo === "impostores" ? "imp" : ""}">${roleInfo(r.role)?.nombre ?? r.role}</b></li>`)
         .join("")}</ul>
       ${isHost ? '<button class="btn btn-primary" data-back>Volver a la sala</button>' : '<p class="ov-sub">Esperando a que el anfitrión vuelva a la sala…</p>'}`,
    );
    el.querySelector("[data-back]")?.addEventListener("click", onBack);
    return el;
  }

  /** Tragaperras del Ludópata: moneda, palanca, rodillos que frenan uno a uno y premio. */
  showSlot(r: SlotResult) {
    this.root.querySelector(".ov-slot")?.remove();
    const img = (k: SlotSymbol) => `<img alt="" draggable="false" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(SLOT_ART[k]())}">`;
    const pick = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    // Resultado: 7-7-7 con premio; si no, a veces el "casi" (7, 7 y el tercero se pasa)
    let final: SlotSymbol[];
    if (r.won) final = ["siete", "siete", "siete"];
    else if (Math.random() < 0.45) final = ["siete", "siete", (["campana", "aceituna", "abuelo"] as const)[Math.floor(Math.random() * 3)]];
    else {
      final = [pick(), pick(), pick()];
      if (final[0] === final[1] && final[1] === final[2]) final[2] = final[2] === "naranja" ? "cubata" : "naranja";
    }
    const STOP = [16, 22, 30]; // índice del símbolo que queda en la línea en cada rodillo
    const strips = final.map((f, i) => {
      const list: SlotSymbol[] = Array.from({ length: STOP[i] + 2 }, pick);
      list[STOP[i]] = f;
      // el "casi": el 7 pasa justo antes de parar
      if (!r.won && i === 2 && final[0] === "siete" && final[1] === "siete") list[STOP[i] + 1] = "siete";
      return list;
    });
    const el = this.card(
      "ov-slot",
      `<p class="ov-kicker">Tragaperras del bar</p>
       <div class="slot-machine">
         ${slotCabinetSvg()}
         <div class="slot-window">${strips.map((l) => `<div class="slot-reel"><div class="slot-strip">${l.map(img).join("")}</div></div>`).join("")}<div class="slot-line"></div></div>
         <div class="slot-lever">${slotLeverSvg().replace("<svg", '<svg class="lever"')}</div>
         <div class="slot-coin">${coinSvg(100)}</div>
         <div class="slot-tray"></div>
       </div>
       <p class="slot-msg">Echando la moneda…</p>`,
    );
    const msg = el.querySelector<HTMLParagraphElement>(".slot-msg")!;
    const reels = [...el.querySelectorAll<HTMLDivElement>(".slot-reel")];
    const led = el.querySelector<SVGTextElement>(".slot-led");
    const lever = el.querySelector<HTMLDivElement>(".slot-lever")!;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Tres símbolos a la vista por rodillo; el del índice STOP-1 arriba al empezar
    for (const reel of reels) reel.style.setProperty("--sym-h", `${reel.clientHeight / 3}px`);
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, reduce ? Math.min(ms, 200) : ms));
    const close = () => {
      timers.forEach((t) => window.clearTimeout(t));
      el.remove();
    };
    el.addEventListener("click", () => el.classList.contains("done") && close());
    sfx.moneda();
    later(450, () => {
      if (led) led.textContent = "0019";
      lever.classList.add("pull");
      sfx.palanca();
      msg.textContent = "¡Que salga, que salga!";
    });
    later(750, () => {
      el.classList.add("spinning");
      const stopRolls = sfx.rodillos();
      reels.forEach((reel, i) => {
        const strip = reel.querySelector<HTMLDivElement>(".slot-strip")!;
        const h = reel.clientHeight / 3;
        const target = -(STOP[i] - 1) * h;
        const dur = 1100 + i * 520 + (i === 2 && final[0] === final[1] ? 650 : 0);
        strip.animate(
          [{ transform: "translateY(0)", filter: "blur(0)" }, { transform: `translateY(${target * 0.25}px)`, filter: "blur(2.5px)", offset: 0.2 }, { transform: `translateY(${target * 0.9}px)`, filter: "blur(1.5px)", offset: 0.8 }, { transform: `translateY(${target - h * 0.12}px)`, filter: "blur(0)", offset: 0.93 }, { transform: `translateY(${target}px)`, filter: "blur(0)" }],
          { duration: reduce ? 10 : dur, easing: "cubic-bezier(.25,.1,.25,1)", fill: "forwards" },
        );
        later(dur, () => {
          sfx.rodilloPara(i);
          reel.classList.add("stopped");
          if (i === 1 && final[0] === final[1]) msg.textContent = final[0] === "siete" ? "¡Dos sietes! Venga, venga…" : "Uy, uy…";
          if (i === 2) {
            stopRolls();
            el.classList.remove("spinning");
            el.classList.add("done", r.won ? "won" : "lost");
            if (r.won) {
              sfx.premio();
              msg.innerHTML = `¡PREMIO! <b>${escapeHtml(r.name ?? "")}</b> es de los buenos.`;
              const tray = el.querySelector<HTMLDivElement>(".slot-tray")!;
              for (let c = 0; c < 14; c++) {
                const coin = document.createElement("div");
                coin.className = "slot-payout";
                coin.style.setProperty("--x", `${(Math.random() - 0.5) * 90}px`);
                coin.style.setProperty("--r", `${Math.round((Math.random() - 0.5) * 720)}deg`);
                coin.style.animationDelay = `${c * 90}ms`;
                coin.innerHTML = coinSvg([100, 200, 50][c % 3]);
                tray.appendChild(coin);
              }
              if (led) led.textContent = "0500";
            } else {
              sfx.sinPremio();
              msg.textContent = final[0] === "siete" && final[1] === "siete" ? "¡Por un pelo! Sin premio esta ronda." : "Sin premio esta vez. Prueba en la siguiente ronda.";
            }
            later(r.won ? 5200 : 3600, close);
          }
        });
      });
    });
  }

  /** Menú del impostor: elegir uno de los tres sabotajes críticos (con su ilustración). */
  showSabotageMenu(onPick: (kind: SabotageKind) => void) {
    this.root.querySelector(".ov-sabotaje")?.remove();
    const scenes: Record<SabotageKind, () => string> = { cabeza: headlessStatueScene, piscina: () => poolScene(true), riada: floodScene };
    const kinds = Object.keys(SABOTAGES) as SabotageKind[];
    const el = this.card(
      "ov-sabotaje",
      `<button class="mg-x" aria-label="Cerrar">✕</button>
       <p class="ov-kicker">Sabotaje</p><h2>¿Qué le hacemos al pueblo?</h2>
       <p class="ov-sub">Tendrán 40 segundos para arreglarlo entre dos (o el Conserje). Si no llegan, ganáis.</p>
       <div class="sab-grid">${kinds
         .map((k) => `<button class="sab-opt" data-k="${k}">${scenes[k]()}<b>${SABOTAGES[k].nombre}</b></button>`)
         .join("")}</div>`,
    );
    el.querySelector(".mg-x")!.addEventListener("click", () => el.remove());
    el.querySelectorAll<HTMLButtonElement>(".sab-opt").forEach((b) =>
      b.addEventListener("click", () => {
        el.remove();
        onPick(b.dataset.k as SabotageKind);
      }),
    );
  }

  clear() {
    this.closeMeeting();
    this.root.innerHTML = "";
  }
}
