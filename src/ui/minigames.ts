/**
 * Minijuegos de las misiones (HTML + eventos de puntero: valen para dedo y ratón).
 * Cada uno llama a `done()` cuando se completa. La validación final la hace el
 * servidor (lugar y tiempo mínimo), así que aquí solo importa que sea jugable.
 */
import {
  TOBACCO_BRANDS,
  barCounterScene,
  barScene,
  cardReaderScene,
  coinSvg,
  courtScene,
  cubataGlassSvg,
  drawPlate,
  drawSalonFloor,
  fishSvg,
  footballSvg,
  goalScene,
  goalkeeperSvg,
  iceCubeShape,
  kebabScene,
  knifeSvg,
  pillSvg,
  pillTrayScene,
  pondScene,
  prayScene,
  tillScene,
  tobaccoPackSvg,
  trainCardSvg,
} from "../art/minigames";

interface MiniGameContext {
  body: HTMLElement;
  missionId: string;
  /** Muestra un mensaje bajo el minijuego. */
  say: (msg: string) => void;
  done: () => void;
}

export interface MiniGameOptions {
  title: string;
  text: string;
  /** Tipo de minijuego (campo `juego` del paso de la misión). */
  game: string;
  /** Tiempo mínimo del paso (lo usa "mantener"). */
  minMs: number;
  missionId: string;
  onDone: () => void;
  onClose: () => void;
}

const randRange = (min: number, max: number) => min + Math.random() * (max - min);

/** <img> con un SVG incrustado como data URL. */
const svgImg = (svg: string, className = "", style = "") =>
  `<img class="${className}" style="${style}" alt="" draggable="false" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">`;

