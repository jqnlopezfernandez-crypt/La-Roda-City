import { ROLE_INFO, SABOTAGES, SKIP_VOTE, type SabotageKind } from "../../shared/game/rules";
import { floodScene, headlessStatueScene, poolScene } from "../art/sabotages";
import { SLOT_ART, SLOT_SYMBOLS, slotCabinetSvg, slotLeverSvg, type SlotSymbol } from "../art/slot";
import { coinSvg } from "../art/minigames";
import { sfx } from "../game/sounds";
import { ballotSvg, plazaMeetingScene, roleEmblemSvg, roadOutScene, soulArt, stampSvg, tumbleweedSvg, zasBurstArt } from "../art/scenes";
import { ART } from "../art/index";
import { roenoMeta } from "../game/animation";

const REDUCED_MOTION_UI = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** Fotogramas de la hoja del personaje que usa la interfaz. */
const FRAME = {
  total: roenoMeta.frames,
  frente: roenoMeta.anim.parado.frente,
  lado: roenoMeta.anim.parado.lado,
  espalda: roenoMeta.anim.parado.espalda,
  cicloEspalda: roenoMeta.anim.ciclo.espalda,
};
/** Estilo CSS para pintar un fotograma del personaje de un color con su hoja de sprites. */
function abueloStyle(look: number, frame: number): string {
  const n = PALETTE.length;
  const art = ART.find((a: { key: string }) => a.key === `roeno-${((look % n) + n) % n}`) as { url?: string } | undefined;
  return `background-image:url('${art?.url ?? ""}');background-size:${FRAME.total * 100}% 100%;background-position:${(frame / (FRAME.total - 1)) * 100}% 0`;
}
const svg = (w: number, h: number, body: string) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const zasBurstSvg = () => svg(120, 90, zasBurstArt());
const soulSvg = () => svg(40, 52, soulArt());
/** Tono de voz (Hz) de cada color de vecino: abuelos, voces graves con algo de variedad. */
const VOICE_PITCH = [118, 140, 104, 158, 126, 112, 150, 98, 134, 166, 122, 108];
/** Lo que se oye en la plaza mientras se discute (todos hablan a la vez). */
const CHATTER = [
  "¡Ha sido él!", "¿Yo? ¡Qué va!", "Ojú…", "Yo estaba en el estanco", "Lo vi por el Sagrado", "¡Que no, que no!",
  "Miarma, yo no he sido", "Eso es mentira", "¿Y tú dónde estabas?", "Yo vi a alguien raro…", "Venga ya",
  "¡Por mi madre!", "Estaba con mi misión", "Ese va muy callao…", "¡Illo!", "Aquí hay gato encerrao", "Yo me fío de ti",
  "¿Quién ha sido?", "Estaba en el Cazadores", "Sospechoso…",
];
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

