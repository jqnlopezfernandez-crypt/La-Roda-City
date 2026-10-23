// Mide la fluidez (fotogramas lentos) en modo práctica en sitios conflictivos, p. ej. dentro de parques,
// donde antes el cálculo de la ruta a la misión congelaba el juego.
//   node tests/e2e/fluidez.mjs http://localhost:5173 [x,y;x,y…]
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173';
const pts = (process.argv[3] ?? '1253,2958;1303,2788;2130,1925;4950,3950').split(';').map((s) => s.split(',').map(Number));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 390, height: 760 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(url);
await p.click('#lobby-solo');
await p.waitForFunction(() => window.__laRoda, null, { timeout: 60000 });
await p.waitForTimeout(3000);
let fallo = false;
for (const [x, y] of pts) {
  await p.evaluate(([x, y]) => window.__laRoda.teleport(x, y), [x, y]);
  await p.waitForTimeout(1500);
  // fotograma más largo en 4 s (rAF): una congelación se ve como un hueco de cientos de ms
  // mientras se mide, el jugador se va moviendo (la ruta se recalcula desde cada sitio nuevo)
  const worst = await p.evaluate(
    ([x0, y0]) =>
      new Promise((res) => {
        let last = performance.now();
        let worst = 0;
        const end = last + 4000;
        const start = last;
        const tick = (t) => {
          worst = Math.max(worst, t - last);
          last = t;
          const k = (t - start) / 1000;
          window.__laRoda.teleport(x0 + Math.sin(k * 1.7) * 60, y0 + Math.cos(k * 1.3) * 40);
          if (t < end) requestAnimationFrame(tick);
          else res(worst);
        };
        requestAnimationFrame(tick);
      }),
    [x, y],
  );
  const ok = worst < 250;
  if (!ok) fallo = true;
  console.log(`${ok ? 'OK ' : 'FALLO'} (${x}, ${y}) fotograma más largo ${worst.toFixed(0)} ms`);
}
if (errs.length) console.log('errores', errs);
await browser.close();
process.exit(fallo || errs.length ? 1 : 0);
