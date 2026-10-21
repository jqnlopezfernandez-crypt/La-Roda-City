import { ROLE_INFO, SKIP_VOTE } from "../../shared/game/rules";
import { PALETTE } from "../game/characters";
import type { GameOver, VoteResult } from "../net/session";

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

  clear() {
    this.closeMeeting();
    this.root.innerHTML = "";
  }
}