export class Overlays {
  private root: HTMLDivElement;
  private meetingEl: HTMLDivElement | null = null;
  private onVote: ((target: string) => void) | null = null;
  private myVote: string | null = null;
  private timerId = 0;
  private chatterId = 0;
  /** Vecinos dibujados en la plaza de la reunión (por id), para no rehacerlos en cada cambio. */
  private crowd = new Map<string, { el: HTMLButtonElement; voted: boolean; look: number }>();

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "overlays";
    document.body.appendChild(this.root);
  }

  destroy() {
    window.clearInterval(this.timerId);
    window.clearInterval(this.chatterId);
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
  showRole(role: string, partner: string | null, look = 0) {
    const info = roleInfo(role)!;
    const imp = info.equipo === "impostores";
    const el = this.card(
      `ov-role ${imp ? "imp" : "crew"}`,
      `<div class="rl-stage">
         <div class="rl-spot"></div>
         <i class="rl-abuelo" style="${abueloStyle(look, FRAME.frente)}"></i>
         <span class="rl-emblem">${roleEmblemSvg(role)}</span>
         <p class="rl-shh">Shhh… tu papel</p>
       </div>
       <div class="rl-text">
         <p class="ov-kicker">Tu papel en La Roda</p>
         <h2>${info.nombre}</h2>
         <p class="ov-team">${imp ? "Impostor" : "Vecino"}</p>
         <p>${escapeHtml(info.descripcion)}</p>
         ${ROLE_HINT[role] ? `<p class="ov-hint">${escapeHtml(ROLE_HINT[role])}</p>` : ""}
         ${partner ? `<p class="ov-partner">Tu compañero impostor: <b>${escapeHtml(partner)}</b></p>` : ""}
         <button class="btn btn-primary" data-close>¡Vamos!</button>
       </div>`,
    );
    const close = () => el.remove();
    el.querySelector("[data-close]")!.addEventListener("click", close);
    window.setTimeout(close, 7000);
  }

  /** Reunión: motivo, cuenta atrás y votación. */
  showMeeting(opts: MeetingOptions) {
    this.closeMeeting();
    this.onVote = opts.onVote;
    this.myVote = null;
    this.crowd.clear();
    const title =
      opts.reason === "cadaver"
        ? `¡${escapeHtml(opts.caller)} ha encontrado el cuerpo de ${escapeHtml(opts.victim)}!`
        : opts.reason === "vilchez"
          ? `${escapeHtml(opts.caller)} (Vilchez) convoca una reunión`
          : `${escapeHtml(opts.caller)} ha convocado una reunión de emergencia`;
    this.meetingEl = this.card(
      "ov-meeting",
      `<div class="mt-scene">${plazaMeetingScene()}<div class="mt-crowd" data-crowd></div>
         ${opts.reason === "cadaver" ? `<div class="mt-flash">CUERPO ENCONTRADO</div>` : ""}</div>
       <div class="mt-side">
         <p class="ov-kicker">Reunión en la plaza</p>
         <h2>${title}</h2>
         <p class="ov-timer" data-timer></p>
         <p class="ov-sub mt-help">${opts.amAlive ? "Toca a un vecino para votarle." : "Estás fuera de la partida: no puedes votar."}</p>
         ${opts.amAlive ? '<button class="btn" data-skip>Saltar voto</button>' : ""}
       </div>`,
    );
    this.meetingEl.querySelector("[data-skip]")?.addEventListener("click", () => this.castVote(SKIP_VOTE));
    const timer = this.meetingEl.querySelector<HTMLElement>("[data-timer]")!;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((opts.endsAt() - Date.now()) / 1000));
      timer.textContent = `Votación: ${secs} s`;
      timer.classList.toggle("urgent", secs <= 10);
    };
    tick();
    this.timerId = window.setInterval(tick, 250);
    // Todos hablan a la vez: bocadillos que salen aquí y allá
    if (!REDUCED_MOTION_UI) this.chatterId = window.setInterval(() => this.chatter(), 850);
    sfx.murmullo(true);
  }

  /** Un vecino vivo al azar suelta una frase en un bocadillo. */
  private chatter() {
    const alive = [...this.crowd.values()].filter((c) => !c.el.classList.contains("dead") && !c.el.querySelector(".mt-bubble"));
    if (!alive.length || Math.random() < 0.25) return;
    const c = alive[Math.floor(Math.random() * alive.length)];
    const b = document.createElement("span");
    b.className = "mt-bubble";
    b.textContent = CHATTER[Math.floor(Math.random() * CHATTER.length)];
    c.el.appendChild(b);
    c.el.classList.add("talking");
    // cada vecino con su voz (más grave o más aguda según su color) y a su lado del estéreo
    const left = parseFloat(c.el.style.left) || 50;
    sfx.habla(VOICE_PITCH[c.look % VOICE_PITCH.length], Math.max(3, Math.min(9, Math.round(b.textContent.length / 3.5))), (left - 50) / 60);
    window.setTimeout(() => {
      b.remove();
      c.el.classList.remove("talking");
    }, 1900);
  }

  updateMeeting(players: MeetingPlayer[], amAlive: boolean) {
    const crowd = this.meetingEl?.querySelector<HTMLElement>("[data-crowd]");
    if (!crowd) return;
    // Colocación: los vivos en semicírculo delante del Ayuntamiento (dos filas si son muchos)
    const n = players.length;
    const perRow = n > 6 ? Math.ceil(n / 2) : n;
    players.forEach((p, i) => {
      let c = this.crowd.get(p.id);
      if (!c) {
        const el = document.createElement("button");
        el.className = "mt-vecino";
        el.dataset.id = p.id;
        const look = PALETTE[p.look % PALETTE.length];
        el.innerHTML = `<i class="mt-abuelo" style="${abueloStyle(p.look, i % 3 === 1 ? FRAME.lado : FRAME.frente)};animation-delay:${(-Math.random() * 2).toFixed(2)}s"></i>
          <b class="mt-name" style="color:${look.name};-webkit-text-stroke:3px ${look.nameStroke};paint-order:stroke fill">${escapeHtml(p.name)}${p.isMe ? " (tú)" : ""}</b>`;
        if (i % 3 === 1 && i >= perRow / 2) el.querySelector<HTMLElement>(".mt-abuelo")!.classList.add("flip");
        el.addEventListener("click", () => this.castVote(p.id));
        crowd.appendChild(el);
        c = { el, voted: false, look: p.look };
        this.crowd.set(p.id, c);
      }
      const row = n > 6 && i >= perRow ? 1 : 0;
      const k = row ? i - perRow : i;
      const count = row ? n - perRow : Math.min(n, perRow);
      const t = count === 1 ? 0.5 : k / (count - 1);
      const spread = Math.min(80, 16 + count * 11);
      const left = 50 + (t - 0.5) * spread;
      // la fila de delante más abajo y más grande; arco suave
      const top = (row ? 94 : n > 6 ? 78 : 88) - Math.sin(t * Math.PI) * 4;
      c.el.style.left = `${left}%`;
      c.el.style.top = `${top}%`;
      c.el.style.zIndex = String(10 + Math.round(top));
      c.el.style.setProperty("--s", row || n <= 6 ? "1" : "0.88");
      c.el.classList.toggle("dead", !p.alive);
      c.el.classList.toggle("chosen", this.myVote === p.id);
      c.el.disabled = !amAlive || !p.alive || !!this.myVote;
      if (p.hasVoted && !c.voted) {
        c.voted = true;
        const ballot = document.createElement("span");
        ballot.className = "mt-ballot";
        ballot.innerHTML = ballotSvg();
        c.el.appendChild(ballot);
      }
    });
    const skip = this.meetingEl?.querySelector<HTMLButtonElement>("[data-skip]");
    if (skip) skip.disabled = !!this.myVote;
  }

  private castVote(target: string) {
    if (this.myVote) return;
    this.myVote = target;
    this.onVote?.(target);
    this.meetingEl?.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.disabled = true));
    if (target !== SKIP_VOTE) this.meetingEl?.querySelector(`[data-id="${target}"]`)?.classList.add("chosen");
    const help = this.meetingEl?.querySelector(".mt-help");
    if (help) help.textContent = target === SKIP_VOTE ? "Has saltado el voto." : "Voto echado. A ver qué dicen los demás…";
  }

  closeMeeting() {
    if (this.meetingEl) sfx.murmullo(false);
    window.clearInterval(this.timerId);
    window.clearInterval(this.chatterId);
    this.meetingEl?.remove();
    this.meetingEl = null;
    this.crowd.clear();
  }

  /**
   * Resultado de la votación: el camino de salida del pueblo. Si alguien es expulsado,
   * se aleja andando de espaldas hasta perderse en el horizonte y cae el sello.
   */
  showVoteResult(v: VoteResult, names: Record<string, string>, looks: Record<string, number> = {}) {
    this.closeMeeting();
    this.root.querySelector(".ov-result")?.remove();
    const chips = Object.entries(v.counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `<li>${id === SKIP_VOTE ? "Saltar" : escapeHtml(names[id] ?? "?")} <b>${n}</b></li>`)
      .join("");
    const gone = v.ejectedId && v.ejectedName;
    const el = this.card(
      "ov-result",
      `<div class="rd-scene">${roadOutScene()}
         ${gone ? `<i class="rd-walker" style="${abueloStyle(looks[v.ejectedId!] ?? 0, FRAME.espalda)}"></i>` : `<span class="rd-tumble">${tumbleweedSvg()}</span>`}
         <div class="rd-stamp"></div>
       </div>
       <p class="rd-msg" data-msg></p>
       <ul class="rd-counts">${chips || "<li>Sin votos</li>"}</ul>`,
    );
    const msg = el.querySelector<HTMLElement>("[data-msg]")!;
    const text = gone ? `${v.ejectedName} se va del pueblo…` : "Nadie se va del pueblo… por ahora.";
    // Texto a máquina
    let i = 0;
    const type = window.setInterval(() => {
      msg.textContent = text.slice(0, ++i);
      if (i >= text.length) window.clearInterval(type);
    }, REDUCED_MOTION_UI ? 1 : 45);
    if (gone) {
      const walker = el.querySelector<HTMLElement>(".rd-walker")!;
      // ciclo de andar de espaldas (fotogramas 20–27 de la hoja)
      let f = 0;
      const step = window.setInterval(() => {
        walker.style.backgroundPositionX = `${((FRAME.cicloEspalda + (f++ % 8)) / (FRAME.total - 1)) * 100}%`;
      }, 110);
      if (!REDUCED_MOTION_UI)
        walker.animate(
          [
            { left: "46%", bottom: "-4%", transform: "translateX(-50%) scale(1)", opacity: 1 },
            { left: "49%", bottom: "38%", transform: "translateX(-50%) scale(0.32)", opacity: 1, offset: 0.8 },
            { left: "50%", bottom: "48%", transform: "translateX(-50%) scale(0.12)", opacity: 0 },
          ],
          { duration: 5200, easing: "cubic-bezier(.35,.1,.6,1)", fill: "forwards" },
        );
      window.setTimeout(() => window.clearInterval(step), 5400);
      window.setTimeout(() => {
        const stamp = el.querySelector<HTMLElement>(".rd-stamp")!;
        stamp.innerHTML = stampSvg(!!v.ejectedWasImpostor);
        stamp.classList.add("on");
        sfx.sello();
      }, 2300);
    }
    window.setTimeout(() => el.remove(), 6900);
  }

  /** Te han eliminado: viñeta de cómic con el golpe, la caída y el alma que sube. */
  showDeath(look: number) {
    this.root.querySelector(".ov-death")?.remove();
    const el = this.card(
      "ov-death",
      `<div class="dt-panel">
         <span class="dt-burst">${zasBurstSvg()}</span>
         <i class="dt-abuelo" style="${abueloStyle(look, FRAME.lado)}"></i>
         <span class="dt-soul">${soulSvg()}</span>
       </div>
       <h2>¡Te han dado matarile!</h2>
       <p class="ov-sub">Ahora eres un fantasma: nadie te ve, pero puedes seguir haciendo tus misiones para ayudar a los vecinos.</p>`,
    );
    el.addEventListener("click", () => el.remove());
    window.setTimeout(() => el.remove(), 4200);
  }

  showGameOver(g: GameOver, myId: string, isHost: boolean, onBack: () => void, looks: Record<string, number> = {}) {
    this.closeMeeting();
    const mine = g.roles.find((r) => r.id === myId);
    const won = mine ? roleInfo(mine.role)?.equipo === g.winner : false;
    const impWin = g.winner === "impostores";
    const winners = g.roles.filter((r) => roleInfo(r.role)?.equipo === g.winner);
    const confetti = impWin
      ? ""
      : Array.from({ length: 26 }, (_, i) => `<i class="go-conf" style="left:${(i * 37) % 100}%;background:${["#d8342a", "#f2c14e", "#3f8a4a", "#f3ead6", "#5c97ff"][i % 5]};animation-delay:${(i % 9) * 0.18}s;animation-duration:${2.2 + (i % 4) * 0.4}s"></i>`).join("");
    const el = this.card(
      `ov-end ${impWin ? "imp" : "crew"}`,
      `<div class="go-stage">${confetti}
         <div class="go-row">${winners
           .map(
             (r, i) => `<div class="go-win" style="animation-delay:${(i * 0.13).toFixed(2)}s">
               <span class="go-emblem">${roleEmblemSvg(r.role)}</span>
               <i class="go-abuelo" style="${abueloStyle(looks[r.id] ?? i, FRAME.frente)};animation-delay:${(i * 0.13).toFixed(2)}s"></i>
               <b style="color:${PALETTE[(looks[r.id] ?? i) % PALETTE.length].name}">${escapeHtml(r.name)}</b></div>`,
           )
           .join("")}</div>
       </div>
       <div class="go-text">
         <p class="ov-kicker">${won ? "¡Has ganado!" : "Has perdido"}</p>
         <h2>Ganan ${impWin ? "los impostores" : "los vecinos"}</h2>
         <p>${escapeHtml(g.reason)}</p>
         <ul class="ov-roles">${g.roles
           .map((r) => `<li><span>${escapeHtml(r.name)}</span><b class="${roleInfo(r.role)?.equipo === "impostores" ? "imp" : ""}">${roleInfo(r.role)?.nombre ?? r.role}</b></li>`)
           .join("")}</ul>
         ${isHost ? '<button class="btn btn-primary" data-back>Volver a la sala</button>' : '<p class="ov-sub">Esperando a que el anfitrión vuelva a la sala…</p>'}
       </div>`,
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
