// Capturas del mapa en varios puntos (escritorio 1280×720):
//   node tests/e2e/capturas-mapa.mjs <carpeta> <etiqueta> "x,y;x,y..."
import { chromium } from 'playwright';
const out = process.argv[2];
const tag = process.argv[3] ?? 'mapa';
const pts = (process.argv[4] ?? '300,300;2900,300;5500,2800;1500,2700;2900,2900').split(';').map((s) => s.split(',').map(Number));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5173/');
await p.click('#lobby-solo');
await p.waitForFunction(() => window.__laRoda, null, { timeout: 60000 });
await p.waitForTimeout(2500);
for (const [x, y] of pts) {
  await p.evaluate(([x, y]) => window.__laRoda.teleport(x, y), [x, y]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${tag}-${x}-${y}.png` });
}
console.log('bake', await p.evaluate(() => window.__laRoda.bakeTimes?.().slice(0, 8)), errs);
await browser.close();
