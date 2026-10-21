/**
 * Música (guitarra flamenca con palmas y cajón, generada al vuelo) y ambiente sonoro
 * del pueblo (viento, agua, pájaros, insectos y campanas). Ambos se programan por
 * adelantado: sounds.ts llama a `scheduleUntil()` cada 250 ms.
 */
import {
  bell,
  cajonHit,
  handClap,
  midiToFreq,
  noiseBuffer,
  pick,
  pluckNote,
  randRange,
  strum,
  voiceStats,
  withPan,
} from "./synth";

/** Acordes (notas MIDI de grave a agudo). */
const CHORDS = {
  Am: [45, 52, 57, 60, 64],
  G: [43, 47, 50, 55, 59],
  F: [41, 48, 53, 57, 60],
  E: [40, 47, 52, 56, 59, 64],
  E7b9: [40, 47, 52, 56, 62, 65],
  Dm: [50, 57, 62, 65],
  C: [48, 52, 55, 60, 64],
  A: [45, 52, 57, 61, 64],
  Bb: [46, 53, 58, 62, 65],
};
type ChordName = keyof typeof CHORDS;

/** Escala de la melodía (modo frigio de Mi con tercera mayor). */
const MELODY_SCALE = [64, 65, 68, 69, 71, 72, 74, 76, 77, 80];

/** Arpegios de 8 corcheas: índice de la nota del acorde, o -1 para silencio. */
const ARPEGGIO_PATTERNS = [
  [0, -1, 2, 3, 4, 3, 2, 3],
  [0, 3, 2, 4, 1, 4, 2, 3],
  [0, -1, -1, 3, -1, 4, -1, -1],
  [0, 2, 3, 2, 4, 2, 3, 2],
  [0, -1, 3, -1, 1, -1, 4, 2],
];

interface MusicStyle {
  bpm: number;
  /** Progresiones posibles (4 compases). */
  progs: ChordName[][];
  /** Índices de ARPEGGIO_PATTERNS que se pueden usar. */
  patterns: number[];
  /** Probabilidad de que una frase lleve melodía. */
  melody: number;
  /** Cantidad de percusión (0 = nada, 1 = siempre). */
  perc: number;
  /** Pulso rápido y regular (sin swing) en lugar de arpegio. */
  pulse: boolean;
  /** Rasguear cada N compases (0 = nunca). */
  strumEvery: number;
  level: number;
  /** Volumen del bordón grave. */
  drone: number;
}

/** Estilo musical de cada fase del juego. */
const STYLES = {
  sala: { bpm: 76, progs: [["Am", "G", "F", "E"], ["Am", "Am", "G", "F"], ["Dm", "Am", "F", "E"]], patterns: [2, 4], melody: 0.25, perc: 0, pulse: false, strumEvery: 0, level: 0.85, drone: 0 },
  partida: { bpm: 84, progs: [["Am", "G", "F", "E"], ["Am", "G", "F", "E"], ["Dm", "C", "Bb", "Am"], ["Am", "Dm", "F", "E"], ["F", "E", "F", "E"]], patterns: [0, 1, 2, 3, 4], melody: 0.4, perc: 0.5, pulse: false, strumEvery: 0, level: 1, drone: 0 },
  reunion: { bpm: 112, progs: [["E", "F", "E", "F"], ["Dm", "E", "F", "E"], ["E", "E7b9", "F", "E"], ["Am", "G", "F", "E7b9"]], patterns: [2, 4], melody: 0.15, perc: 1, pulse: true, strumEvery: 2, level: 0.6, drone: 1 },
  resultado: { bpm: 66, progs: [["Am", "G", "F", "E"]], patterns: [2], melody: 0, perc: 0, pulse: false, strumEvery: 1, level: 0.75, drone: 0.4 },
  fin: { bpm: 70, progs: [["Am", "F", "E", "E"], ["Am", "G", "F", "E"], ["A", "Dm", "E", "A"]], patterns: [2, 4], melody: 0.5, perc: 0.25, pulse: false, strumEvery: 4, level: 0.85, drone: 0 },
  derrota: { bpm: 60, progs: [["Am", "Dm", "Am", "E"], ["Dm", "Am", "Bb", "E"]], patterns: [2], melody: 0.2, perc: 0, pulse: false, strumEvery: 4, level: 0.75, drone: 0.3 },
} satisfies Record<string, MusicStyle>;

