/**
 * Sonido del juego con Web Audio (sin archivos): mezclador con tres buses (música,
 * ambiente y efectos) más reverberación, efectos de sonido (`sfx`), música (`music`)
 * y ambiente (`ambient`). El navegador solo deja sonar después de un toque o tecla,
 * así que el motor de audio se crea en la primera interacción.
 */
import { cajonHit, handClap, noiseBuffer, pluckNote, reverbImpulse, bell, strum, type NoiseColor } from "./synth";
import { AmbientSoundscape, GuitarMusic, musicPhaseFor, type MusicPhase } from "./music";

type BusName = "musica" | "ambiente" | "efectos";

const BUS_NAMES: BusName[] = ["musica", "ambiente", "efectos"];
const DEFAULT_VOLUMES: Record<BusName, number> = { musica: 0.6, ambiente: 0.55, efectos: 0.85 };

/** localStorage que no falla (modo privado, almacenamiento bloqueado…). */
const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

let muted = storage.get("laroda.silencio") === "1";
const volumes: Record<BusName, number> = { ...DEFAULT_VOLUMES };
for (const bus of BUS_NAMES) {
  const saved = parseFloat(storage.get(`laroda.volumen.${bus}`) ?? "");
  if (Number.isFinite(saved)) volumes[bus] = Math.max(0, Math.min(1, saved));
}

interface AudioEngine {
  ctx: AudioContext;
  /** Ganancia general (0 cuando está silenciado). */
  mute: GainNode;
  /** Por bus: volumen directo y volumen del envío a la reverberación. */
  bus: Record<BusName, { dry: GainNode; wetVol: GainNode }>;
  /** Envío a la reverberación de cada bus (el mismo nodo que `wetVol`). */
  reverb: Record<BusName, GainNode>;
  music: GuitarMusic;
  ambient: AmbientSoundscape;
}

let engine: AudioEngine | null = null;
let schedulerTimer: number | undefined;
let musicWanted = true;
let ambientWanted = true;
let currentPhase: MusicPhase = "sala";
let nearWater: number | boolean = 0;
let nightOverride: boolean | null = null;

/** Curva de volumen: el deslizador es lineal pero el oído no. */
const volumeCurve = (value: number) => value * value;

function createEngine(): AudioEngine | null {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    const ctx = new AudioContextClass();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 8e-3;
    compressor.release.value = 0.25;
    const mute = ctx.createGain();
    mute.gain.value = muted ? 0 : 0.9;
    compressor.connect(mute).connect(ctx.destination);

    const convolver = ctx.createConvolver();
    convolver.buffer = reverbImpulse(ctx, 1.6);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.5;
    convolver.connect(reverbReturn).connect(compressor);

    const bus = {} as AudioEngine["bus"];
    const reverb = {} as AudioEngine["reverb"];
    for (const name of BUS_NAMES) {
      const dry = ctx.createGain();
      dry.gain.value = volumeCurve(volumes[name]);
      dry.connect(compressor);
      const wetVol = ctx.createGain();
      wetVol.gain.value = volumeCurve(volumes[name]);
      wetVol.connect(convolver);
      bus[name] = { dry, wetVol };
      reverb[name] = wetVol;
    }

    const guitar = new GuitarMusic(ctx, bus.musica.dry, reverb.musica);
    guitar.setPhase(currentPhase);
    const soundscape = new AmbientSoundscape(ctx, bus.ambiente.dry, reverb.ambiente);
    soundscape.setNearWater(nearWater);
    if (nightOverride !== null) soundscape.setNight(nightOverride);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return { ctx, mute, bus, reverb, music: guitar, ambient: soundscape };
  } catch {
    return null;
  }
}

/** Crea o reanuda el motor y arranca lo que deba sonar. `null` si está silenciado o no hay audio. */
function ensureEngine(): AudioEngine | null {
  if (muted) return null;
  engine ??= createEngine();
  if (!engine) return null;
  if (engine.ctx.state === "suspended" && !document.hidden) void engine.ctx.resume();
  if (musicWanted && !engine.music.isRunning) engine.music.start();
  if (ambientWanted && !engine.ambient.isRunning) {
    engine.ambient.start();
    updateAmbientForPhase();
  }
  if (schedulerTimer === undefined) scheduleTick();
  return engine;
}

function stopScheduler(): void {
  window.clearTimeout(schedulerTimer);
  schedulerTimer = undefined;
}

