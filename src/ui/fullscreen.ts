/**
 * Pantalla completa y orientación horizontal (lo mejor que permite cada navegador).
 * - Android/Chrome y iPad: API de pantalla completa (con prefijo webkit en Safari).
 * - iPhone: Safari no deja poner una página a pantalla completa; se consigue añadiéndola
 *   a la pantalla de inicio (manifest + apple-mobile-web-app-capable en index.html).
 * Dentro de la página publicada (un marco) el navegador puede negarlo: se ignora sin error.
 */
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export const isTouch = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled ?? true) !== false;
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    return;
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.("landscape");
  } catch {
    // iOS y escritorio no permiten bloquear la orientación
  }
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {
    // nada
  }
}

export function toggleFullscreen(): Promise<void> {
  return isFullscreen() ? exitFullscreen() : enterFullscreen();
}

/** Aviso para girar el móvil cuando se juega en vertical (se puede descartar). */
export function installRotateHint(): void {
  if (document.getElementById("rotate-hint")) return;
  const hint = document.createElement("div");
  hint.id = "rotate-hint";
  hint.innerHTML = `<div class="rotate-card">
      <div class="rotate-phone" aria-hidden="true"></div>
      <p>Gira el móvil para jugar en horizontal</p>
      <button type="button" class="btn btn-ghost">Seguir en vertical</button>
    </div>`;
  hint.querySelector("button")!.addEventListener("click", () => hint.classList.add("dismissed"));
  document.body.appendChild(hint);
}
