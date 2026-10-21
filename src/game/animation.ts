/**
 * Animación de andar del personaje "roeno" (hoja de fotogramas pintada).
 * El WalkAnimator es lógica pura: recibe la velocidad y decide la vista, la fase
 * del ciclo de pasos y cuándo pisa cada pie; el personaje solo pinta el fotograma.
 */

/** Hacia dónde mira el personaje. */
export type Vista = "lado" | "frente" | "espalda";
/** Pie que toca el suelo en un paso. */
export type Pie = "izq" | "der";
export type WalkState = "quieto" | "arrancando" | "andando" | "parando";

/** Índices de fotogramas de la hoja del personaje. */
export interface WalkAnimMeta {
  /** Fotograma de reposo (mirando al jugador tras un rato quieto). */
  quieto: number;
  /** Fotograma parado para cada vista. */
  parado: Record<Vista, number>;
  /** Primer fotograma del ciclo de andar para cada vista. */
  ciclo: Record<Vista, number>;
  /** Fotogramas por ciclo (un paso de cada pie). */
  cicloLen: number;
  /** Fases del ciclo en las que pisa cada pie. */
  pisadas: number[];
}

export interface RoenoMeta {
  frameW: number;
  frameH: number;
  /** Altura (px del fotograma) de los pies: punto de apoyo del sprite. */
  pivotY: number;
  frames: number;
  anim: WalkAnimMeta;
}

// Originalmente en src/art/pintado/roeno.json
export const roenoMeta: RoenoMeta = {
  frameW: 120,
  frameH: 250,
  pivotY: 244,
  frames: 28,
  anim: {
    quieto: 0,
    parado: { lado: 1, frente: 2, espalda: 3 },
    ciclo: { lado: 4, frente: 12, espalda: 20 },
    cicloLen: 8,
    pisadas: [0, 0.5],
  },
};

/** Longitud de un paso (px de mundo): un ciclo completo son dos pasos. */
const STEP_LENGTH = 34;
/** Velocidad mínima (px/s) para considerar que se mueve. */
const MOVE_THRESHOLD = 12;
/** Fracción de paso que dura el arranque antes de pasar a "andando". */
const START_FRACTION = 0.75;
/** Tiempo (ms) que tarda en llevar el pie al suelo al pararse. */
const STOP_MS = 170;
/** Tiempo quieto (ms) antes de girarse hacia el jugador. */
const IDLE_MS = 1400;
/** Histéresis para cambiar entre vista lateral y frontal/trasera. */
const VIEW_HYSTERESIS = 1.3;
/** Fase inicial del ciclo al arrancar. */
const START_PHASE = 0.19;

export class WalkAnimator {
  estado: WalkState = "quieto";
  vista: Vista = "frente";
  izquierda = false;
  /** Fase del ciclo de andar en [0, 1): 0.5 pisa el izquierdo y 1 el derecho. */
  fase = 0;
  /** Contador de cambios de orientación (el personaje lo usa para el gesto de giro). */
  giros = 0;
  /** Quieto mirando al jugador. */
  reposo = false;
  private recorrido = 0;
  private quietoMs = 0;
  private faseObjetivo = 0;
  private velParar = 0;
  private meta: WalkAnimMeta;

  constructor(meta: WalkAnimMeta) {
    this.meta = meta;
  }