export type MusicPhase = keyof typeof STYLES;

/** Otros nombres de fase (del servidor o antiguos) → fase musical. */
const PHASE_ALIASES: Record<string, MusicPhase> = {
  lobby: "sala",
  inicio: "sala",
  juego: "partida",
  exploracion: "partida",
  votacion: "reunion",
  victoria: "fin",
};

/** Normaliza un nombre de fase a una fase musical conocida (por defecto "partida"). */
export function musicPhaseFor(phase: string | null | undefined): MusicPhase {
  const name = (phase || "").toLowerCase();
  return name in STYLES ? (name as MusicPhase) : (PHASE_ALIASES[name] ?? "partida");
}

const MUSIC_GAIN = 1.6;
const AMBIENT_GAIN = 0.42;

/** Guitarra generativa: arpegios, rasgueos, melodía, bordón y percusión según la fase. */
export class GuitarMusic {
  private readonly ctx: BaseAudioContext;
  private readonly out: GainNode;
  private readonly body: AudioNode;
  private phase: MusicPhase = "sala";
  /** Fase que entrará al acabar el compás actual. */
  private pending: MusicPhase | null = null;
  private running = false;
  private nextTime = 0;
  /** Corchea dentro de la frase (32 = 4 compases de 8). */
  private step = 0;
  private phraseNo = 0;
  private prog: ChordName[] = [];
  private pattern: number[] = ARPEGGIO_PATTERNS[0];
  /** Notas de la melodía de la frase actual (paso → nota MIDI). */
  private readonly melody = new Map<number, number>();
  private percOn = true;
  /** Frase de respiro: solo bajo y alguna nota suelta. */
  private breath = false;
  private readonly droneGain: GainNode;
  private droneOsc: OscillatorNode[] = [];