/** Mantener pulsado `ms` milisegundos (en "rezar", con la estatua y la vela). */
function holdGame({ body, done, say, missionId }: MiniGameContext, ms: number) {
  const praying = missionId === "rezar";
  body.innerHTML = `<div class="mg-hold">${praying ? prayScene() : ""}<div class="mg-bar"><i></i></div><button class="btn btn-primary mg-holdbtn">${praying ? "Mant\xE9n pulsado para rezar" : "Mant\xE9n pulsado"}</button></div>`;
  const wrap = body.querySelector<HTMLElement>(".mg-hold")!;
  const bar = body.querySelector<HTMLElement>(".mg-bar i")!;
  const button = body.querySelector<HTMLButtonElement>(".mg-holdbtn")!;
  let startedAt = 0;
  let frame = 0;
  const setProgress = (k: number) => {
    bar.style.width = `${k * 100}%`;
    // --k anima la vela y el halo
    wrap.style.setProperty("--k", String(k));
  };
  const tick = () => {
    const k = Math.min(1, (performance.now() - startedAt) / ms);
    setProgress(k);
    if (k >= 1) return done();
    frame = requestAnimationFrame(tick);
  };
  button.addEventListener("pointerdown", (event) => {
    button.setPointerCapture(event.pointerId);
    startedAt = performance.now();
    say(praying ? "La vela se va encendiendo…" : "Sigue…");
    tick();
  });
  const release = () => {
    if (bar.style.width !== "100%") {
      cancelAnimationFrame(frame);
      setProgress(0);
      say("\xA1No sueltes antes de tiempo!");
    }
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
}

/** Deslizar a velocidad constante: la tarjeta del tren por el lector, o el cubata por la barra. */
function swipeGame({ body, done, say, missionId }: MiniGameContext) {
  const isDrink = missionId === "cubata";
  body.innerHTML = `<div class="mg-slot ${isDrink ? "mg-slot-bar" : ""}">${isDrink ? barCounterScene() : cardReaderScene()}<div class="mg-card">${svgImg(isDrink ? cubataGlassSvg() : trainCardSvg())}</div></div>`;
  const slot = body.querySelector<HTMLElement>(".mg-slot")!;
  const card = body.querySelector<HTMLElement>(".mg-card")!;
  let startedAt = 0;
  let startX = 0;
  card.addEventListener("pointerdown", (event) => {
    card.setPointerCapture(event.pointerId);
    startedAt = performance.now();
    startX = event.clientX;
  });
  card.addEventListener("pointermove", (event) => {
    if (!startedAt) return;
    const maxShift = slot.clientWidth - card.clientWidth;
    card.style.transform = `translateX(${Math.max(0, Math.min(maxShift, event.clientX - startX))}px)`;
  });
  card.addEventListener("pointerup", (event) => {
    const maxShift = slot.clientWidth - card.clientWidth;
    const distance = event.clientX - startX;
    const elapsed = performance.now() - startedAt;
    startedAt = 0;
    card.style.transform = "translateX(0)";
    if (distance < maxShift * 0.9) {
      return say(isDrink ? "Ll\xE9valo hasta el cliente, al final de la barra." : "Pasa la tarjeta por todo el lector.");
    }
    if (elapsed < 500) return say(isDrink ? "\xA1Demasiado r\xE1pido, se derrama! Otra vez." : "\xA1Demasiado r\xE1pido! Otra vez.");
    if (elapsed > 2500) return say("Demasiado lento. Otra vez.");
    slot.classList.add("ok");
    done();
  });
}

/** Frotar: limpiar la salsa del plato o barrer los mechones de pelo (canvas). */
function rubGame({ body, done, say }: MiniGameContext, kind: "plato" | "pelo") {
  const width = 300;
  const height = 220;
  body.innerHTML = `<canvas class="mg-canvas" width="${width * 2}" height="440"></canvas>`;
  const canvas = body.querySelector("canvas")!;
  const g = canvas.getContext("2d")!;
  g.scale(2, 2);
  // Manchas (en el plato, repartidas en círculo; el pelo, por todo el suelo)
  const spots = Array.from({ length: 12 }, () => {
    const angle = randRange(0, Math.PI * 2);
    const radius = kind === "plato" ? randRange(0, 70) : 0;
    return {
      x: kind === "plato" ? width / 2 + Math.cos(angle) * radius : randRange(30, 270),
      y: kind === "plato" ? height / 2 + Math.sin(angle) * radius * 0.85 : randRange(30, 190),
      r: randRange(10, 17),
      left: 1,
      seed: Math.random() * 1e3,
    };
  });
  const bubbles: { x: number; y: number; r: number }[] = [];
  let pointer: { x: number; y: number } | null = null;
  const hairColors = ["#3b2a20", "#6b4a2e", "#b9b2a4", "#1f1a17"];

  const draw = () => {
    g.clearRect(0, 0, width, height);
    if (kind === "plato") drawPlate(g, width, height);
    else drawSalonFloor(g, width, height);
    for (const spot of spots) {
      if (spot.left <= 0) continue;
      g.globalAlpha = spot.left;
      if (kind === "plato") {
        // Mancha de salsa irregular con tropezones
        g.fillStyle = "#9a3a1e";
        g.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const r = spot.r * (0.75 + ((spot.seed * (i + 1)) % 1) * 0.5);
          if (i) g.lineTo(spot.x + Math.cos(a) * r, spot.y + Math.sin(a) * r);
          else g.moveTo(spot.x + Math.cos(a) * r, spot.y + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        g.fillStyle = "#c98a4e";
        for (let i = 0; i < 4; i++) g.fillRect(spot.x + Math.cos(spot.seed + i) * spot.r * 1.2, spot.y + Math.sin(spot.seed * 2 + i) * spot.r, 3, 3);
      } else {
        // Mechón: varios rizos
        g.strokeStyle = hairColors[Math.floor(spot.seed) % hairColors.length];
        g.lineWidth = 1.6;
        g.lineCap = "round";
        for (let i = 0; i < 9; i++) {
          const a = spot.seed + i * 0.7;
          const x = spot.x + Math.cos(a) * spot.r * 0.6;
          const y = spot.y + Math.sin(a * 1.3) * spot.r * 0.5;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + 6, y - 8, x + 12, y + 6, x + 16 * Math.cos(a), y + 10 * Math.sin(a));
          g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
    for (const bubble of bubbles) {
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.strokeStyle = "rgba(42,28,20,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // Herramienta bajo el puntero: estropajo o escoba
    if (pointer) {
      g.save();
      g.translate(pointer.x, pointer.y);
      if (kind === "plato") {
        g.fillStyle = "#e8d24a";
        g.fillRect(-16, -10, 32, 14);
        g.fillStyle = "#3f7a35";
        g.fillRect(-16, 4, 32, 7);
        g.strokeStyle = "#2a1c14";
        g.lineWidth = 2;
        g.strokeRect(-16, -10, 32, 21);
      } else {
        g.rotate(-0.5);
        g.fillStyle = "#c98a2e";
        g.fillRect(-24, -6, 48, 12);
        g.strokeStyle = "#2a1c14";
        g.lineWidth = 2;
        g.strokeRect(-24, -6, 48, 12);
        g.fillStyle = "#8a5a34";
        g.fillRect(-3, -62, 6, 56);
        g.strokeRect(-3, -62, 6, 56);
        g.strokeStyle = "#6b4a2e";
        for (let x = -20; x <= 20; x += 5) {
          g.beginPath();
          g.moveTo(x, 6);
          g.lineTo(x * 1.15, 16);
          g.stroke();
        }
      }
      g.restore();
    }
  };
  draw();

  let rubbing = false;
  const onMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height };
    // Cuenta aunque el arrastre empezara fuera del dibujo
    if (rubbing || event.buttons & 1) {
      for (const spot of spots) if (Math.hypot(spot.x - pointer.x, spot.y - pointer.y) < spot.r + 14) spot.left -= 0.12;
      if (kind === "plato" && Math.random() < 0.5) {
        bubbles.push({ x: pointer.x + randRange(-10, 10), y: pointer.y + randRange(-8, 8), r: randRange(2, 6) });
      }
      if (bubbles.length > 60) bubbles.shift();
    }
    draw();
    if (spots.every((spot) => spot.left <= 0)) done();
  };
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    rubbing = true;
    say(kind === "plato" ? "Frota la salsa hasta que el plato quede limpio" : "Barre todos los mechones");
  });
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", () => (rubbing = false));
}

/** Echar comida a los peces: tocar el estanque 6 veces. */
function feedFishGame({ body, done, say }: MiniGameContext) {
  const fishColors = ["#f08a24", "#f3ead6", "#e2521f", "#f2c230"];
  body.innerHTML = `<div class="mg-pond">${pondScene()}${fishColors
    .map((color, i) => svgImg(fishSvg(color), "mg-fish", `left:${20 + i * 17}%;top:${35 + (i % 2) * 22}%;animation-delay:${-i * 1.3}s`))
    .join("")}</div>`;
  const pond = body.querySelector<HTMLElement>(".mg-pond")!;
  const fishes = [...pond.querySelectorAll<HTMLElement>(".mg-fish")];
  let fed = 0;
  pond.addEventListener("pointerdown", (event) => {
    const rect = pond.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Onda donde cae la comida
    const ripple = document.createElement("i");
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    pond.appendChild(ripple);
    // Un pez (por turnos) acude a comer
    const fish = fishes[fed % fishes.length];
    fish.style.left = `${((x - 28) / rect.width) * 100}%`;
    fish.style.top = `${((y - 14) / rect.height) * 100}%`;
    window.setTimeout(() => ripple.remove(), 900);
    fed++;
    say(`Comida: ${fed}/6`);
    if (fed >= 6) done();
  });
}

/** Canasta: pulsar cuando el indicador oscilante esté en la zona buena. */
function throwGame({ body, done, say }: MiniGameContext) {
  body.innerHTML = `<div class="mg-court-wrap">${courtScene()}</div><div class="mg-meter"><b></b><i></i></div><button class="btn btn-primary">\xA1Lanzar!</button>`;
  const court = body.querySelector<HTMLElement>(".mg-court-wrap")!;
  const marker = body.querySelector<HTMLElement>(".mg-meter i")!;
  const zone = body.querySelector<HTMLElement>(".mg-meter b")!;
  const zoneStart = randRange(0.25, 0.6);
  zone.style.left = `${zoneStart * 100}%`;
  zone.style.width = "18%";
  let position = 0;
  let direction = 1;
  let frame = 0;
  const animate = () => {
    position += direction * 0.012;
    if (position > 1 || position < 0) direction *= -1;
    marker.style.left = `${Math.max(0, Math.min(1, position)) * 100}%`;
    frame = requestAnimationFrame(animate);
  };
  animate();
  body.querySelector("button")!.addEventListener("click", () => {
    const scored = position >= zoneStart && position <= zoneStart + 0.18;
    court.classList.remove("tiro", "fallo");
    // Fuerza un reflujo para reiniciar la animación CSS
    void court.offsetWidth;
    court.classList.add(scored ? "tiro" : "fallo");
    if (scored) {
      cancelAnimationFrame(frame);
      say("\xA1Canasta!");
      done();
    } else {
      say(position < zoneStart ? "\xA1Corto! Otra vez." : "\xA1Largo! Otra vez.");
    }
  });
}

/** Penaltis: marcar 3 goles tirando lejos de donde está el portero. */
function penaltyGame({ body, done, say }: MiniGameContext) {
  body.innerHTML = `<div class="mg-goal" data-k="0.5">${goalScene()}${svgImg(goalkeeperSvg(), "mg-keeper")}${svgImg(footballSvg(), "mg-ball")}
    <div class="mg-zones"><button data-z="0.17" aria-label="Tirar a la izquierda"></button><button data-z="0.5" aria-label="Tirar al centro"></button><button data-z="0.83" aria-label="Tirar a la derecha"></button></div></div>
    <div class="mg-score">Goles: 0/3</div>`;
  const goal = body.querySelector<HTMLElement>(".mg-goal")!;
  const keeper = body.querySelector<HTMLElement>(".mg-keeper")!;
  const ball = body.querySelector<HTMLElement>(".mg-ball")!;
  const score = body.querySelector<HTMLElement>(".mg-score")!;
  /** Posición 0–1 en la portería → % horizontal en la escena. */
  const toPercent = (k: number) => 14 + k * 72;
  let keeperPos = 0.5;
  let direction = 1;
  const speed = randRange(8e-3, 0.013);
  let goals = 0;
  let frame = 0;
  let shooting = false;
  const animate = () => {
    if (!shooting) {
      keeperPos += direction * speed;
      if (keeperPos > 0.85 || keeperPos < 0.15) {
        direction *= -1;
        keeperPos = Math.max(0.15, Math.min(0.85, keeperPos));
      }
      // A veces cambia de lado sin avisar
      if (Math.random() < 0.01) direction *= -1;
    }
    keeper.style.left = `${toPercent(keeperPos)}%`;
    goal.dataset.k = keeperPos.toFixed(3);
    frame = requestAnimationFrame(animate);
  };
  animate();
  goal.querySelectorAll<HTMLButtonElement>("button").forEach((zoneButton) =>
    zoneButton.addEventListener("click", () => {
      if (shooting) return;
      const target = Number(zoneButton.dataset.z);
      shooting = true;
      const isGoal = Math.abs(keeperPos - target) > 0.2;
      ball.style.left = `${toPercent(target)}%`;
      ball.classList.add("shot");
      if (!isGoal) keeper.classList.add("dive");
      window.setTimeout(() => {
        ball.classList.remove("shot");
        ball.style.left = "50%";
        keeper.classList.remove("dive");
        shooting = false;
      }, 520);
      if (isGoal) {
        goals++;
        score.textContent = `Goles: ${goals}/3`;
        say("\xA1Gol!");
        if (goals >= 3) {
          cancelAnimationFrame(frame);
          done();
        }
      } else {
        say("\xA1Parada del portero! Otra vez.");
      }
    }),
  );
}

/** Estanco: encontrar la marca que pide el cliente y cobrar el importe exacto con monedas. */
function tobaccoShopGame({ body, done, say }: MiniGameContext) {
  const shelf = [...TOBACCO_BRANDS].sort(() => Math.random() - 0.5);
  const wanted = shelf[Math.floor(Math.random() * shelf.length)];
  const price = 450 + 10 * Math.floor(Math.random() * 16);
  const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";
  body.innerHTML = `<div class="mg-ask"><span class="mg-bubble">${svgImg(tobaccoPackSvg(wanted, 99, true))}<span>\xABUn paquete de <b>${wanted.name}</b>, por favor\xBB</span></span></div>
    <div class="mg-shelf">${shelf.map((brand, i) => `<button class="mg-pack" data-o="${brand.name}" aria-label="${brand.name}">${svgImg(tobaccoPackSvg(brand, i * 7, i % 3 === 1))}</button>`).join("")}</div>`;
  body.querySelectorAll<HTMLElement>("[data-o]").forEach((pack) =>
    pack.addEventListener("click", () => {
      if (pack.dataset.o !== wanted.name) {
        pack.classList.add("mal");
        window.setTimeout(() => pack.classList.remove("mal"), 400);
        return say("Esa no es la marca que pide.");
      }
      say("");
      showTill();
    }),
  );

  /** Segunda parte: la caja registradora. */
  function showTill() {
    let paid = 0;
    body.innerHTML = `<p class="mg-ask">${wanted.name}: cobra <b>${euros(price)}</b></p>
      <div class="mg-till">${tillScene()}${svgImg(tobaccoPackSvg(wanted, 99), "mg-till-pack")}</div>
      <div class="mg-coins">${[200, 100, 50, 20, 10].map((cents) => `<button class="mg-coin" data-c="${cents}" aria-label="${euros(cents)}">${svgImg(coinSvg(cents))}</button>`).join("")}</div>
      <div class="mg-grid"><button class="btn" data-reset>Empezar de nuevo</button><button class="btn btn-primary" data-ok>Cobrar</button></div>`;
    const display = body.querySelector(".mg-display")!;
    body.querySelectorAll<HTMLElement>("[data-c]").forEach((coin) =>
      coin.addEventListener("click", () => {
        paid += Number(coin.dataset.c);
        display.textContent = euros(paid);
      }),
    );
    body.querySelector("[data-reset]")!.addEventListener("click", () => {
      paid = 0;
      display.textContent = euros(0);
    });
    body.querySelector("[data-ok]")!.addEventListener("click", () => {
      if (paid === price) done();
      else say(paid > price ? "Has cobrado de m\xE1s." : "Falta dinero.");
    });
  }
}

/** Contar las pastillas de la bandeja (entre 3 y 8). */
function countPillsGame({ body, done, say }: MiniGameContext) {
  const pills = 3 + Math.floor(Math.random() * 6);
  body.innerHTML = `<div class="mg-pills">${pillTrayScene()}${Array.from({ length: pills }, (_, i) => `<i style="left:${randRange(5, 72)}%;top:${randRange(10, 72)}%;transform:rotate(${randRange(-60, 60)}deg)">${svgImg(pillSvg(i))}</i>`).join("")}</div>
    <div class="mg-count"><button class="btn" data-d="-1">−</button><b>0</b><button class="btn" data-d="1">+</button><button class="btn btn-primary" data-ok>Listo</button></div>`;
  let count = 0;
  const counter = body.querySelector<HTMLElement>(".mg-count b")!;
  body.querySelectorAll<HTMLElement>("[data-d]").forEach((button) =>
    button.addEventListener("click", () => {
      count = Math.max(0, count + Number(button.dataset.d));
      counter.textContent = String(count);
    }),
  );
  body.querySelector("[data-ok]")!.addEventListener("click", () => (count === pills ? done() : say("No es esa cantidad. Cuenta otra vez.")));
}

/** Cortar el kebab: 4 tajos de arriba abajo. */
function cutKebabGame({ body, done, say }: MiniGameContext) {
  body.innerHTML = `<div class="mg-kebab">${kebabScene()}${svgImg(knifeSvg(), "mg-knife")}<span>0/4</span></div>`;
  const scene = body.querySelector<HTMLElement>(".mg-kebab")!;
  const counter = scene.querySelector<HTMLElement>("span")!;
  const knife = scene.querySelector<HTMLElement>(".mg-knife")!;
  const meat = scene.querySelector<SVGGElement>(".mg-meat")!;
  let startY = 0;
  let startX = 0;
  let cuts = 0;
  const moveKnife = (event: PointerEvent) => {
    const rect = scene.getBoundingClientRect();
    knife.style.left = `${event.clientX - rect.left}px`;
    knife.style.top = `${event.clientY - rect.top}px`;
  };
  scene.addEventListener("pointermove", moveKnife);
  scene.addEventListener("pointerdown", (event) => {
    scene.setPointerCapture(event.pointerId);
    startY = event.clientY;
    startX = event.clientX;
    moveKnife(event);
  });
  scene.addEventListener("pointerup", (event) => {
    const dy = event.clientY - startY;
    const dx = Math.abs(event.clientX - startX);
    // Vale si baja más de la mitad de la escena y casi en vertical
    if (dy > scene.clientHeight * 0.55 && dx < dy * 0.5) {
      cuts++;
      counter.textContent = `${cuts}/4`;
      meat.style.transform = `translateX(${cuts * 3}px) scaleX(${1 - cuts * 0.06})`;
      const slice = document.createElement("b");
      slice.className = "mg-slice";
      slice.style.left = `${startX - scene.getBoundingClientRect().left}px`;
      scene.appendChild(slice);
      if (cuts >= 4) done();
    } else {
      say("Corta de arriba abajo, de un tir\xF3n.");
    }
  });
}

type CubataStep = "hielo" | "ron" | "cola" | "fin";

/** El cubata: 3 hielos, ron hasta la primera marca y refresco hasta la segunda (manteniendo pulsado). */
function cubataGame({ body, done, say }: MiniGameContext) {
  body.innerHTML = `<div class="mg-cubata" data-paso="hielo" data-ron="0" data-cola="0">${barScene()}</div>
    <div class="mg-grid mg-grid3"><button class="btn" data-ice>\u{1F9CA} Hielo</button><button class="btn" data-pour="ron">Ron</button><button class="btn" data-pour="cola">Refresco</button></div>`;
  const scene = body.querySelector<HTMLElement>(".mg-cubata")!;
  const ice = scene.querySelector<SVGGElement>(".mg-ice")!;
  const rumRect = scene.querySelector<SVGRectElement>(".mg-liquid-ron")!;
  const colaRect = scene.querySelector<SVGRectElement>(".mg-liquid-cola")!;
  // Márgenes válidos (altura del líquido en unidades del SVG)
  const rumRange = [20, 32];
  const colaRange = [78, 90];
  let iceCubes = 0;
  let rum = 0;
  /** Altura total del líquido (ron + refresco). */
  let total = 0;
  let step: CubataStep = "hielo";
  const render = () => {
    rumRect.setAttribute("y", String(196 - rum));
    rumRect.setAttribute("height", String(rum));
    colaRect.setAttribute("y", String(196 - total));
    colaRect.setAttribute("height", String(total));
    scene.dataset.paso = step;
    scene.dataset.ron = rum.toFixed(1);
    scene.dataset.cola = total.toFixed(1);
  };
  body.querySelector("[data-ice]")!.addEventListener("click", () => {
    if (step !== "hielo") return;
    ice.insertAdjacentHTML("beforeend", iceCubeShape(156 + (iceCubes % 3) * 15, 176 - Math.floor(iceCubes / 3) * 14 - (iceCubes % 2) * 4, iceCubes + 50));
    iceCubes++;
    if (iceCubes >= 3) {
      step = "ron";
      say("Ahora el ron: mant\xE9n pulsado y suelta en la primera marca.");
    } else {
      say(`Hielo: ${iceCubes}/3`);
    }
    render();
  });

  let frame = 0;
  let lastFrameAt = 0;
  let pouring: "ron" | "cola" | null = null;
  const pourFrame = (now: number) => {
    const dt = Math.min(50, now - lastFrameAt) / 1e3;
    lastFrameAt = now;
    if (pouring === "ron") {
      rum += dt * 18;
      total = rum;
    } else if (pouring === "cola") {
      total += dt * 30;
    }
    scene.classList.toggle("vertiendo-ron", pouring === "ron");
    scene.classList.toggle("vertiendo-cola", pouring === "cola");
    render();
    // Si se desborda el vaso se corta solo
    if (total > 104) stopPouring();
    else frame = requestAnimationFrame(pourFrame);
  };
  const stopPouring = () => {
    if (!pouring) return;
    cancelAnimationFrame(frame);
    const poured = pouring;
    pouring = null;
    scene.classList.remove("vertiendo-ron", "vertiendo-cola");
    if (poured === "ron") {
      if (rum < rumRange[0]) return say("Falta ron. Sigue echando.");
      if (rum > rumRange[1]) {
        rum = total = 0;
        render();
        return say("\xA1Te has pasado de ron! Empieza el vaso otra vez.");
      }
      step = "cola";
      say("Ahora el refresco hasta la segunda marca.");
    } else {
      if (total < colaRange[0]) return say("Falta refresco.");
      if (total > colaRange[1]) {
        rum = total = 0;
        step = "ron";
        render();
        return say("\xA1Se ha desbordado! Otra vez desde el ron.");
      }
      step = "fin";
      render();
      done();
    }
    render();
  };
  body.querySelectorAll<HTMLElement>("[data-pour]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      const liquid = button.dataset.pour as "ron" | "cola";
      if (step !== liquid) return say(step === "hielo" ? "Primero el hielo." : step === "ron" ? "Primero el ron." : "");
      button.setPointerCapture(event.pointerId);
      pouring = liquid;
      lastFrameAt = performance.now();
      frame = requestAnimationFrame(pourFrame);
    });
    button.addEventListener("pointerup", stopPouring);
    button.addEventListener("pointercancel", stopPouring);
  });
  render();
}

