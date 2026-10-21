// Sabotaje crítico en CUATRO navegadores: el impostor lo elige en su menú, todos ven la
// cuenta atrás y dos vecinos (o el Conserje) lo arreglan con el minijuego.
// Requiere cliente y servidor arrancados:  node tests/e2e/sabotaje.mjs http://localhost:5173 <carpeta>
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? '/tmp';
// cabeza: Sagrado Corazón (n.º 17, cerca de la salida); riada: Puente Erillas (n.º 16, lejos)
const KIND = process.argv[4] ?? 'cabeza';
const SITE = { cabeza: 17, piscina: 31, riada: 16 }[KIND];
const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const ok = (name, cond, extra = '') => console.log(`${cond ? 'OK ' : 'FALLO'} ${name} ${extra}`);
const errors = [];
const until = async (page, fn, arg, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg).catch(() => false)) return true; await page.waitForTimeout(200); }
  return false;
};
const names = ['Ana', 'Bea', 'Carlos', 'Dani'];
const pages = [];
const browsers = [];
for (let i = 0; i < 4; i++) {
  // un navegador por jugador: así ninguno se queda en segundo plano (sin fotogramas)
  const browser = await launch();
  browsers.push(browser);
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${names[i]}: ${e.message}`));
  pages.push(p);
}
const [host] = pages;
await host.goto(url);
await host.fill('#lobby-name', names[0]);
await host.click('#lobby-create');
await until(host, () => !!window.__laRoda?.code?.());
const code = await host.evaluate(() => window.__laRoda.code());
for (let i = 1; i < 4; i++) {
  await pages[i].goto(`${url}/?sala=${code}`);
  await pages[i].fill('#lobby-name', names[i]);
  await pages[i].click('#lobby-join');
}
await until(host, () => window.__laRoda.remotes().length === 3);
await host.evaluate(() => window.__laRoda.start());
ok('empieza la partida', (await Promise.all(pages.map((p) => until(p, () => window.__laRoda.phase() === 'partida')))).every(Boolean));
await Promise.all(pages.map((p) => until(p, () => !!window.__laRoda.role())));
const roles = await Promise.all(pages.map((p) => p.evaluate(() => window.__laRoda.role())));
console.log('roles', roles.join(', '));
const impIdx = roles.findIndex((r) => ['sapo', 'gitano', 'piromano'].includes(r));
const imp = pages[impIdx];
const crew = pages.filter((_, i) => i !== impIdx).slice(0, 2);
// cerrar la tarjeta de rol y mandar a dos vecinos al Puente Erillas (n.º 16)
for (const p of pages) await p.evaluate(() => document.querySelectorAll('.ov-role').forEach((e) => e.remove()));
for (const p of crew) console.log('camino al sitio', await p.evaluate((n) => window.__laRoda.walkTo(n), SITE));
const where = async () => Promise.all(crew.map((p) => p.evaluate(() => ({ pos: window.__laRoda.player(), walking: window.__laRoda.walking(), near: window.__laRoda.nearestPoi(), fps: Math.round(window.__laRodaGame?.loop?.actualFps ?? 0) }))));
ok('el impostor ve el botón de sabotear', await until(imp, () => window.__laRoda.actions().sabotageWaitS >= 0, null, 10000));
ok('puede sabotear a los 25 s', await until(imp, () => window.__laRoda.actions().sabotageWaitS === 0, null, 40000));
// (el entorno de pruebas va a pocos fotogramas: se espera a que lleguen antes de sabotear)
for (const p of crew) ok('vecino llega al sitio', await until(p, () => !window.__laRoda.walking(), null, 150000));
console.log('vecinos', JSON.stringify(await where()));
await imp.evaluate(() => window.__laRoda.act('sabotear'));
ok('se abre el menú ilustrado', await until(imp, () => document.querySelectorAll('.sab-opt').length === 3));
await imp.screenshot({ path: `${out}/sab-menu.png` });
await imp.click(`.sab-opt[data-k="${KIND}"]`);
ok('todos ven la cuenta atrás', (await Promise.all(pages.map((p) => until(p, () => !!window.__laRoda.sabotageHud(), null, 8000)))).every(Boolean));
for (const p of crew) ok('vecino puede arreglarlo', await until(p, (k) => window.__laRoda.actions().fix === k, KIND, 38000));
const t0 = Date.now();
console.log('vecinos', JSON.stringify(await where()));
await crew[0].screenshot({ path: `${out}/sab-mundo.png` });
// los dos a la vez (el entorno de pruebas es lento y solo hay 40 s)
await Promise.all(crew.map(async (p, k) => {
  await p.evaluate(() => window.__laRoda.act('arreglar'));
  await until(p, () => !!document.querySelector('.mg-stage'));
  const stage = await p.locator('.mg-stage').boundingBox();
  const H = KIND === 'piscina' ? 250 : 260;
  const at = (x, y) => ({ x: stage.x + (x / 360) * stage.width, y: stage.y + (y / H) * stage.height });
  const drag = async (a, b) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps: 12 }); await p.mouse.up(); };
  if (KIND === 'cabeza') await drag(at(64, 222), at(182, 80));
  if (KIND === 'riada') for (let i = 0; i < 3; i++) await drag(at(30 + i * 6, 176 + i * 22), at([96, 180, 264][i], 110));
  if (KIND === 'piscina') {
    const poops = await p.$$eval('.mg-poop', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    const net = await p.locator('.mg-net').boundingBox();
    await p.mouse.move(net.x + net.width * 0.37, net.y + net.height * 0.37); await p.mouse.down();
    for (const q of poops) await p.mouse.move(q.x, q.y, { steps: 8 });
    await p.mouse.up();
  }
  console.log('segundos desde el sabotaje', Math.round((Date.now() - t0) / 1000));
  if (k === 0) await p.screenshot({ path: `${out}/sab-minijuego.png` });
  await p.waitForTimeout(2500);
  const fixes = await p.evaluate(() => window.__laRoda.sabotageHud()?.fixes ?? 'fin');
  console.log('arreglos tras el vecino', k + 1, fixes, await p.evaluate(() => [window.__laRoda.phase(), document.querySelector('.ov-end')?.textContent?.slice(0, 120)]));
}));
ok('el sabotaje queda arreglado en todos', (await Promise.all(pages.map((p) => until(p, () => window.__laRoda.sabotageHud() === null, null, 8000)))).every(Boolean));
const phase = await host.evaluate(() => [window.__laRoda.phase(), document.querySelector('.ov-end')?.className ?? '', document.querySelector('.ov-end')?.innerText?.slice(0, 140) ?? '']);
ok('la partida sigue (no ganan los impostores por el sabotaje)', phase[0] === 'partida', JSON.stringify(phase));
console.log('errores', errors);
await Promise.all(browsers.map((b) => b.close()));
