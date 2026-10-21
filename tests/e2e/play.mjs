// Requiere Playwright (no incluido en las dependencias para no descargar navegadores en el PC):
//   node tests/e2e/play.mjs http://localhost:5173 <carpeta-capturas>
// Prueba de juego real en Chromium: teclado, joystick táctil, colisiones e interacción.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? '/tmp';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const results = [];
const ok = (name, cond, extra='') => { results.push(`${cond ? 'OK ' : 'FALLO'} ${name} ${extra}`); };
const errors = [];
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForTimeout(2500);
  const p0 = await page.evaluate(() => window.__laRoda.player());
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2000); await page.keyboard.up('ArrowRight');
  const pR = await page.evaluate(() => window.__laRoda.player());
  ok('teclado: flecha derecha mueve al personaje', Math.hypot(pR.x-p0.x, pR.y-p0.y) > 20, JSON.stringify({p0,pR}));
  for (const [key, ms] of [['ArrowRight',1200],['KeyW',1200],['ArrowLeft',1500],['KeyS',2500],['KeyD',2000]]) {
    await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
    const w = await page.evaluate(() => window.__laRoda.walkable());
    ok(`teclado ${key}: sigue en la calle`, w);
  }
  // empujar mucho tiempo contra una fachada
  await page.keyboard.down('KeyA'); await page.keyboard.down('KeyW'); await page.waitForTimeout(4000);
  await page.keyboard.up('KeyA'); await page.keyboard.up('KeyW');
  ok('empujar contra fachadas no atraviesa manzanas', await page.evaluate(() => window.__laRoda.walkable()));
  // interacción: ir junto al Ayuntamiento
  await page.evaluate(() => window.__laRoda.goToPoi(11));
  await page.waitForTimeout(400);
  const near = await page.evaluate(() => window.__laRoda.nearestPoi());
  ok('detecta un lugar cercano', !!near, String(near));
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  ok('la tecla E abre el panel del lugar', await page.evaluate(() => window.__laRoda.panelOpen()));
  await page.screenshot({ path: `${out}/e2e-panel.png` });
  await page.close();
}
{
  // móvil vertical con pantalla táctil
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForTimeout(2500);
  const p0 = await page.evaluate(() => window.__laRoda.player());
  // arrastre en la zona del joystick (mitad izquierda, parte baja)
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 90, 720);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', 90 + i * 5, 720 - i * 4); await page.waitForTimeout(30); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/e2e-movil.png` });
  await touch('touchEnd', 0, 0);
  const p1 = await page.evaluate(() => window.__laRoda.player());
  ok('joystick táctil mueve al personaje', Math.hypot(p1.x-p0.x, p1.y-p0.y) > 30, JSON.stringify({p0,p1}));
  ok('joystick: sigue en la calle', await page.evaluate(() => window.__laRoda.walkable()));
  await ctx.close();
}
ok('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
process.exit(results.some(r => r.startsWith('FALLO')) ? 1 : 0);
