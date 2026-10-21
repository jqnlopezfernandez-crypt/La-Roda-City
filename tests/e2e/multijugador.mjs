// Prueba de extremo a extremo del multijugador con DOS navegadores independientes.
// Requiere el cliente (npm run dev, :5173) y el servidor (npm run server:dev, :2567) arrancados.
//   node tests/e2e/multijugador.mjs http://localhost:5173 <carpeta-capturas>
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? '/tmp';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'OK ' : 'FALLO'} ${name} ${extra}`);
const errors = [];
const until = async (page, fn, arg, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg).catch(() => false)) return true; await page.waitForTimeout(150); }
  return false;
};

// Jugador A: crea la sala
const ctxA = await browser.newContext({ viewport: { width: 1000, height: 640 } });
const a = await ctxA.newPage();
a.on('pageerror', (e) => errors.push('A: ' + e.message));
await a.goto(url);
await a.fill('#lobby-name', 'Ana');
await a.click('#lobby-create');
ok('A crea la sala y entra al juego', await until(a, () => !!window.__laRoda?.code?.()));
const code = await a.evaluate(() => window.__laRoda.code());
ok('el código tiene 5 caracteres', /^[A-Z0-9]{5}$/.test(code), code);

// Jugador B: otro navegador (otro "dispositivo"), entra por el enlace de invitación
const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const b = await ctxB.newPage();
b.on('pageerror', (e) => errors.push('B: ' + e.message));
await b.goto(`${url}/?sala=${code}`);
ok('el enlace rellena el código', (await b.inputValue('#lobby-code')) === code);
await b.fill('#lobby-name', 'Bea');
await b.click('#lobby-join');
ok('B entra en la sala de A', await until(b, () => window.__laRoda?.code?.() != null));
ok('A ve a Bea', await until(a, () => window.__laRoda.remotes().some((r) => r.name === 'Bea')));
ok('B ve a Ana', await until(b, () => window.__laRoda.remotes().some((r) => r.name === 'Ana')));

// A se mueve con el teclado; B debe ver el desplazamiento
const before = await b.evaluate(() => window.__laRoda.remotes().find((r) => r.name === 'Ana'));
const aStart = await a.evaluate(() => window.__laRoda.player());
await a.keyboard.down('ArrowRight'); await a.waitForTimeout(2500); await a.keyboard.up('ArrowRight');
const aEnd = await a.evaluate(() => window.__laRoda.player());
ok('A se ha movido en su pantalla', Math.hypot(aEnd.x - aStart.x, aEnd.y - aStart.y) > 10, JSON.stringify({ aStart, aEnd }));
ok('B ve moverse a Ana hasta su nueva posición', await until(b, (t) => {
  const r = window.__laRoda.remotes().find((x) => x.name === 'Ana');
  return r && Math.hypot(r.x - t.x, r.y - t.y) < 3;
}, aEnd), JSON.stringify(before));
await a.screenshot({ path: `${out}/mp-A.png` });
await b.screenshot({ path: `${out}/mp-B.png` });

// B cierra su navegador de golpe → A lo ve "sin conexión"
await ctxB.close();
ok('A ve a Bea sin conexión tras cerrar su navegador', await until(a, () => window.__laRoda.remotes().some((r) => r.name === 'Bea' && !r.connected)));

ok('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
process.exit(results.some((r) => r.startsWith('FALLO')) ? 1 : 0);
