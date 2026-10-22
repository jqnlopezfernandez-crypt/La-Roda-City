/**
 * Ilustraciones pintadas de los minijuegos (src/art/pintado/mg/<clave>.{jpg,png}).
 * Las escenas usan el fondo pintado si existe y, si no, su dibujo SVG de siempre;
 * las piezas (vasos, botellas, balones…) igual: PNG con transparencia o SVG.
 */
const imagenes = import.meta.glob<string>("./pintado/mg/*.{jpg,png}", { eager: true, query: "?url", import: "default" });

/** URL de la ilustración pintada, o undefined si no hay. */
export function mgUrl(clave: string): string | undefined {
  return imagenes[`./pintado/mg/${clave}.jpg`] ?? imagenes[`./pintado/mg/${clave}.png`];
}

/** Capa de fondo pintado para una escena SVG de W×H (vacía si no hay pintura). */
export function mgFondo(clave: string, W: number, H: number): string {
  const url = mgUrl(clave);
  return url ? `<image class="mg-pintado" href="${url}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : "";
}

/** Pieza pintada dentro de un SVG: imagen centrada en (cx, cy) con ancho w y alto h. */
export function mgPieza(clave: string, cx: number, cy: number, w: number, h: number, extra = ""): string {
  const url = mgUrl(clave);
  return url ? `<image href="${url}" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" ${extra}/>` : "";
}

/** <img> de una pieza pintada, o del SVG de reserva. */
export function mgImg(clave: string, svgReserva: () => string, className = "", style = ""): string {
  const url = mgUrl(clave) ?? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgReserva())}`;
  return `<img class="${className}" style="${style}" alt="" draggable="false" src="${url}">`;
}