/** Programa música y ambiente 1,5 s por delante, cada 250 ms. */
function scheduleTick(): void {
  window.clearTimeout(schedulerTimer);
  schedulerTimer = undefined;
  if (!engine || muted || engine.ctx.state === "closed" || (!engine.music.isRunning && !engine.ambient.isRunning)) return;
  const until = engine.ctx.currentTime + 1.5;
  engine.music.scheduleUntil(until);
  engine.ambient.scheduleUntil(until);
  schedulerTimer = window.setTimeout(scheduleTick, 250);
}

/** Pestaña oculta: se suspende el audio; al volver se reanuda. */
function onVisibilityChange(): void {
  if (!engine) return;
  if (document.hidden) {
    stopScheduler();
    void engine.ctx.suspend();
  } else if (!muted) {
    void engine.ctx.resume().then(scheduleTick);
  }
}

/** En la reunión y el resultado el ambiente baja y no suenan campanas. */
function updateAmbientForPhase(): void {
  if (!engine) return;
  const meeting = currentPhase === "reunion" || currentPhase === "resultado";
  engine.ambient.setBells(!meeting);
  engine.ambient.setLevel(meeting ? 0.35 : currentPhase === "fin" ? 0.6 : 1, 1);
}

/** Destino de un efecto: el bus de efectos, con un envío opcional a la reverberación. */
function effectsDest(audio: AudioEngine, reverbAmount = 0): AudioNode {
  if (!reverbAmount) return audio.bus.efectos.dry;
  const input = audio.ctx.createGain();
  input.connect(audio.bus.efectos.dry);
  const send = audio.ctx.createGain();
  send.gain.value = reverbAmount;
  input.connect(send).connect(audio.reverb.efectos);
  return input;
}

type EffectBuilder = (ctx: AudioContext, dest: AudioNode, when: number) => void;

/** Toca un efecto (si el audio está disponible) con la reverberación indicada. */
function playEffect(reverbAmount: number, build: EffectBuilder): void {
  const audio = ensureEngine();
  if (audio) {
    try {
      build(audio.ctx, effectsDest(audio, reverbAmount), audio.ctx.currentTime + 0.01);
    } catch {}
  }
}

interface NoiseHitOptions {
  /** Frecuencia del filtro. */
  f: number;
  q?: number;
  /** Ganancia máxima. */
  vel: number;
  /** Constante de tiempo de la caída. */
  dec: number;
  color?: NoiseColor;
  type?: BiquadFilterType;
}

/** Golpe corto de ruido filtrado. */
function noiseHit(ctx: BaseAudioContext, dest: AudioNode, when: number, options: NoiseHitOptions): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, options.color ?? "blanco", 1);
  const filter = ctx.createBiquadFilter();
  filter.type = options.type ?? "bandpass";
  filter.frequency.value = options.f;
  filter.Q.value = options.q ?? 1;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(options.vel, when + 4e-3);
  amp.gain.setTargetAtTime(0, when + 5e-3, options.dec);
  source.connect(filter).connect(amp).connect(dest);
  source.start(when, Math.random() * 0.5);
  source.stop(when + options.dec * 6 + 0.05);
}

/** Barrido de ruido rosa ("whoosh") de una frecuencia a otra. */
function noiseSweep(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  fromFreq: number,
  toFreq: number,
  duration: number,
  gain: number,
): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, "rosa", 1);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(fromFreq, when);
  filter.frequency.exponentialRampToValueAtTime(toFreq, when + duration);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(gain, when + duration * 0.45);
  amp.gain.linearRampToValueAtTime(0, when + duration);
  source.connect(filter).connect(amp).connect(dest);
  source.start(when, Math.random() * 0.3);
  source.stop(when + duration + 0.05);
}

/** Pitido de máquina (onda cuadrada/triangular con caída corta). */
function blip(ctx: BaseAudioContext, dest: AudioNode, when: number, freq: number, duration: number, gain: number, type: OscillatorType = "square"): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(gain, when + 3e-3);
  amp.gain.setTargetAtTime(0, when + duration * 0.4, duration * 0.3);
  osc.connect(amp).connect(dest);
  osc.start(when);
  osc.stop(when + duration * 2 + 0.05);
}

// Pisadas: se limitan a una cada 90 ms y alternan izquierda/derecha
let lastStepAt = 0;
let stepSide = 1;

