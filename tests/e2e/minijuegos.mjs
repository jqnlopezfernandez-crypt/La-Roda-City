// Comprueba que los minijuegos (en vertical y en horizontal de móvil) se pueden completar con el ratón (y por tanto con el dedo).
//   node tests/e2e/minijuegos.mjs http://localhost:5173 <carpeta-capturas>
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? '/tmp';
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = '') => { const l = `${cond ? 'OK ' : 'FALLO'} ${name} ${extra}`; results.push(l); console.log(l); };

import { play } from './jugar-minijuego.mjs';

for (const vp of [{ width: 390, height: 760 }, { width: 740, height: 360 }]) for (const [game, mision] of [['mantener', 'rezar'], ['deslizar', 'tren'], ['frotar', 'pelo'], ['frotar', 'platos'], ['tocar', 'parque'], ['lanzar', 'parque'], ['estanco', 'tabaco'], ['contar', 'pastillas'], ['cortar', 'kebab']]) {
  const p = await browser.newPage({ viewport: vp });
  await p.goto(`${url}/?minijuego=${game}&mision=${mision}`);
  await p.waitForSelector('.ov-mg');
  await play[game](p);
  const done = await p.evaluate(() => window.__mgDone).catch(() => false);
  if (game === 'frotar' && mision === 'platos') await p.screenshot({ path: `${out}/mg-platos.png` });
  ok(`minijuego "${game}" (${mision}) se completa en ${vp.width}×${vp.height}`, done);
  await p.close();
}
console.log('---');
await browser.close();
process.exit(results.some((r) => r.startsWith('FALLO')) ? 1 : 0);
