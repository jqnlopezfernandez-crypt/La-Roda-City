/** Panel de sonido: volumen de música, ambiente y efectos, y botón de silencio. */
import { mixer, sfx } from "../game/sounds";

const PANEL_ID = "panel-audio";

/** Cierra el panel abierto (null si no hay ninguno). */
let closePanel: (() => void) | null = null;
/** Momento del último cierre al tocar fuera (evita reabrirlo con el mismo toque). */
let lastClosedAt = 0;

type BusName = Parameters<typeof mixer.setVolume>[0];

export interface AudioPanelOptions {
  onMuteChange?: (muted: boolean) => void;
}

/** Abre el panel de sonido; si ya está abierto, lo cierra. */
export function openAudioPanel(options: AudioPanelOptions = {}): void {
  if (closePanel) return closePanel();
  if (performance.now() - lastClosedAt < 350) return;
  const previousFocus = document.activeElement;
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", `${PANEL_ID}-titulo`);
  panel.innerHTML = `
    <style>
      #${PANEL_ID}{position:fixed;z-index:60;top:max(64px,calc(env(safe-area-inset-top) + 56px));right:max(12px,env(safe-area-inset-right));
        width:min(300px,calc(100vw - 24px));padding:14px 16px 16px;border-radius:14px;
        background:var(--panel,rgba(21,16,12,.86));border:1px solid var(--line,rgba(243,234,214,.14));
        color:var(--text,#f3ead6);font:14px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);
        backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:${PANEL_ID}-in .16s ease-out}
      @keyframes ${PANEL_ID}-in{from{opacity:0;transform:translateY(-6px)}}
      @media (prefers-reduced-motion:reduce){#${PANEL_ID}{animation:none}}
      #${PANEL_ID} h2{margin:0 0 10px;font:600 16px var(--title,Georgia,serif);letter-spacing:.02em;display:flex;justify-content:space-between;align-items:center}
      #${PANEL_ID} .fila{display:grid;grid-template-columns:76px 1fr 40px;align-items:center;gap:8px;min-height:44px}
      #${PANEL_ID} label{color:var(--text,#f3ead6)}
      #${PANEL_ID} output{color:var(--muted,#b9ad98);text-align:right;font-variant-numeric:tabular-nums}
      #${PANEL_ID} input[type=range]{width:100%;height:32px;margin:0;accent-color:var(--accent,#e2a33a);cursor:pointer;touch-action:pan-y}
      #${PANEL_ID} button{font:inherit;color:var(--text,#f3ead6);background:transparent;border:1px solid var(--line,rgba(243,234,214,.14));
        border-radius:10px;min-height:40px;padding:0 12px;cursor:pointer}
      #${PANEL_ID} button:hover{border-color:var(--accent,#e2a33a)}
      #${PANEL_ID} :focus-visible{outline:2px solid var(--accent,#e2a33a);outline-offset:2px}
      #${PANEL_ID} .cerrar{min-width:40px;padding:0;font-size:18px;line-height:1}
      #${PANEL_ID} .silencio{width:100%;margin-top:10px}
      #${PANEL_ID} .silencio[aria-pressed=true]{background:var(--accent,#e2a33a);color:#1d1611;border-color:transparent}
      #${PANEL_ID}.mudo .fila{opacity:.5}
    </style>
    <h2><span id="${PANEL_ID}-titulo">Sonido</span><button type="button" class="cerrar" aria-label="Cerrar panel de sonido">\xD7</button></h2>
  `;

  const rows: [BusName, string][] = [
    ["musica", "M\xFAsica"],
    ["ambiente", "Ambiente"],
    ["efectos", "Efectos"],
  ];
  const sliders = {} as Record<BusName, HTMLInputElement>;
  const outputs = {} as Record<BusName, HTMLOutputElement>;
  let lastTapAt = 0;
  for (const [bus, label] of rows) {
    const row = document.createElement("div");
    row.className = "fila";
    const inputId = `${PANEL_ID}-${bus}`;
    const labelEl = document.createElement("label");
    labelEl.htmlFor = inputId;
    labelEl.textContent = label;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = inputId;
    slider.min = "0";
    slider.max = "100";
    slider.step = "5";
    const output = document.createElement("output");
    output.htmlFor.add(inputId);
    slider.addEventListener("input", () => {
      mixer.setVolume(bus, Number(slider.value) / 100);
      // Al mover el de efectos suena un toque de muestra (como mucho cada 180 ms)
      if (bus === "efectos" && performance.now() - lastTapAt > 180) {
        lastTapAt = performance.now();
        sfx.tap();
      }
    });
    row.append(labelEl, slider, output);
    panel.append(row);
    sliders[bus] = slider;
    outputs[bus] = output;
  }

  const muteButton = document.createElement("button");
  muteButton.type = "button";
  muteButton.className = "silencio";
  panel.append(muteButton);

  /** Refleja en el panel el estado del mezclador. */
  const refresh = () => {
    for (const [bus, label] of rows) {
      const percent = Math.round(mixer.getVolume(bus) * 100);
      const slider = sliders[bus];
      // No se toca el deslizador que el usuario está moviendo
      if (document.activeElement !== slider) slider.value = String(percent);
      slider.setAttribute("aria-valuetext", `${label}: ${percent} %`);
      outputs[bus].textContent = `${percent}`;
    }
    muteButton.textContent = mixer.muted ? "Activar el sonido" : "Silenciar todo";
    muteButton.setAttribute("aria-pressed", String(mixer.muted));
    panel.classList.toggle("mudo", mixer.muted);
  };
  refresh();
  const unsubscribe = mixer.onChange(refresh);

  muteButton.addEventListener("click", () => {
    const nowMuted = sfx.toggle();
    options.onMuteChange?.(nowMuted);
    window.dispatchEvent(new CustomEvent("laroda-audio-silencio", { detail: nowMuted }));
  });
  panel.querySelector(".cerrar")!.addEventListener("click", () => closePanel?.());

  // Las teclas y toques dentro del panel no llegan al juego
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel?.();
    }
  };
  panel.addEventListener("keydown", onKeyDown);
  panel.addEventListener("keyup", (event) => event.stopPropagation());
  for (const type of ["pointerdown", "pointerup", "touchstart", "wheel"]) panel.addEventListener(type, (event) => event.stopPropagation());

  // Tocar fuera cierra el panel (se engancha en el siguiente ciclo para no capturar el toque que lo abrió)
  const onOutsidePointer = (event: PointerEvent) => {
    if (!panel.contains(event.target as Node)) {
      closePanel?.();
      lastClosedAt = performance.now();
    }
  };
  const listenTimer = window.setTimeout(() => window.addEventListener("pointerdown", onOutsidePointer, true), 0);

  document.body.append(panel);
  sliders.musica.focus({ preventScroll: true });
  closePanel = () => {
    window.clearTimeout(listenTimer);
    window.removeEventListener("pointerdown", onOutsidePointer, true);
    unsubscribe();
    panel.remove();
    closePanel = null;
    if (previousFocus && document.contains(previousFocus)) (previousFocus as HTMLElement).focus({ preventScroll: true });
  };
}