/** Abre el minijuego de un paso de misión. Devuelve la función que lo cierra. */
export function openMiniGame(options: MiniGameOptions): () => void {
  const overlay = document.createElement("div");
  overlay.className = "ov ov-mg";
  overlay.innerHTML = `<div class="ov-card"><button class="mg-x" aria-label="Cerrar">✕</button><h2>${options.title}</h2><p class="ov-sub">${options.text}</p><div class="mg-body"></div><p class="mg-msg" aria-live="polite"></p></div>`;
  document.body.appendChild(overlay);
  const body = overlay.querySelector<HTMLElement>(".mg-body")!;
  const message = overlay.querySelector<HTMLElement>(".mg-msg")!;
  let finished = false;
  const close = () => {
    overlay.remove();
    options.onClose();
  };
  overlay.querySelector(".mg-x")!.addEventListener("click", close);
  const ctx: MiniGameContext = {
    body,
    missionId: options.missionId,
    say: (msg) => (message.textContent = msg),
    done: () => {
      if (finished) return;
      finished = true;
      message.textContent = "\xA1Hecho!";
      options.onDone();
      window.setTimeout(close, 900);
    },
  };
  switch (options.game) {
    case "mantener":
      holdGame(ctx, options.minMs);
      break;
    case "deslizar":
      swipeGame(ctx);
      break;
    case "frotar":
      rubGame(ctx, options.missionId === "platos" ? "plato" : "pelo");
      break;
    case "tocar":
      feedFishGame(ctx);
      break;
    case "lanzar":
      throwGame(ctx);
      break;
    case "penalti":
      penaltyGame(ctx);
      break;
    case "estanco":
      tobaccoShopGame(ctx);
      break;
    case "contar":
      countPillsGame(ctx);
      break;
    case "cortar":
      cutKebabGame(ctx);
      break;
    case "cubata":
      cubataGame(ctx);
      break;
  }
  return close;
}
