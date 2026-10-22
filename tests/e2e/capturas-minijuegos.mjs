// Capturas de cada minijuego en un móvil vertical (390×760): node tests/e2e/capturas-minijuegos.mjs <carpeta> [juego:mision,...]
import { chromium } from 'playwright';
const out = process.argv[2];
const list = (process.argv[3] ?? 'mantener:rezar,deslizar:tren,deslizar:cubata,frotar:platos,tocar:parque,lanzar:parque,penalti:penaltis,estanco:tabaco,contar:pastillas,cortar:kebab,cubata:cubata,piscina:x,riada:x').split(',');
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
for (const it of list) {
  const [g, m] = it.split(':');
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('ERR', g, e.message));
  await p.goto(`http://localhost:5173/?minijuego=${g}&mision=${m}`);
  await p.waitForSelector('.ov-mg');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/mg-${g}-${m}.png` });
  await p.close();
}
await b.close();
