// Misión dentro de una partida real: un vecino camina hasta su misión más cercana
// (piloto automático = como el joystick, validado por el servidor), juega el minijuego
// y el progreso del pueblo sube para todos.
//   node tests/e2e/mision-en-partida.mjs http://localhost:5173
import { chromium } from 'playwright';
import { play } from './jugar-minijuego.mjs';
const url = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const ok = (name, cond, extra = '') => { const l = `${cond ? 'OK ' : 'FALLO'} ${name} ${extra}`; results.push(l); console.log(l); };
const errors = [];
const until = async (page, fn, arg, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn, arg).catch(() => false)) return true; await page.waitForTimeout(250); }
  return false;
};
const pages = [];
for (let i = 0; i < 4; i++) {
  const p = await (await browser.newContext({ viewport: { width: 700, height: 520 } })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  pages.push(p);
}
await pages[0].goto(url); await pages[0].fill('#lobby-name', 'Ana'); await pages[0].click('#lobby-create');
await until(pages[0], () => !!window.__laRoda?.code?.());
const code = await pages[0].evaluate(() => window.__laRoda.code());
for (let i = 1; i < 4; i++) { await pages[i].goto(`${url}/?sala=${code}`); await pages[i].fill('#lobby-name', `J${i}`); await pages[i].click('#lobby-join'); }
await until(pages[0], () => window.__laRoda.remotes().length === 3);
await pages[0].evaluate(() => window.__laRoda.start());
await Promise.all(pages.map((p) => until(p, () => window.__laRoda.phase() === 'partida' && window.__laRoda.tasks().length > 0)));
const roles = await Promise.all(pages.map((p) => p.evaluate(() => window.__laRoda.role())));
const crew = pages[roles.findIndex((r) => r === 'roeno' || r === 'vilchez')];
for (const p of pages) await p.click('.ov-role [data-close]').catch(() => {});
const tasks = await crew.evaluate(() => window.__laRoda.tasks());
ok('el vecino tiene 4 misiones', tasks.length === 4, tasks.map((t) => `${t.missionId}@${t.lugar}`).join(' '));
// misión con el lugar más cercano (por ruta)
const target = tasks[0];
const before = await pages[0].evaluate(() => window.__laRoda.townProgress());
await crew.evaluate((n) => window.__laRoda.walkTo(n), target.lugar);
ok('llega caminando al lugar de la misión', await until(crew, (id) => window.__laRoda.taskHere() === id, target.missionId, 240000), `${target.nombre} en ${target.lugarNombre}`);
await crew.keyboard.press('KeyE');
ok('se abre el minijuego', await until(crew, () => !!document.querySelector('.ov-mg')));
const game = await crew.evaluate(() => document.querySelector('.ov-mg .mg-body')?.firstElementChild?.className ?? '');
const kind = { 'mg-hold': 'mantener', 'mg-slot': 'deslizar', 'mg-canvas': 'frotar', 'mg-pond': 'tocar', 'mg-meter': 'lanzar', 'mg-ask': 'elegir', 'mg-pills': 'contar', 'mg-kebab': 'cortar' }[game.split(' ')[0]];
await crew.evaluate(() => (window.__mgDone = false));
// el minijuego en partida no marca __mgDone: se comprueba por el progreso del servidor
const playIt = play[kind];
ok(`minijuego reconocido (${kind})`, !!playIt);
const stepBefore = target.step;
if (kind === 'lanzar' || kind === 'frotar') {
  // estos usan __mgDone para saber cuándo parar: se emula con el cierre del panel
  await crew.evaluate(() => { const o = new MutationObserver(() => { if (document.querySelector('.mg-msg')?.textContent === '¡Hecho!') window.__mgDone = true; }); o.observe(document.body, { subtree: true, childList: true, characterData: true }); });
}
await playIt(crew);
ok('el servidor acepta la misión', await until(crew, ([id, s]) => { const t = window.__laRoda.tasks().find((x) => x.missionId === id); return t && (t.done || t.step > s); }, [target.missionId, stepBefore], 15000));
ok('el progreso del pueblo sube en los 4 navegadores', (await Promise.all(pages.map((p) => until(p, (d) => window.__laRoda.townProgress().done === d + 1, before.done, 10000)))).every(Boolean), JSON.stringify(before));
ok('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
console.log('---');
await browser.close();
process.exit(results.some((r) => r.startsWith('FALLO')) ? 1 : 0);