  constructor(ctx: BaseAudioContext, dest: AudioNode, reverbSend: AudioNode | null = null) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    // Cuerpo de la guitarra: realce de graves y recorte de agudos
    const lowBoost = ctx.createBiquadFilter();
    lowBoost.type = "peaking";
    lowBoost.frequency.value = 120;
    lowBoost.Q.value = 0.9;
    lowBoost.gain.value = 3;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 5200;
    lowpass.Q.value = 0.5;
    this.out.connect(lowBoost).connect(lowpass).connect(dest);
    this.body = this.out;
    if (reverbSend) {
      const send = ctx.createGain();
      send.gain.value = 0.32;
      this.out.connect(send).connect(reverbSend);
    }
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 260;
    droneFilter.Q.value = 2;
    this.droneGain.connect(droneFilter).connect(this.out);
  }

  get currentPhase(): MusicPhase {
    return this.pending ?? this.phase;
  }

  setPhase(phase: string): void {
    const next = musicPhaseFor(phase);
    if (next === this.currentPhase) return;
    if (!this.running) {
      this.phase = next;
      return;
    }
    this.pending = next;
    const now = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(STYLES[next].drone * 0.05, now, 1.2);
    this.out.gain.setTargetAtTime(STYLES[next].level * MUSIC_GAIN, now, 0.8);
    // La reunión entra con un rasgueo de aviso
    if (next === "reunion") this.rasgueado(now + 0.05, CHORDS.E7b9, 0.5);
  }

  start(when = this.ctx.currentTime): void {
    if (this.running) return;
    this.running = true;
    this.nextTime = when + 0.1;
    this.step = 0;
    this.newPhrase();
    const style = STYLES[this.phase];
    this.out.gain.cancelScheduledValues(when);
    this.out.gain.setValueAtTime(0, when);
    this.out.gain.linearRampToValueAtTime(style.level * MUSIC_GAIN, when + 2.5);
    // Bordón: dos dientes de sierra graves ligeramente desafinados
    for (const [note, detune] of [[28, -6], [40, 5]]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(note);
      osc.detune.value = detune;
      osc.connect(this.droneGain);
      osc.start(when);
      this.droneOsc.push(osc);
    }
    this.droneGain.gain.setTargetAtTime(style.drone * 0.05, when, 1.2);
  }

  stop(when = this.ctx.currentTime, fade = 1.2): void {
    if (this.running) {
      this.running = false;
      this.out.gain.cancelScheduledValues(when);
      this.out.gain.setTargetAtTime(0, when, fade / 4);
      for (const osc of this.droneOsc) osc.stop(when + fade + 0.5);
      this.droneOsc = [];
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Programa las notas hasta el instante `until`; devuelve cuántos pasos programó. */
  scheduleUntil(until: number): number {
    if (!this.running) return 0;
    // Si nos hemos quedado atrás (pestaña en segundo plano), se empieza frase nueva
    if (this.nextTime < this.ctx.currentTime - 0.05) {
      this.nextTime = this.ctx.currentTime + 0.05;
      this.step = 0;
      this.newPhrase();
    }
    let count = 0;
    for (; this.nextTime < until && count < 64; ) {
      this.playStep(this.step, this.nextTime);
      const style = STYLES[this.phase];
      const eighth = 30 / style.bpm;
      const swing = this.step % 2 === 0 ? 1.06 : 0.94;
      this.nextTime += eighth * (style.pulse ? 1 : swing);
      this.step = (this.step + 1) % 32;
      // El cambio de fase espera al inicio de un compás
      if (this.step % 8 === 0 && this.pending) {
        this.phase = this.pending;
        this.pending = null;
        this.step = 0;
      }
      if (this.step === 0) this.newPhrase();
      count++;
    }
    return count;
  }

  private newPhrase(): void {
    const style: MusicStyle = STYLES[this.phase];
    this.phraseNo++;
    this.prog = pick(style.progs);
    this.pattern = ARPEGGIO_PATTERNS[pick(style.patterns)];
    this.breath = this.phase !== "reunion" && this.phraseNo % 5 === 0;
    this.percOn = style.perc > 0 && (style.perc >= 1 || this.phraseNo % 2 === 0);
    this.melody.clear();
    if (!this.breath && Math.random() < style.melody) this.makeMelody();
  }

  /** Melodía por pasos cortos sobre la escala; cada compás termina en una nota del acorde. */
  private makeMelody(): void {
    let degree = Math.floor(randRange(4, MELODY_SCALE.length - 1));
    for (let bar = 0; bar < 4; bar++) {
      const chord = CHORDS[this.prog[bar]];
      const rhythm = pick([[0, 3, 4, 6], [1, 2, 4], [0, 2, 3, 4, 5], [2, 3, 6]]);
      for (const beat of rhythm) {
        degree = Math.max(0, Math.min(MELODY_SCALE.length - 1, degree + pick([-1, -1, -2, 1, 0, -1, 2])));
        this.melody.set(bar * 8 + beat, MELODY_SCALE[degree]);
      }
      const lastStep = bar * 8 + rhythm[rhythm.length - 1];
      // Nota del acorde más cercana a la última de la melodía
      const closest = chord
        .map((note) => note + 12 * Math.round((MELODY_SCALE[degree] - note) / 12))
        .sort((a, b) => Math.abs(a - MELODY_SCALE[degree]) - Math.abs(b - MELODY_SCALE[degree]))[0];
      this.melody.set(lastStep, Math.max(62, Math.min(81, closest)));
    }
  }

  /** Rasgueado flamenco: tres golpes apagados y el acorde abierto. */
  private rasgueado(when: number, chord: readonly number[], gain: number): void {
    for (let i = 0; i < 3; i++) strum(this.ctx, this.body, chord.slice(1), when + i * 0.035, gain * 0.35, 6e-3, true, "apagada");
    strum(this.ctx, this.body, chord, when + 0.11, gain, 0.012);
  }

  private playStep(step: number, when: number): void {
    const style: MusicStyle = STYLES[this.phase];
    const ctx = this.ctx;
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    const chord = CHORDS[this.prog[bar]] ?? CHORDS.Am;
    // Pequeñas variaciones de tiempo y fuerza para que suene tocado a mano
    const humanTime = () => when + randRange(-6e-3, 8e-3);
    const humanGain = (gain: number) => gain * randRange(0.75, 1.05);

    if (style.strumEvery && beat === 0 && bar % style.strumEvery === 0) {
      strum(ctx, this.body, chord, humanTime(), humanGain(0.32), this.phase === "resultado" ? 0.05 : 0.02);
    } else if (this.breath) {
      if (beat === 0) pluckNote(ctx, this.body, chord[0], humanTime(), humanGain(0.42));
      if (beat === 4 && Math.random() < 0.6) {
        pluckNote(ctx, this.body, chord[chord.length - 1] + 12, humanTime(), humanGain(0.12), "abierta", 0.3);
      }
    } else if (style.pulse) {
      const accent = beat === 0 || beat === 3 || beat === 6;
      pluckNote(ctx, this.body, chord[0], humanTime(), humanGain(accent ? 0.5 : 0.28), "apagada");
      if (beat === 3 || beat === 6) {
        pluckNote(ctx, this.body, chord[2 + (beat % 2)], humanTime(), humanGain(0.18), "apagada", 0.2);
      }
    } else {
      const index = this.pattern[beat];
      if (index >= 0) {
        const note = chord[Math.min(index, chord.length - 1)];
        const isBass = index === 0;
        const gain = isBass ? 0.42 : this.melody.size ? 0.14 : 0.22;
        pluckNote(ctx, this.body, note, humanTime(), humanGain(gain), "abierta", isBass ? -0.1 : (index - 2) * 0.12);
      }
    }

    const melodyNote = this.melody.get(step);
    if (melodyNote) pluckNote(ctx, this.body, melodyNote, humanTime(), humanGain(0.3), "abierta", 0.15);

    if (this.percOn) {
      const perc = style.perc;
      if (this.phase === "reunion") {
        // Compás de bulería: cajón en 0, 3 y 6
        if (beat === 0 || beat === 3 || beat === 6) cajonHit(ctx, this.body, humanTime(), humanGain(0.42), true);
        if (beat === 4) cajonHit(ctx, this.body, humanTime(), humanGain(0.3), false);
        if (beat === 2 || beat === 6) handClap(ctx, this.body, humanTime(), humanGain(0.12), false, randRange(-0.3, 0.3));
      } else {
        if (beat === 0 && Math.random() < 0.7) cajonHit(ctx, this.body, humanTime(), humanGain(0.22 * perc + 0.08), true);
        if (beat === 5 && Math.random() < 0.35) cajonHit(ctx, this.body, humanTime(), humanGain(0.12), false);
        if ((beat === 2 || beat === 6) && Math.random() < 0.55) {
          handClap(ctx, this.body, humanTime(), humanGain(0.07 * perc + 0.02), true, randRange(-0.4, 0.4));
        }
      }
    }
  }
}

type AmbientEvent = "pajaro" | "campana" | "insecto" | "rafaga" | "gorgoteo";

/** Ambiente del pueblo: viento, agua cerca del río, insectos (cigarras o grillos), pájaros y campanas. */
export class AmbientSoundscape {
  private readonly ctx: BaseAudioContext;
  private readonly wet: AudioNode | null;
  private readonly out: GainNode;
  private running = false;
  private night = false;
  /** La noche se decide por la hora del reloj (salvo que se fuerce con setNight). */
  private nightAuto = true;
  /** Cercanía al agua (0–1). */
  private water = 0;
  private bellsOn = true;
  private loops: AudioScheduledSourceNode[] = [];
  private readonly waterGain: GainNode;
  private readonly windGain: GainNode;
  private readonly waterFilter: BiquadFilterNode;
  /** Próximo instante de cada tipo de suceso. */
  private next: Record<AmbientEvent, number> = { pajaro: 0, campana: 0, insecto: 0, rafaga: 0, gorgoteo: 0 };

  constructor(ctx: BaseAudioContext, dest: AudioNode, wet: AudioNode | null = null) {
    this.ctx = ctx;
    this.wet = wet;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.16;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    this.waterFilter = ctx.createBiquadFilter();
    this.waterFilter.type = "bandpass";
    this.waterFilter.frequency.value = 900;
    this.waterFilter.Q.value = 0.8;
  }

  /** `null` vuelve al modo automático (según la hora). */
  setNight(night: boolean | null): void {
    this.nightAuto = night === null;
    this.night = night ?? isNightNow();
  }

  setNearWater(nearness: number | boolean): void {
    const value = typeof nearness == "boolean" ? (nearness ? 1 : 0) : Math.max(0, Math.min(1, nearness));
    if (Math.abs(value - this.water) < 0.02) return;
    this.water = value;
    if (this.running) this.waterGain.gain.setTargetAtTime(value * 0.22, this.ctx.currentTime, 0.6);
  }

  setBells(on: boolean): void {
    this.bellsOn = on;
  }

  setLevel(level: number, timeConstant = 0.8): void {
    if (this.running) this.out.gain.setTargetAtTime(level * AMBIENT_GAIN, this.ctx.currentTime, timeConstant);
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(when = this.ctx.currentTime): void {
    if (this.running) return;
    this.running = true;
    if (this.nightAuto) this.night = isNightNow();
    const ctx = this.ctx;
    this.out.gain.cancelScheduledValues(when);
    this.out.gain.setValueAtTime(0, when);
    this.out.gain.linearRampToValueAtTime(AMBIENT_GAIN, when + 3);

    // Viento: ruido marrón con un paso bajo que se mueve lentamente
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(ctx, "marron", 4);
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 220;
    lfo.connect(lfoDepth).connect(windFilter.frequency);
    wind.connect(windFilter).connect(this.windGain).connect(this.out);

    // Agua: ruido rosa por un pasabanda cuya frecuencia "gorgotea"
    const water = ctx.createBufferSource();
    water.buffer = noiseBuffer(ctx, "rosa", 3);
    water.loop = true;
    const waterHighpass = ctx.createBiquadFilter();
    waterHighpass.type = "highpass";
    waterHighpass.frequency.value = 300;
    water.connect(waterHighpass).connect(this.waterFilter).connect(this.waterGain).connect(this.out);
    this.waterGain.gain.setTargetAtTime(this.water * 0.22, when, 0.6);

    for (const node of [wind, water, lfo]) {
      if (node === lfo) node.start(when);
      else (node as AudioBufferSourceNode).start(when, randRange(0, 2));
      this.loops.push(node);
    }
    this.next = {
      pajaro: when + randRange(3, 8),
      campana: when + randRange(25, 60),
      insecto: when + randRange(0.5, 3),
      rafaga: when + randRange(8, 20),
      gorgoteo: when,
    };
  }

  stop(when = this.ctx.currentTime, fade = 1.5): void {
    if (this.running) {
      this.running = false;
      this.out.gain.cancelScheduledValues(when);
      this.out.gain.setTargetAtTime(0, when, fade / 4);
      for (const node of this.loops) node.stop(when + fade + 0.5);
      this.loops = [];
    }
  }

  /** Programa los sucesos hasta `until`; devuelve cuántos programó. */
  scheduleUntil(until: number): number {
    if (!this.running) return 0;
    const now = this.ctx.currentTime;
    const next = this.next;
    // Los sucesos que se quedaron muy atrás se recolocan cerca de ahora
    for (const event of Object.keys(next) as AmbientEvent[]) {
      if (next[event] < now - 1) next[event] = now + randRange(0.5, 4);
    }
    let count = 0;
    if (next.gorgoteo < until) {
      for (let t = next.gorgoteo; t < until && count < 20; t += randRange(0.18, 0.4), count++) {
        this.waterFilter.frequency.setTargetAtTime(randRange(600, 1700), t, 0.08);
        next.gorgoteo = t + 0.3;
      }
    }
    if (next.rafaga < until) {
      const t = next.rafaga;
      const gust = randRange(0.22, 0.38);
      this.windGain.gain.setTargetAtTime(gust, t, 1.2);
      this.windGain.gain.setTargetAtTime(0.14, t + randRange(2.5, 4.5), 1.6);
      next.rafaga = t + randRange(12, 28);
      count++;
    }
    if (next.insecto < until) {
      const t = next.insecto;
      const duration = this.night ? this.crickets(t) : this.cicada(t);
      next.insecto = t + duration + randRange(1.5, 7);
      count++;
    }
    if (next.pajaro < until) {
      const t = next.pajaro;
      // De noche casi no cantan
      if (!this.night || Math.random() < 0.15) this.birds(t);
      next.pajaro = t + randRange(6, 18);
      count++;
    }
    if (next.campana < until) {
      const t = next.campana;
      if (this.bellsOn) {
        const strokes = pick([1, 2, 3]);
        for (let i = 0; i < strokes; i++) bell(this.ctx, this.bellDest(), t + i * 2.2, 196, 0.13, 6, -0.5);
      }
      next.campana = t + randRange(70, 140);
      count++;
    }
    return count;
  }

  /** Campana lejana: filtrada y con más reverberación. */
  private bellDest(): AudioNode {
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    filter.connect(this.out);
    if (this.wet) {
      const send = this.ctx.createGain();
      send.gain.value = 1.4;
      filter.connect(send).connect(this.wet);
    }
    return filter;
  }

  /** Cigarra: ruido agudo modulado en amplitud. Devuelve su duración. */
  private cicada(when: number): number {
    const ctx = this.ctx;
    const duration = randRange(3, 8);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, "blanco", 1);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = randRange(4800, 6200);
    filter.Q.value = 5;
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = randRange(26, 40);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth).connect(tremolo.gain);
    const envelope = ctx.createGain();
    const peak = randRange(0.03, 0.06);
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(peak, when + duration * 0.35);
    envelope.gain.setValueAtTime(peak, when + duration * 0.7);
    envelope.gain.linearRampToValueAtTime(0, when + duration);
    noise.connect(filter).connect(tremolo).connect(envelope).connect(withPan(ctx, randRange(-0.7, 0.7), this.out));
    noise.start(when, randRange(0, 0.5));
    lfo.start(when);
    noise.stop(when + duration + 0.05);
    lfo.stop(when + duration + 0.05);
    voiceStats.created += 2;
    return duration;
  }

  /** Grillos: grupos de tres chirridos cada 0,75 s. Devuelve su duración. */
  private crickets(when: number): number {
    const ctx = this.ctx;
    const chirps = Math.floor(randRange(4, 9));
    const osc = ctx.createOscillator();
    osc.frequency.value = randRange(4300, 4800);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    const peak = randRange(0.015, 0.03);
    for (let i = 0; i < chirps; i++) {
      for (let j = 0; j < 3; j++) {
        const t = when + i * 0.75 + j * 0.06;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(peak, t + 8e-3);
        amp.gain.linearRampToValueAtTime(0, t + 0.035);
      }
    }
    osc.connect(amp).connect(withPan(ctx, randRange(-0.8, 0.8), this.out));
    osc.start(when);
    const duration = chirps * 0.75;
    osc.stop(when + duration);
    voiceStats.created++;
    return duration;
  }

  /** Canto de pájaro: trinos rápidos descendentes o silbidos ascendentes. */
  private birds(when: number): void {
    const ctx = this.ctx;
    const notes = Math.floor(randRange(3, 7));
    const trill = Math.random() < 0.5;
    const dest = withPan(ctx, randRange(-0.8, 0.8), this.out);
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    osc.frequency.setValueAtTime(3e3, when);
    let t = when;
    for (let i = 0; i < notes; i++) {
      const length = trill ? randRange(0.04, 0.07) : randRange(0.07, 0.13);
      const from = trill ? randRange(5200, 7200) : randRange(2800, 4200);
      const to = trill ? from * randRange(0.7, 0.85) : from * randRange(1.1, 1.4);
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + length);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(randRange(0.012, 0.025), t + length * 0.3);
      amp.gain.linearRampToValueAtTime(0, t + length);
      t += length + (trill ? randRange(0.03, 0.09) : randRange(0.08, 0.2));
    }
    osc.connect(amp).connect(dest);
    osc.start(when);
    osc.stop(t + 0.05);
    voiceStats.created++;
  }
}

/** De 22:00 a 7:00 es de noche. */
function isNightNow(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 7;
}
