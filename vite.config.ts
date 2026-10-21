/// <reference types="vitest/config" />
import { defineConfig } from "vite";

const gameServerProxy = {
  "/servidor-juego": {
    target: "http://127.0.0.1:2567",
    ws: true,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/servidor-juego/, ""),
  },
};

/** Fuera de la página publicada: manifiesto para instalar el juego a pantalla completa en horizontal. */
const pwaHead = (mode: string) => ({
  name: "pantalla-completa",
  transformIndexHtml: (html: string) =>
    mode === "pagina"
      ? html
      : html.replace(
          "</head>",
          `    <link rel="manifest" href="./manifest.webmanifest" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="La Roda City" />
  </head>`,
        ),
});

export default defineConfig(({ mode }) => ({
  plugins: [pwaHead(mode)],
  // Rutas relativas: el mismo build sirve en GitHub Pages (subcarpeta) y en local.
  base: "./",
  // El servidor de juego (puerto 2567) se sirve también a través de Vite en
  // /servidor-juego. Así la página y el juego comparten origen y puerto: el
  // móvil en la misma Wi-Fi solo necesita acceder al 5173.
  server: { host: "0.0.0.0", proxy: gameServerProxy },
  preview: { host: "0.0.0.0", proxy: gameServerProxy },
  // Página publicada: sin servidor de juego (solo exploración y práctica en solitario)
  define: mode === "pagina" ? { "import.meta.env.VITE_SIN_SERVIDOR": JSON.stringify("1") } : {},
  build:
    mode === "pagina"
      ? {
          // Página publicada (artifact): un solo archivo JS que luego se incrusta en el HTML
          outDir: "dist-pagina",
          // Todo (incluidas las hojas del Roeño) va dentro del HTML publicado
          assetsInlineLimit: 100_000_000,
          chunkSizeWarningLimit: 4000,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {
          // Phaser ocupa ~1,4 MB minificado; se separa para que el navegador lo guarde en caché.
          chunkSizeWarningLimit: 1600,
          rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
        },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
}));
