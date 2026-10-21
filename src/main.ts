import "./style.css";
import { loadArt } from "./art/runtime";
import { showLobby } from "./ui/lobby";
import Phaser from "phaser";
import { TownScene } from "./game/TownScene";
import { UIScene } from "./game/UIScene";

let game: Phaser.Game | null = null;

/**
 * Phaser falla al crear su lienzo WebGL si el contenedor mide 0×0 (pestaña o
 * panel oculto, rotación del móvil a medio cambiar). Se espera a que tenga tamaño.
 */
function waitForSize(el: HTMLElement): Promise<void> {
  if (el.clientWidth > 0 && el.clientHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(el);
  });
}

async function start() {
  // Solo en desarrollo: abrir un minijuego suelto (?minijuego=frotar&mision=platos) para probarlo
  const miniGame = import.meta.env.DEV ? new URLSearchParams(location.search).get("minijuego") : null;
  if (miniGame) {
    const { openMiniGame } = await import("./ui/minigames");
    const w = window as unknown as { __mgDone?: boolean };
    w.__mgDone = false;
    openMiniGame({
      title: `Minijuego: ${miniGame}`,
      text: "Prueba de minijuego",
      game: miniGame as never,
      minMs: 1500,
      missionId: new URLSearchParams(location.search).get("mision") ?? "",
      onDone: () => (w.__mgDone = true),
      onClose: () => {},
    });
    return;
  }

  // el arte se prepara mientras el jugador está en la pantalla de inicio
  const artReady = loadArt();
  const overlay = document.createElement("div");
  document.body.appendChild(overlay);
  const { session, name, look } = await showLobby(overlay);
  overlay.remove();
  await Promise.all([waitForSize(document.getElementById("app")!), artReady, document.fonts?.ready]);

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    backgroundColor: "#55603c",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
      min: { width: 320, height: 240 },
    },
    render: { antialias: true, roundPixels: false },
    callbacks: {
      preBoot: (g) => {
        g.registry.set("session", session);
        g.registry.set("playerName", name);
        g.registry.set("look", look);
      },
    },
    scene: [TownScene, UIScene],
  });
}

start();

window.addEventListener("beforeunload", () => game?.destroy(true));

// Con `npm run dev`, Vite recarga este módulo al guardar cambios. Sin esto se
// acumulaban varios juegos (y varios canvas) superpuestos en la misma página.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game?.destroy(true));
}