export const sfx = {
  /** Desbloquea el audio en la primera interacción del usuario. */
  unlock() {
    ensureEngine();
  },
  tap: () =>
    playEffect(0, (ctx, dest, when) => {
      cajonHit(ctx, dest, when, 0.12, false);
      pluckNote(ctx, dest, 83, when, 0.08, "apagada");
    }),
  error: () =>
    playEffect(0.1, (ctx, dest, when) => {
      pluckNote(ctx, dest, 53, when, 0.35, "apagada");
      pluckNote(ctx, dest, 52, when + 0.12, 0.4, "apagada");
      cajonHit(ctx, dest, when + 0.12, 0.25, true);
    }),
  mision: () =>
    playEffect(0.35, (ctx, dest, when) => {
      [52, 56, 59, 64, 68].forEach((note, i) => pluckNote(ctx, dest, note, when + i * 0.07, 0.32 + i * 0.03, "abierta", (i - 2) * 0.15));
      handClap(ctx, dest, when + 0.42, 0.22, false, -0.2);
      handClap(ctx, dest, when + 0.56, 0.26, false, 0.2);
    }),
  paso: () =>
    playEffect(0.3, (ctx, dest, when) => {
      pluckNote(ctx, dest, 64, when, 0.32);
      pluckNote(ctx, dest, 71, when + 0.1, 0.28);
    }),
  eliminar: () =>
    playEffect(0.4, (ctx, dest, when) => {
      cajonHit(ctx, dest, when, 0.75, true);
      noiseSweep(ctx, dest, when, 3e3, 300, 0.35, 0.2);
      strum(ctx, dest, [40, 41, 47, 53], when + 0.02, 0.45, 0.01, true, "abierta");
      pluckNote(ctx, dest, 41, when + 0.05, 0.5, "apagada");
    }),
  campana: () =>
    playEffect(0.6, (ctx, dest, when) => {
      for (let i = 0; i < 3; i++) bell(ctx, dest, when + i * 0.55, 392, 0.55 - i * 0.05, 3.2, i % 2 ? 0.15 : -0.15);
    }),
  reporte: () =>
    playEffect(0.4, (ctx, dest, when) => {
      cajonHit(ctx, dest, when, 0.6, true);
      strum(ctx, dest, [40, 47, 52, 56, 62, 65], when + 0.03, 0.4, 0.012);
    }),
  rol: () =>
    playEffect(0.5, (ctx, dest, when) => {
      pluckNote(ctx, dest, 40, when, 0.5);
      [76, 83, 88].forEach((note, i) => pluckNote(ctx, dest, note, when + 0.25 + i * 0.16, 0.16, "abierta", (i - 1) * 0.4));
      strum(ctx, dest, [40, 47, 52, 56, 62, 65], when + 0.85, 0.22, 0.03);
    }),
  voto: () =>
    playEffect(0.15, (ctx, dest, when) => {
      noiseHit(ctx, dest, when, { f: 2500, q: 0.7, vel: 0.12, dec: 0.03, color: "rosa" });
      cajonHit(ctx, dest, when + 0.06, 0.45, false);
    }),
  expulsion: () =>
    playEffect(0.5, (ctx, dest, when) => {
      noiseSweep(ctx, dest, when, 400, 2400, 0.6, 0.18);
      [64, 62, 60, 59].forEach((note, i) => pluckNote(ctx, dest, note, when + 0.1 + i * 0.18, 0.3));
      pluckNote(ctx, dest, 40, when + 0.85, 0.45);
      pluckNote(ctx, dest, 52, when + 0.85, 0.3);
    }),
  /** Sabotaje crítico: campana a rebato (dos notas alternas, rápidas). */
  alarma: () =>
    playEffect(0.5, (ctx, dest, when) => {
      for (let i = 0; i < 8; i++) bell(ctx, dest, when + i * 0.18, i % 2 ? 523 : 659, 0.42, 0.9, i % 2 ? 0.25 : -0.25);
      cajonHit(ctx, dest, when, 0.6, true);
    }),
  /** Tragaperras: la moneda cae por la ranura y rebota dentro. */
  moneda: () =>
    playEffect(0.15, (ctx, dest, when) => {
      [0, 0.09, 0.15, 0.19].forEach((t, i) => noiseHit(ctx, dest, when + t, { f: 5200 - i * 300, q: 9, vel: 0.22 - i * 0.04, dec: 0.05, type: "bandpass" }));
      blip(ctx, dest, when + 0.25, 1568, 0.08, 0.05, "triangle");
    }),
  /** Tragaperras: palanca con trinquete. */
  palanca: () =>
    playEffect(0.1, (ctx, dest, when) => {
      for (let i = 0; i < 6; i++) noiseHit(ctx, dest, when + i * 0.035, { f: 1800, q: 4, vel: 0.16, dec: 0.012 });
      cajonHit(ctx, dest, when + 0.24, 0.5, true);
    }),
  /** Tragaperras: traqueteo de los rodillos girando. Devuelve la función para pararlo. */
  rodillos(): () => void {
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      playEffect(0, (ctx, dest, when) => {
        noiseHit(ctx, dest, when, { f: 2600 + (n % 3) * 300, q: 3, vel: 0.07, dec: 0.01 });
        if (n % 4 === 0) blip(ctx, dest, when, [523, 659, 784, 659][(n / 4) % 4], 0.05, 0.025);
      });
    }, 55);
    return () => window.clearInterval(id);
  },
  /** Tragaperras: un rodillo frena de golpe (cada uno un poco más agudo). */
  rodilloPara: (i: number) =>
    playEffect(0.12, (ctx, dest, when) => {
      cajonHit(ctx, dest, when, 0.55, i === 0);
      noiseHit(ctx, dest, when, { f: 900, q: 2, vel: 0.25, dec: 0.03, color: "rosa" });
      blip(ctx, dest, when + 0.02, [392, 494, 587][i] ?? 587, 0.12, 0.06);
    }),
  /** Tragaperras: premio gordo (fanfarria de feria, campanillas y lluvia de monedas). */
  premio: () =>
    playEffect(0.4, (ctx, dest, when) => {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => blip(ctx, dest, when + i * 0.09, f, 0.14, 0.07));
      strum(ctx, dest, [40, 47, 52, 56, 59, 64], when + 0.7, 0.4, 0.012);
      for (let i = 0; i < 14; i++) noiseHit(ctx, dest, when + 0.8 + i * 0.09 + Math.random() * 0.04, { f: 4200 + Math.random() * 2400, q: 10, vel: 0.14, dec: 0.06 });
      for (let i = 0; i < 4; i++) bell(ctx, dest, when + 0.75 + i * 0.22, 1046 + i * 130, 0.12, 1.2, i % 2 ? 0.3 : -0.3);
      [1.0, 1.2, 1.4].forEach((t, i) => handClap(ctx, dest, when + t, 0.22, false, (i - 1) * 0.3));
    }),
  /** Tragaperras: sin premio (dos notas que bajan, "uooh"). */
  sinPremio: () =>
    playEffect(0.2, (ctx, dest, when) => {
      blip(ctx, dest, when, 330, 0.2, 0.05, "triangle");
      blip(ctx, dest, when + 0.22, 247, 0.4, 0.05, "triangle");
      pluckNote(ctx, dest, 40, when + 0.22, 0.3, "apagada");
    }),
  /** Tic del reloj en los últimos segundos. */
  tic: () =>
    playEffect(0, (ctx, dest, when) => {
      noiseHit(ctx, dest, when, { f: 3200, q: 2, vel: 0.22, dec: 0.025, color: "rosa" });
    }),
  abrir: () =>
    playEffect(0.15, (ctx, dest, when) => {
      noiseSweep(ctx, dest, when, 500, 2600, 0.18, 0.08);
      pluckNote(ctx, dest, 71, when + 0.12, 0.18);
    }),
  cerrar: () =>
    playEffect(0.1, (ctx, dest, when) => {
      noiseSweep(ctx, dest, when, 2400, 500, 0.16, 0.06);
      pluckNote(ctx, dest, 64, when + 0.1, 0.14, "apagada");
    }),
  fin: (won: boolean) =>
    playEffect(0.5, (ctx, dest, when) => {
      if (won) {
        // Am – G – F y cierre en Mi con rasgueado y palmas
        [[45, 52, 57, 60, 64], [43, 47, 50, 55, 59], [41, 48, 53, 57, 60]].forEach((chord, i) =>
          strum(ctx, dest, chord, when + i * 0.32, 0.33, 0.014),
        );
        for (let i = 0; i < 3; i++) strum(ctx, dest, [47, 52, 56, 59, 64], when + 0.96 + i * 0.03, 0.12, 5e-3, true, "apagada");
        strum(ctx, dest, [40, 47, 52, 56, 59, 64], when + 1.08, 0.48, 0.012);
        [1.4, 1.62, 1.84].forEach((offset, i) => handClap(ctx, dest, when + offset, 0.22 + i * 0.03, false, (i - 1) * 0.3));
      } else {
        [64, 62, 60, 57].forEach((note, i) => pluckNote(ctx, dest, note, when + i * 0.3, 0.32));
        strum(ctx, dest, [45, 52, 57, 60, 64], when + 1.25, 0.32, 0.06);
        cajonHit(ctx, dest, when + 1.25, 0.3, true);
      }
    }),
  /** Pisada del personaje (golpe grave + roce), con intensidad 0–1. */
  pisada(intensity = 0.5) {
    const audio = ensureEngine();
    if (!audio) return;
    const now = performance.now();
    if (now - lastStepAt < 90) return;
    lastStepAt = now;
    stepSide = -stepSide;
    const level = Math.max(0.05, Math.min(1, intensity));
    try {
      const when = audio.ctx.currentTime + 5e-3;
      const base = effectsDest(audio);
      let dest: AudioNode = base;
      if (typeof audio.ctx.createStereoPanner == "function") {
        const panner = audio.ctx.createStereoPanner();
        panner.pan.value = stepSide * 0.12;
        panner.connect(base);
        dest = panner;
      }
      const osc = audio.ctx.createOscillator();
      osc.frequency.setValueAtTime(110 + Math.random() * 30, when);
      osc.frequency.exponentialRampToValueAtTime(60, when + 0.05);
      const amp = audio.ctx.createGain();
      amp.gain.setValueAtTime(0, when);
      amp.gain.linearRampToValueAtTime(0.16 * level, when + 3e-3);
      amp.gain.setTargetAtTime(0, when + 4e-3, 0.018);
      osc.connect(amp).connect(dest);
      osc.start(when);
      osc.stop(when + 0.15);
      noiseHit(audio.ctx, dest, when, { f: 500 + Math.random() * 500, q: 1.3, vel: 0.1 * level, dec: 0.022, color: "rosa" });
      noiseHit(audio.ctx, dest, when + 0.012, { f: 2600 + Math.random() * 1400, q: 0.9, vel: 0.035 * level, dec: 0.015 });
    } catch {}
  },
  get muted() {
    return muted;
  },
  toggle() {
    setMuted(!muted);
    return muted;
  },
};

