/**
 * Instrumentos sintetizados con Web Audio (sin archivos de audio): cuerdas de guitarra
 * (Karplus-Strong), ruidos de colores, reverberación, palmas, cajón y campanas.
 * Los usan la música (music.ts) y los efectos (sounds.ts).
 */

/** Cómo suena la cuerda: al aire ("abierta") o apagada con la palma ("apagada"). */
export type PluckStyle = "abierta" | "apagada";
/** Color del ruido: blanco, rosa o marrón. */
export type NoiseColor = "blanco" | "rosa" | "marron";

/** Número aleatorio uniforme en [min, max). */
export const randRange = (min: number, max: number): number => min + Math.random() * (max - min);
/** Elemento aleatorio de una lista. */
export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
/** Nota MIDI → frecuencia en Hz (La4 = 69 = 440 Hz). */
export const midiToFreq = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);

// Cachés de búferes por contexto de audio (se generan una sola vez)
const pluckCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const noiseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** Búfer de una cuerda pulsada (Karplus-Strong con retardo fraccional), normalizado. */
function pluckBuffer(ctx: BaseAudioContext, note: number, style: PluckStyle = "abierta"): AudioBuffer {
  let cache = pluckCache.get(ctx);
  if (!cache) pluckCache.set(ctx, (cache = new Map()));
  const key = `${note}:${style}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const sampleRate = ctx.sampleRate;
  const freq = midiToFreq(note);
  const muted = style === "apagada";
  const seconds = muted ? 0.35 : note < 52 ? 2.6 : 2;
  const length = Math.floor(sampleRate * seconds);
  const data = new Float32Array(length);
  // Tiempo de caída a -60 dB y ganancia de realimentación por periodo
  const decaySeconds = muted ? 0.13 : Math.max(0.9, 3.2 - (note - 40) * 0.07);
  const feedback = Math.exp(Math.log(1e-3) / (decaySeconds * freq));
  const period = sampleRate / freq;
  const delay = period - 0.5;
  const delayInt = Math.floor(delay);
  const delayFrac = delay - delayInt;
  const burstLength = Math.max(2, Math.round(period));
  const burst = new Float32Array(burstLength);

  // Excitación: ruido filtrado (paso bajo de un polo)
  let smoothed = 0;
  const smoothing = muted ? 0.25 : 0.55;
  for (let i = 0; i < burstLength; i++) {
    smoothed += smoothing * (Math.random() * 2 - 1 - smoothed);
    burst[i] = smoothed;
  }
  // Filtro peine (posición de la púa) y media para quitar la continua
  const combOffset = Math.max(1, Math.round(burstLength * 0.14));
  let mean = 0;
  for (let i = burstLength - 1; i >= 0; i--) {
    burst[i] = burst[i] - (i >= combOffset ? burst[i - combOffset] : 0);
    mean += burst[i];
  }
  mean /= burstLength;

  const sampleAt = (i: number) => (i >= 0 ? data[i] : 0);
  for (let i = 0; i < length; i++) {
    const current = (1 - delayFrac) * sampleAt(i - delayInt) + delayFrac * sampleAt(i - delayInt - 1);
    const previous = (1 - delayFrac) * sampleAt(i - 1 - delayInt) + delayFrac * sampleAt(i - delayInt - 2);
    data[i] = (i < burstLength ? burst[i] - mean : 0) + feedback * 0.5 * (current + previous);
  }

  // Filtro paso alto (quita continua) y búsqueda del pico
  let lastIn = 0;
  let lastOut = 0;
  let peak = 1e-6;
  for (let i = 0; i < length; i++) {
    const out = data[i] - lastIn + 0.995 * lastOut;
    lastIn = data[i];
    lastOut = out;
    data[i] = out;
    peak = Math.max(peak, Math.abs(out));
  }

  // Normaliza y aplica un fundido de 40 ms al final
  const fadeLength = Math.floor(sampleRate * 0.04);
  for (let i = 0; i < length; i++) {
    let scale = 1 / peak;
    if (i > length - fadeLength) scale *= (length - i) / fadeLength;
    data[i] *= scale;
  }

  const buffer = ctx.createBuffer(1, length, sampleRate);
  buffer.getChannelData(0).set(data);
  cache.set(key, buffer);
  return buffer;
}

/** Búfer de ruido en bucle (con fundido cruzado al final para que no chasquee). */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor = "blanco", seconds = 3): AudioBuffer {
  let cache = noiseCache.get(ctx);
  if (!cache) noiseCache.set(ctx, (cache = new Map()));
  const key = `${color}:${seconds}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let pink0 = 0;
  let pink1 = 0;
  let pink2 = 0;
  let brown = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === "rosa") {
      // Aproximación de ruido rosa con tres filtros de un polo
      pink0 = 0.99765 * pink0 + white * 0.099046;
      pink1 = 0.963 * pink1 + white * 0.2965164;
      pink2 = 0.57 * pink2 + white * 1.0526913;
      data[i] = (pink0 + pink1 + pink2 + white * 0.1848) * 0.18;
    } else if (color === "marron") {
      brown = (brown + 0.02 * white) / 1.02;
      data[i] = brown * 3.2;
    } else {
      data[i] = white * 0.6;
    }
  }

  const crossfade = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < crossfade; i++) {
    const k = i / crossfade;
    data[length - crossfade + i] = data[length - crossfade + i] * (1 - k) + data[i] * k;
  }
  cache.set(key, buffer);
  return buffer;
}