  /** Avanza la animación con la velocidad (px/s); devuelve los pies que han pisado. */
  update(vx: number, vy: number, dtMs: number): Pie[] {
    const dt = Math.max(0, Math.min(dtMs, 250)) / 1000;
    const speed = Math.hypot(vx, vy);
    const steps: Pie[] = [];
    if (speed > MOVE_THRESHOLD) {
      this.orientar(vx, vy, speed);
      if (this.estado === "quieto") {
        this.estado = "arrancando";
        this.fase = START_PHASE;
        this.recorrido = 0;
      } else if (this.estado === "parando") {
        this.estado = "andando";
      }
      const distance = speed * dt;
      this.recorrido += distance;
      if (this.estado === "arrancando" && this.recorrido >= STEP_LENGTH * START_FRACTION) this.estado = "andando";
      this.avanzar(distance / (2 * STEP_LENGTH), steps);
      this.quietoMs = 0;
      this.reposo = false;
    } else if (this.estado === "arrancando" || this.estado === "andando") {
      // Se para: termina el paso hasta la siguiente posición con un pie en el aire
      this.estado = "parando";
      const phase = this.fase;
      this.faseObjetivo = phase < 0.25 ? 0.25 : phase < 0.75 ? 0.75 : 1.25;
      this.velParar = (this.faseObjetivo - phase) / (STOP_MS / 1000);
    }
    if (this.estado === "parando" && speed <= MOVE_THRESHOLD) {
      const phase = this.fase;
      const remaining = this.faseObjetivo - (phase + (this.faseObjetivo > 1 && phase < 0.5 ? 1 : 0));
      const advance = Math.min(Math.max(0, remaining), this.velParar * dt);
      this.avanzar(advance, steps);
      if (remaining - advance <= 1e-6) {
        this.estado = "quieto";
        this.quietoMs = 0;
        steps.push(this.pieEnElAire());
      }
    } else if (this.estado === "quieto") {
      this.quietoMs += dt * 1000;
      if (!this.reposo && this.quietoMs >= IDLE_MS && this.vista !== "espalda") {
        this.reposo = true;
        this.giros++;
      }
    }
    return steps;
  }

  /** Fotograma de la hoja que toca mostrar. */
  frame(): number {
    const meta = this.meta;
    if (this.estado === "quieto") return this.reposo ? meta.quieto : meta.parado[this.vista];
    const offset = Math.round(this.fase * meta.cicloLen) % meta.cicloLen;
    return meta.ciclo[this.vista] + offset;
  }

  /** Cuánto apoya el pie en el suelo (0..1), para el aplastado del paso. */
  contacto(): number {
    return this.estado === "quieto" ? 0 : Math.max(0, Math.cos(4 * Math.PI * this.fase));
  }

  mirar(vista: Vista): void {
    if (this.vista !== vista) this.giros++;
    this.vista = vista;
    this.reposo = false;
    this.quietoMs = 0;
  }

  private orientar(vx: number, vy: number, speed: number): void {
    const absX = Math.abs(vx);
    const absY = Math.abs(vy);
    const vertical: Vista = vy > 0 ? "frente" : "espalda";
    let vista: Vista;
    if (this.estado === "quieto") vista = absX >= absY ? "lado" : vertical;
    else if (this.vista === "lado") vista = absY > absX * VIEW_HYSTERESIS ? vertical : "lado";
    else vista = absX > absY * VIEW_HYSTERESIS ? "lado" : vertical;
    let izquierda = this.izquierda;
    if (absX > speed * 0.2) izquierda = vx < 0;
    if (vista !== this.vista || izquierda !== this.izquierda || this.reposo) this.giros++;
    this.vista = vista;
    this.izquierda = izquierda;
  }

  /** Avanza la fase y anota cada pisada (como mucho 4 por llamada). */
  private avanzar(delta: number, steps: Pie[]): void {
    let phase = this.fase;
    let remaining = delta;
    while (remaining > 0 && steps.length < 4) {
      const limit = phase < 0.5 ? 0.5 : 1;
      if (phase + remaining < limit) {
        phase += remaining;
        remaining = 0;
      } else {
        remaining -= limit - phase;
        phase = limit;
        steps.push(limit === 0.5 ? "izq" : "der");
        if (phase >= 1) phase -= 1;
      }
    }
    this.fase = ((phase % 1) + 1) % 1;
  }

  private pieEnElAire(): Pie {
    return this.fase < 0.5 ? "izq" : "der";
  }
}