function setMuted(value: boolean): void {
  if (value === muted) return;
  muted = value;
  storage.set("laroda.silencio", muted ? "1" : "0");
  if (muted) {
    stopScheduler();
    if (engine) {
      const audio = engine;
      audio.mute.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
      // Se suspende tras el fundido (si sigue silenciado)
      window.setTimeout(() => {
        if (muted) void audio.ctx.suspend();
      }, 400);
    }
  } else {
    const audio = ensureEngine();
    if (audio) {
      audio.mute.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.mute.gain.setTargetAtTime(0.9, audio.ctx.currentTime, 0.08);
    }
    sfx.tap();
  }
  for (const listener of listeners) listener();
}

/** Avisos de cambio de volumen o silencio (panel de sonido). */
const listeners = new Set<() => void>();

export const mixer = {
  setVolume(bus: BusName, value: number) {
    const volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    volumes[bus] = volume;
    storage.set(`laroda.volumen.${bus}`, volume.toFixed(2));
    if (engine) {
      const now = engine.ctx.currentTime;
      engine.bus[bus].dry.gain.setTargetAtTime(volumeCurve(volume), now, 0.05);
      engine.bus[bus].wetVol.gain.setTargetAtTime(volumeCurve(volume), now, 0.05);
    }
    for (const listener of listeners) listener();
  },
  getVolume(bus: BusName): number {
    return volumes[bus];
  },
  setMuted,
  get muted() {
    return muted;
  },
  /** Devuelve la función para darse de baja. */
  onChange(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const music = {
  start() {
    musicWanted = true;
    if (engine && !muted) ensureEngine();
  },
  stop() {
    musicWanted = false;
    engine?.music.stop();
  },
  setPhase(phase: string) {
    currentPhase = musicPhaseFor(phase);
    engine?.music.setPhase(currentPhase);
    updateAmbientForPhase();
  },
  get phase(): MusicPhase {
    return currentPhase;
  },
};

export const ambient = {
  start() {
    ambientWanted = true;
    if (engine && !muted) ensureEngine();
  },
  stop() {
    ambientWanted = false;
    engine?.ambient.stop();
  },
  /** Cercanía al río: 0–1 (o booleano). */
  setNearWater(nearness: number | boolean) {
    nearWater = nearness;
    engine?.ambient.setNearWater(nearness);
  },
  /** `null` = según la hora del reloj. */
  setNight(night: boolean | null) {
    nightOverride = night;
    engine?.ambient.setNight(night);
  },
};

// Primera interacción → audio listo (se dejan de escuchar cuando el contexto ya suena)
{
  const unlockEvents = ["pointerdown", "keydown", "touchend"];
  const unlock = () => {
    sfx.unlock();
    if (engine && engine.ctx.state === "running") {
      for (const type of unlockEvents) window.removeEventListener(type, unlock, true);
    }
  };
  for (const type of unlockEvents) window.addEventListener(type, unlock, { capture: true });
}
