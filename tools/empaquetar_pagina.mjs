// Convierte dist-pagina/ en un único HTML autocontenido (JS y CSS incrustados)
// para publicarlo como página. Las imágenes de referencia se publican aparte.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const dir = "dist-pagina";
let html = readFileSync(join(dir, "index.html"), "utf8");
const assets = readdirSync(join(dir, "assets"));
for (const f of assets) {
  const body = readFileSync(join(dir, "assets", f), "utf8");
  if (f.endsWith(".js")) {
    const re = new RegExp(`<script[^>]*src="\\./assets/${f.replace(/\./g, "\\.")}"[^>]*></script>`);
    html = html.replace(re, () => `<script type="module">${body.replace(/<\/script/gi, "<\\/script")}</script>`);
  } else if (f.endsWith(".css")) {
    const re = new RegExp(`<link[^>]*href="\\./assets/${f.replace(/\./g, "\\.")}"[^>]*>`);
    html = html.replace(re, () => `<style>${body}</style>`);
  }
}
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error("Quedan recursos sin incrustar");
// Versión completa para abrir el archivo directamente (con codificación UTF-8: sin ella
// el navegador muestra "RoeÃ±o" en vez de "Roeño")
writeFileSync(join(dir, "la-roda-city-completo.html"), html.trim() + "\n");
// La plataforma añade su propio esqueleto: se publica solo el contenido
html = html.replace(/<!doctype html>/i, "").replace(/<\/?html[^>]*>/gi, "").replace(/<\/?head>/gi, "").replace(/<\/?body>/gi, "");
html = html.replace(/<meta charset[^>]*>/i, "").replace(/<meta name="viewport"[^>]*>/i, "");
writeFileSync(join(dir, "la-roda-city.html"), html.trim() + "\n");
console.log("la-roda-city.html", (html.length / 1024).toFixed(0), "KB");

// Variante en varios archivos para la página publicada: una página pequeña que carga
// juego.js y juego.css (la plataforma rechaza la página de un solo archivo de 3,5 MB).
{
  const js = assets.find((f) => f.endsWith(".js"));
  const css = assets.find((f) => f.endsWith(".css"));
  writeFileSync(join(dir, "juego.js"), readFileSync(join(dir, "assets", js)));
  writeFileSync(join(dir, "juego.css"), readFileSync(join(dir, "assets", css)));
  let page = readFileSync(join(dir, "index.html"), "utf8")
    .replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, '<script type="module" src="juego.js"></script>')
    .replace(/<link rel="stylesheet"[^>]*href="\.\/assets[^"]+"[^>]*>/, '<link rel="stylesheet" href="juego.css">')
    .replace(/<!doctype html>/i, "")
    .replace(/<\/?html[^>]*>|<\/?head>|<\/?body>/gi, "")
    .replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/gi, "");
  writeFileSync(join(dir, "pagina-multi.html"), page.trim() + "\n");
  console.log("pagina-multi.html + juego.js + juego.css");
}