/** Respuesta al impulso estéreo para la reverberación (ruido con caída). */
export function reverbImpulse(ctx: BaseAudioContext, seconds = 1.6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smoothed = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      smoothed += 0.35 * (Math.random() * 2 - 1 - smoothed);
      data[i] = smoothed * Math.pow(1 - progress, 2.6) * (i < 60 ? i / 60 : 1);
    }
  }
  return buffer;
}

/** Devuelve el nodo al que conectar: un panoramizador hacia `dest`, o `dest` si no hay pan. */
export function withPan(ctx: BaseAudioContext, pan: number, dest: AudioNode): AudioNode {
  if (!pan || typeof ctx.createStereoPanner != "function") return dest;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  panner.connect(dest);
  return panner;
}

/** Contador de nodos fuente creados (estadística). */
export const voiceStats = { created: 0 };

/** Una nota de guitarra. */
export function pluckNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  note: number,
  when: number,
  gain = 0.5,
  style: PluckStyle = "abierta",
  pan = 0,
): void {
  const source = ctx.createBufferSource();
  source.buffer = pluckBuffer(ctx, note, style);
  const amp = ctx.createGain();
  amp.gain.value = gain;
  source.connect(amp).connect(withPan(ctx, pan, dest));
  source.start(when);
  voiceStats.created++;
}

/** Rasgueo: las notas del acorde una tras otra (hacia abajo o hacia arriba). */
export function strum(
  ctx: BaseAudioContext,
  dest: AudioNode,
  notes: readonly number[],
  when: number,
  gain = 0.4,
  spacing = 0.018,
  down = true,
  style: PluckStyle = "abierta",
): void {
  const ordered = down ? notes : [...notes].reverse();
  ordered.forEach((note, i) =>
    pluckNote(ctx, dest, note, when + i * spacing + randRange(0, 4e-3), gain * randRange(0.8, 1), style, (i / ordered.length - 0.5) * 0.3),
  );
}

/** Palmas: tres ráfagas de ruido filtrado (sordas o agudas). */
export function handClap(ctx: BaseAudioContext, dest: AudioNode, when: number, gain = 0.3, deep = true, pan = 0): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, "blanco", 1);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = deep ? randRange(900, 1200) : randRange(1600, 2100);
  filter.Q.value = 1.1;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  for (let i = 0; i < 3; i++) {
    const t = when + i * 9e-3;
    amp.gain.linearRampToValueAtTime(gain * (i === 2 ? 1 : 0.6), t + 2e-3);
    amp.gain.setTargetAtTime(0, t + 3e-3, i === 2 ? (deep ? 0.03 : 0.045) : 4e-3);
  }
  source.connect(filter).connect(amp).connect(withPan(ctx, pan, dest));
  source.start(when, randRange(0, 0.5));
  source.stop(when + 0.3);
  voiceStats.created++;
}

/** Golpe de cajón: grave (bajo) o agudo (borde), con un poco de ruido. */
export function cajonHit(ctx: BaseAudioContext, dest: AudioNode, when: number, gain = 0.4, low = true): void {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(low ? 120 : 210, when);
  osc.frequency.exponentialRampToValueAtTime(low ? 52 : 140, when + 0.12);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(gain, when + 4e-3);
  amp.gain.setTargetAtTime(0, when + 6e-3, low ? 0.07 : 0.035);
  osc.connect(amp).connect(dest);
  osc.start(when);
  osc.stop(when + 0.45);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, "blanco", 1);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = low ? 900 : 3200;
  const noiseAmp = ctx.createGain();
  noiseAmp.gain.setValueAtTime(gain * (low ? 0.25 : 0.45), when);
  noiseAmp.gain.setTargetAtTime(0, when + 2e-3, 0.02);
  noise.connect(filter).connect(noiseAmp).connect(dest);
  noise.start(when, randRange(0, 0.5));
  noise.stop(when + 0.15);
  voiceStats.created += 2;
}

/** Campanada: suma de parciales inarmónicos con caídas distintas. */
export function bell(ctx: BaseAudioContext, dest: AudioNode, when: number, freq = 330, gain = 0.3, duration = 4, pan = 0): void {
  // [múltiplo de la frecuencia, ganancia, fracción de la duración]
  const partials: [number, number, number][] = [
    [0.5, 0.5, 1],
    [1, 1, 0.8],
    [1.19, 0.5, 0.6],
    [1.5, 0.35, 0.45],
    [2, 0.4, 0.4],
    [2.74, 0.22, 0.25],
    [3.76, 0.12, 0.15],
  ];
  const master = ctx.createGain();
  master.gain.value = gain / 2.2;
  master.connect(withPan(ctx, pan, dest));
  for (const [ratio, partialGain, length] of partials) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * ratio * randRange(0.998, 1.002);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(partialGain, when + 6e-3);
    amp.gain.setTargetAtTime(0, when + 0.01, (duration * length) / 4);
    osc.connect(amp).connect(master);
    osc.start(when);
    osc.stop(when + duration * length + 0.1);
  }
  voiceStats.created += partials.length;
}
