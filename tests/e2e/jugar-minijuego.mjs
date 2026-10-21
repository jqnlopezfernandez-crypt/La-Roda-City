// Cómo juega una persona cada minijuego (lo usan varias pruebas e2e).
/** Cómo juega una persona cada minijuego. */
export const play = {
  async mantener(p) {
    const b = await p.locator('.mg-holdbtn').boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await p.mouse.down(); await p.waitForTimeout(1800); await p.mouse.up();
  },
  async deslizar(p) {
    const slot = await p.locator('.mg-slot').boundingBox();
    const card = await p.locator('.mg-card').boundingBox();
    await p.mouse.move(card.x + 20, card.y + 20); await p.mouse.down();
    for (let i = 1; i <= 20; i++) { await p.mouse.move(card.x + 20 + (slot.width * i) / 20, card.y + 20); await p.waitForTimeout(50); }
    await p.mouse.up();
  },
  async frotar(p) {
    const c = await p.locator('.mg-canvas').boundingBox();
    for (let pass = 0; pass < 12 && !(await p.evaluate(() => window.__mgDone)); pass++) {
      await p.mouse.move(c.x + 2, c.y + 2); await p.mouse.down();
      for (let row = 0; row <= 11; row++) {
        const y = c.y + (c.height * row) / 11;
        await p.mouse.move(c.x + (row % 2 ? c.width : 2), y, { steps: 25 });
      }
      await p.mouse.up();
    }
  },
  async tocar(p) { for (let i = 0; i < 6; i++) await p.locator('.mg-pond').click({ position: { x: 40 + i * 30, y: 90 } }); },
  async lanzar(p) {
    for (let i = 0; i < 400 && !(await p.evaluate(() => window.__mgDone)); i++) {
      const inside = await p.evaluate(() => {
        const m = document.querySelector('.mg-meter i').getBoundingClientRect();
        const z = document.querySelector('.mg-meter b').getBoundingClientRect();
        const c = m.left + m.width / 2; return c > z.left + 4 && c < z.right - 4;
      });
      if (inside) await p.click('.ov-mg .btn-primary');
      await p.waitForTimeout(10);
    }
  },
  async estanco(p) {
    const want = await p.textContent('.mg-ask b');
    await p.click(`[data-o="${want}"]`);
    // la caja: cobrar el precio exacto con las monedas (de mayor a menor)
    let cents = Math.round(parseFloat((await p.textContent('p.mg-ask b')).replace(',', '.')) * 100);
    for (const c of [200, 100, 50, 20, 10]) while (cents >= c) { await p.click(`[data-c="${c}"]`); cents -= c; }
    await p.click('[data-ok]');
  },
  async contar(p) {
    const n = await p.locator('.mg-pills i').count();
    for (let i = 0; i < n; i++) await p.click('[data-d="1"]');
    await p.click('[data-ok]');
  },
  async cortar(p) {
    const k = await p.locator('.mg-kebab').boundingBox();
    for (let i = 0; i < 4; i++) {
      const x = k.x + k.width * (0.3 + i * 0.12);
      await p.mouse.move(x, k.y + 10); await p.mouse.down();
      await p.mouse.move(x, k.y + k.height - 10, { steps: 10 }); await p.mouse.up();
    }
  },
};

