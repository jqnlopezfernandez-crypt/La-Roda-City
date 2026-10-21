// Partida completa en CUATRO navegadores con la interfaz real.
// Requiere cliente (:5173) y servidor (:2567) arrancados.
//   node tests/e2e/partida.mjs http://localhost:5173 <carpeta-capturas>
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? '/tmp';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const ok = (name, cond, extra = '') => { const l = `${cond ? 'OK ' : 'FALLO'} ${name} ${extra}`; results.push(l); console.log(l); };
const errors = [];
const until = async (page, fn, arg, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg).catch(() => false)) return true; await page.waitForTimeout(200); }
  return false;
};
const L = (p) => p.evaluate(() => window.__laRoda);

const names = ['Ana', 'Bea', 'Carlos', 'Dani'];
const pages = [];
for (let i = 0; i < 4; i++) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 560 } });
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
ok('los 4 están en la sala', await until(host, () => window.__laRoda.remotes().length === 3));

// El anfitrión pulsa el botón "Empezar partida" dibujado en el lienzo (abajo, centrado)
await host.waitForTimeout(500);
await host.mouse.click(380, 560 - 60);
const tStart = Date.now();
ok('la partida empieza en los 4 navegadores', (await Promise.all(pages.map((p) => until(p, () => window.__laRoda.phase() === 'partida')))).every(Boolean));
// en cuanto empieza: el impostor (sea quien sea) tiene una espera inicial > 0
const waits = await Promise.all(pages.map((p) => p.evaluate(() => (window.__laRoda.role() ? window.__laRoda.actions().killWaitS : -1))));
const startedIn = Date.now() - tStart;
ok('cada uno ve la pantalla de su rol', (await Promise.all(pages.map((p) => until(p, () => window.__laRoda.roleShown())))).every(Boolean));
await pages[1].screenshot({ path: `${out}/partida-rol.png` });
const roles = await Promise.all(pages.map((p) => p.evaluate(() => window.__laRoda.role())));
const impIdx = roles.findIndex((r) => r === 'sapo' || r === 'gitano');
ok('hay exactamente un impostor', roles.filter((r) => r === 'sapo' || r === 'gitano').length === 1, JSON.stringify(roles));
// cerrar la pantalla del rol
for (const p of pages) await p.click('.ov-role [data-close]').catch(() => {});

const imp = pages[impIdx];
ok('al principio el impostor debe esperar antes de eliminar', startedIn > 12000 || waits[impIdx] > 0, `espera=${waits[impIdx]} s, arranque en ${startedIn} ms`);
const crewIdx = [0, 1, 2, 3].filter((i) => i !== impIdx);
// Los vecinos NO saben quién es el impostor: su copia del estado no trae roles ajenos
const leaks = await Promise.all(crewIdx.map((i) => pages[i].evaluate(() => window.__laRoda.remoteIds().length)));
ok('los vecinos ven a los demás jugadores', leaks.every((n) => n === 3));

// Esperar a que pase el tiempo de espera inicial (15 s) y eliminar con la tecla Q
ok('el impostor tiene a alguien a su alcance', await until(imp, () => !!window.__laRoda.actions().kill, null, 25000));
await until(imp, () => window.__laRoda.actions().killWaitS === 0, null, 20000);
const victimId = await imp.evaluate(() => window.__laRoda.actions().kill);
await imp.keyboard.press('KeyQ');
const victimIdx = await Promise.all(pages.map((p) => p.evaluate(() => window.__laRoda.sessionId()))).then((ids) => ids.indexOf(victimId));
ok('la víctima pasa a ser fantasma', await until(pages[victimIdx], () => window.__laRoda.alive() === false));
const witnessIdx = crewIdx.find((i) => i !== victimIdx);
const witness = pages[witnessIdx];
ok('un testigo ve el cuerpo', await until(witness, (id) => window.__laRoda.bodies().includes(id), victimId));
ok('los vivos dejan de ver al fantasma', await until(witness, (id) => window.__laRoda.remoteIds().find((r) => r.id === id)?.visible === false, victimId));
await witness.screenshot({ path: `${out}/partida-cuerpo.png` });

// Reportar con la tecla F
await until(witness, () => !!window.__laRoda.actions().report);
await witness.keyboard.press('KeyF');
ok('se abre la reunión en todos', (await Promise.all(pages.map((p) => until(p, () => !!document.querySelector('.ov-meeting'))))).every(Boolean));
await witness.screenshot({ path: `${out}/partida-reunion.png` });

// Votación por la interfaz: los vecinos vivos votan al impostor; el impostor salta
const impId = await imp.evaluate(() => window.__laRoda.sessionId());
for (const i of crewIdx) {
  if (i === victimIdx) continue;
  await pages[i].click(`.mt-vecino[data-id="${impId}"]`);
}
await imp.click('.ov-meeting [data-skip]');
ok('se muestra el resultado de la votación', await until(witness, () => !!document.querySelector('.ov-result')));
await witness.screenshot({ path: `${out}/partida-resultado.png` });
ok('ganan los vecinos', await until(witness, () => !!document.querySelector('.ov-end.crew'), null, 12000));
await witness.screenshot({ path: `${out}/partida-fin.png` });

// El anfitrión vuelve a la sala
const hostIsGhost = await host.evaluate(() => window.__laRoda.alive() === false);
await host.click('.ov-end [data-back]');
ok('todos vuelven a la sala', (await Promise.all(pages.map((p) => until(p, () => window.__laRoda.phase() === 'sala')))).every(Boolean), hostIsGhost ? '(el anfitrión era fantasma)' : '');

ok('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
console.log("---");
await browser.close();
process.exit(results.some((r) => r.startsWith('FALLO')) ? 1 : 0);
