import { enterFullscreen, installRotateHint, isTouch } from "./fullscreen";
import { CODE_LENGTH, isValidCode, normalizeCode, sanitizeName } from "../../shared/net/protocol";
import { PALETTE } from "../game/characters";
import { svgDataUrl } from "../art/svg";
import { titleScene } from "../art/title";
import { ART } from "../art/index";
import { NetSession } from "../net/session";

export type LobbyResult = { session: NetSession | null; name: string; look: number };

const NAME_KEY = "laroda.nombre";
const LOOK_KEY = "laroda.look";
const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  },
};

/** Página publicada sin servidor de juego (VITE_SIN_SERVIDOR=1): solo modo en solitario. */
// También en una compilación de producción sin VITE_SERVER_URL (p. ej. GitHub Pages antes de tener servidor)
const OFFLINE =
  import.meta.env.VITE_SIN_SERVIDOR === "1" || (import.meta.env.PROD && !import.meta.env.VITE_SERVER_URL);

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/**
 * Pantalla de inicio (HTML, cómoda para escribir en el móvil): nombre, color del
 * roeño y botón para explorar el mapa y practicar las misiones.
 * Si la URL trae ?sala=CODIGO, el código ya viene escrito.
 */
export function showLobby(root: HTMLElement): Promise<LobbyResult> {
  const params = new URLSearchParams(location.search);
  const invited = normalizeCode(params.get("sala") ?? "");
  let look = Math.min(PALETTE.length - 1, Math.max(0, Number(store.get(LOOK_KEY) ?? 0) || 0));

  root.innerHTML = `
    <div class="lobby" role="dialog" aria-label="La Roda City" style="background-image:url('${svgDataUrl(titleScene())}')">
      <div class="lobby-card">
        <div class="lobby-col">
        <div class="lobby-hero">
          <div class="lobby-roeno" aria-hidden="true"></div>
          <div>
            <h1>La Roda <span>City</span></h1>
            <p class="lobby-sub">Un pueblo, mil sospechas</p>
          </div>
        </div>
        <label class="lobby-label" for="lobby-name">Tu nombre</label>
        <input id="lobby-name" maxlength="16" autocomplete="nickname" placeholder="Vecino" />
        </div>
        <div class="lobby-col">
        <div class="lobby-label">Tu roeño (color de chaqueta y boina)</div>
        <div class="lobby-looks" role="radiogroup">
          ${PALETTE.map((p: { label: string; shirt: number }, i: number) => `<button type="button" class="look" data-look="${i}" role="radio" aria-label="${p.label}" title="${p.label}" style="background:${hex(p.shirt)}"></button>`).join("")}
        </div>
        ${OFFLINE ? `<button id="lobby-solo" class="btn btn-primary">Explorar y practicar misiones</button>
        <p class="lobby-note">Las partidas online con código llegarán cuando el servidor del juego esté publicado. Aquí puedes recorrer el mapa y practicar las misiones.</p>` : `
        <button id="lobby-create" class="btn btn-primary">Crear sala privada</button>
        <div class="lobby-join">
          <input id="lobby-code" maxlength="${CODE_LENGTH}" placeholder="CÓDIGO" autocapitalize="characters" autocomplete="off" spellcheck="false" />
          <button id="lobby-join" class="btn">Unirse</button>
        </div>
        <button id="lobby-solo" class="btn btn-ghost">Explorar y practicar solo</button>`}
        <p id="lobby-status" class="lobby-status" aria-live="polite"></p>
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  // En móvil/tablet: al empezar, pantalla completa en horizontal (si el navegador lo permite)
  root.addEventListener(
    "click",
    (e) => {
      if (!isTouch() || !(e.target as HTMLElement).closest("#lobby-solo, #lobby-create, #lobby-join")) return;
      void enterFullscreen();
      installRotateHint();
    },
    true,
  );
  const nameInput = $<HTMLInputElement>("#lobby-name");
  const codeInput = root.querySelector<HTMLInputElement>("#lobby-code") ?? document.createElement("input");
  const status = $<HTMLParagraphElement>("#lobby-status");
  const buttons = [...root.querySelectorAll<HTMLButtonElement>(".btn")];
  nameInput.value = store.get(NAME_KEY) ?? "";
  codeInput.value = invited;

  // marca el color elegido y muestra el roeño de ese color
  const roeno = root.querySelector<HTMLElement>(".lobby-roeno")!;
  const paintLooks = () => {
    root.querySelectorAll<HTMLButtonElement>(".look").forEach((b) => {
      const selected = Number(b.dataset.look) === look;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-checked", String(selected));
    });
    const art = ART.find((a: { key: string }) => a.key === `roeno-${look}`) as { url?: string; frames?: number } | undefined;
    roeno.style.backgroundImage = `url('${art?.url ?? ""}')`;
    // La hoja tiene todos los fotogramas en fila: se muestra solo el primero (vista de 3/4)
    roeno.style.backgroundSize = `${(art?.frames ?? 28) * 100}% 100%`;
  };
  root.querySelectorAll<HTMLButtonElement>(".look").forEach((b) =>
    b.addEventListener("click", () => {
      look = Number(b.dataset.look);
      store.set(LOOK_KEY, String(look));
      paintLooks();
    }),
  );
  paintLooks();
  codeInput.addEventListener("input", () => (codeInput.value = normalizeCode(codeInput.value)));

  return new Promise((resolve) => {
    const finish = (session: NetSession | null) => {
      const name = sanitizeName(nameInput.value);
      root.innerHTML = "";
      resolve({ session, name, look });
    };
    const busy = (on: boolean, msg = "") => {
      buttons.forEach((b) => (b.disabled = on));
      status.textContent = msg;
      status.classList.remove("error");
    };
    const fail = (msg: string) => {
      busy(false);
      status.textContent = msg;
      status.classList.add("error");
    };
    const name = () => {
      const n = sanitizeName(nameInput.value);
      store.set(NAME_KEY, n);
      return n;
    };

    // (En la página publicada no hay botones de sala: estos manejadores no se enganchan.)
    root.querySelector("#lobby-create")?.addEventListener("click", async () => {
      busy(true, "Creando sala…");
      try {
        finish(await NetSession.create(name(), look));
      } catch (e) {
        fail(`No se pudo conectar con el servidor de juego. ¿Está arrancado? (${(e as Error).message || e})`);
      }
    });
    const join = async () => {
      const code = normalizeCode(codeInput.value);
      if (!isValidCode(code)) return fail(`El código tiene ${CODE_LENGTH} letras o números.`);
      busy(true, "Entrando en la sala…");
      try {
        finish(await NetSession.join(code, name(), look));
      } catch (e) {
        const msg = String((e as Error).message || e);
        fail(/not found|no rooms|invalid/i.test(msg) ? "No existe ninguna sala con ese código." : `No se pudo entrar: ${msg}`);
      }
    };
    root.querySelector("#lobby-join")?.addEventListener("click", join);
    codeInput.addEventListener("keydown", (ev) => ev.key === "Enter" && void join());
    $("#lobby-solo").addEventListener("click", () => finish(null));

    // ¿Se recargó la página en mitad de una partida? Intentar volver a la sala.
    if (!OFFLINE) void NetSession.resume().then((s) => s && finish(s));
  });
}
