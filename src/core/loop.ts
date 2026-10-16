import { FIXED_DELTA, simConfig } from '@/config/sim';
import { timeDirector } from '@/core/timeDirector';

/** Contexto de un paso de simulacion de duracion fija. */
export interface TickContext {
  /** Numero de tick absoluto desde el arranque. Es el reloj del combate. */
  readonly tick: number;
  /** Duracion del tick en segundos (constante). */
  readonly dt: number;
}

/** Contexto de un frame de render (framerate del monitor, variable). */
export interface FrameContext {
  /** Interpolacion entre el tick anterior y el actual, en [0, 1). */
  readonly alpha: number;
  /** Delta real del frame en segundos (ya escalado por timeScale). */
  readonly frameDelta: number;
  /** Ultimo tick simulado. */
  readonly tick: number;
}

/** Sistema que avanza con la simulacion fija. Aqui vive TODA la logica de juego. */
export interface FixedUpdateSystem {
  fixedUpdate(ctx: TickContext): void;
}

/** Sistema que solo interpola/dibuja. Nunca decide reglas de juego. */
export interface RenderUpdateSystem {
  renderUpdate(ctx: FrameContext): void;
}

export function isFixedUpdateSystem(value: object): value is FixedUpdateSystem {
  return typeof (value as Partial<FixedUpdateSystem>).fixedUpdate === 'function';
}

export function isRenderUpdateSystem(value: object): value is RenderUpdateSystem {
  return typeof (value as Partial<RenderUpdateSystem>).renderUpdate === 'function';
}

export interface FixedStepOptions {
  tickRate?: number;
  maxSubSteps?: number;
  maxFrameDelta?: number;
}

/**
 * Acumulador de timestep fijo. Pieza PURA y testeable: no toca el DOM ni Three.js.
 *
 * Contrato:
 * - `advance(frameDelta)` devuelve cuantos ticks hay que simular en este frame.
 * - `alpha` queda en [0, 1) para interpolar el render entre el tick N-1 y el N.
 * - Si el frame fue tan largo que exigiria mas de `maxSubSteps` ticks, el exceso se
 *   DESCARTA (se cuenta en `droppedTicks`) en vez de acumularse: sin spiral of death.
 */
export class FixedStepAccumulator {
  readonly fixedDelta: number;
  maxSubSteps: number;
  maxFrameDelta: number;
  /** Escala temporal aplicada al delta entrante. 0 congela la simulacion (hitstop). */
  timeScale = 1;

  private accumulator = 0;
  private currentTick = 0;
  private currentAlpha = 0;
  private dropped = 0;
  private lastScaledDelta = 0;

  constructor(options: FixedStepOptions = {}) {
    const tickRate = options.tickRate ?? simConfig.tickRate;
    if (!Number.isFinite(tickRate) || tickRate <= 0) {
      throw new Error(`tickRate invalido: ${String(tickRate)}`);
    }
    this.fixedDelta = 1 / tickRate;
    this.maxSubSteps = options.maxSubSteps ?? simConfig.maxSubSteps;
    this.maxFrameDelta = options.maxFrameDelta ?? simConfig.maxFrameDelta;
  }

  /** Ultimo tick simulado. */
  get tick(): number {
    return this.currentTick;
  }

  /** Fraccion de tick pendiente, en [0, 1). Se usa para interpolar el render. */
  get alpha(): number {
    return this.currentAlpha;
  }

  /** Ticks descartados por frames demasiado largos (diagnostico de rendimiento). */
  get droppedTicks(): number {
    return this.dropped;
  }

  /** Delta del ultimo frame tras recortar y escalar, en segundos. */
  get scaledFrameDelta(): number {
    return this.lastScaledDelta;
  }

  /**
   * Consume el delta de un frame y devuelve el numero de ticks a simular.
   * @param frameDelta segundos transcurridos desde el frame anterior (sin escalar).
   */
  advance(frameDelta: number): number {
    const raw = Number.isFinite(frameDelta) && frameDelta > 0 ? frameDelta : 0;
    const clamped = Math.min(raw, this.maxFrameDelta);
    const scaled = clamped * this.timeScale;
    this.lastScaledDelta = scaled;
    this.accumulator += scaled;

    let steps = 0;
    while (this.accumulator >= this.fixedDelta && steps < this.maxSubSteps) {
      this.accumulator -= this.fixedDelta;
      this.currentTick += 1;
      steps += 1;
    }

    if (this.accumulator >= this.fixedDelta) {
      const backlog = Math.floor(this.accumulator / this.fixedDelta);
      this.dropped += backlog;
      this.accumulator -= backlog * this.fixedDelta;
    }

    this.currentAlpha = this.accumulator / this.fixedDelta;
    return steps;
  }

  /**
   * Fuerza un tick sin consumir tiempo real. Lo usa el modo "avance tick a tick"
   * del debug; no toca el acumulador, asi que alpha se queda donde estaba.
   */
  forceTick(): number {
    this.currentTick += 1;
    return this.currentTick;
  }

  /** Reinicia el reloj (cambio de escena, reinicio de combate, tests). */
  reset(): void {
    this.accumulator = 0;
    this.currentTick = 0;
    this.currentAlpha = 0;
    this.dropped = 0;
    this.lastScaledDelta = 0;
  }
}

export interface GameLoopOptions extends FixedStepOptions {
  /** Escala temporal inicial. Si se pasa, el loop deja de leerla de simConfig. */
  timeScale?: number;
  /** Reloj monotono en milisegundos. Inyectable para tests. */
  now?: () => number;
  /** Planificador de frames. Inyectable para tests. */
  schedule?: (callback: (timeMs: number) => void) => number;
  /** Cancelador del planificador. */
  cancel?: (handle: number) => void;
}

/**
 * Game loop: simulacion a timestep fijo + render interpolado al framerate del monitor.
 * Los sistemas se registran una vez; el loop no sabe nada de su contenido.
 */
export class GameLoop {
  readonly clock: FixedStepAccumulator;

  private readonly fixedSystems: FixedUpdateSystem[] = [];
  private readonly renderSystems: RenderUpdateSystem[] = [];
  private readonly now: () => number;
  private readonly schedule: (callback: (timeMs: number) => void) => number;
  private readonly cancel: (handle: number) => void;

  /**
   * Campos fijados explicitamente al construir. Esos NO se re-leen de `simConfig`:
   * permite loops deterministas en tests sin perder el tuneo en vivo en el juego.
   */
  private readonly pinned: { maxSubSteps: boolean; maxFrameDelta: boolean; timeScale: boolean };

  private handle: number | null = null;
  private lastTimeMs = 0;
  private stepsLastFrame = 0;
  /** El primer frame tras start() se consume con delta 0: la carga inicial no se simula. */
  private skipNextDelta = false;

  constructor(options: GameLoopOptions = {}) {
    this.clock = new FixedStepAccumulator(options);
    this.pinned = {
      maxSubSteps: options.maxSubSteps !== undefined,
      maxFrameDelta: options.maxFrameDelta !== undefined,
      timeScale: options.timeScale !== undefined,
    };
    if (options.timeScale !== undefined) {
      this.clock.timeScale = options.timeScale;
    }
    this.now = options.now ?? (() => performance.now());
    this.schedule = options.schedule ?? ((cb) => requestAnimationFrame(cb));
    this.cancel = options.cancel ?? ((h) => cancelAnimationFrame(h));
  }

  get running(): boolean {
    return this.handle !== null;
  }

  /** Ticks simulados en el ultimo frame (0 durante hitstop). */
  get stepsPerFrame(): number {
    return this.stepsLastFrame;
  }

  /**
   * Registra un sistema. Un mismo objeto puede ser de simulacion, de render o ambos;
   * se detecta por los metodos que implementa.
   */
  add(system: FixedUpdateSystem | RenderUpdateSystem): void {
    let registered = false;
    if (isFixedUpdateSystem(system)) {
      this.fixedSystems.push(system);
      registered = true;
    }
    if (isRenderUpdateSystem(system)) {
      this.renderSystems.push(system);
      registered = true;
    }
    if (!registered) {
      throw new Error('El sistema no implementa fixedUpdate ni renderUpdate.');
    }
  }

  remove(system: FixedUpdateSystem | RenderUpdateSystem): void {
    for (const list of [this.fixedSystems, this.renderSystems] as const) {
      const index = (list as readonly unknown[]).indexOf(system);
      if (index >= 0) {
        list.splice(index, 1);
      }
    }
  }

  start(): void {
    if (this.handle !== null) return;
    this.lastTimeMs = this.now();
    this.skipNextDelta = true;
    this.queue();
  }

  stop(): void {
    if (this.handle === null) return;
    this.cancel(this.handle);
    this.handle = null;
  }

  /** Procesa un frame. Publico para poder dirigirlo desde tests o modo tick-a-tick. */
  frame(timeMs: number): void {
    const frameDelta = this.skipNextDelta ? 0 : (timeMs - this.lastTimeMs) / 1000;
    this.skipNextDelta = false;
    this.lastTimeMs = timeMs;
    if (!this.pinned.timeScale) timeDirector.update(Math.min(frameDelta, simConfig.maxFrameDelta));

    this.syncLiveConfig();

    const steps = this.clock.advance(frameDelta);
    this.stepsLastFrame = steps;

    for (let i = 0; i < steps; i += 1) {
      const ctx: TickContext = { tick: this.clock.tick - (steps - 1 - i), dt: this.fixedDelta };
      for (const system of this.fixedSystems) {
        system.fixedUpdate(ctx);
      }
    }

    const frameCtx: FrameContext = {
      alpha: this.clock.alpha,
      frameDelta: this.clock.scaledFrameDelta,
      tick: this.clock.tick,
    };
    for (const system of this.renderSystems) {
      system.renderUpdate(frameCtx);
    }
  }

  /** Avanza exactamente un tick de simulacion, ignorando el reloj (debug). */
  stepOnce(): void {
    const ctx: TickContext = { tick: this.clock.forceTick(), dt: this.fixedDelta };
    for (const system of this.fixedSystems) {
      system.fixedUpdate(ctx);
    }
    const frameCtx: FrameContext = { alpha: 0, frameDelta: this.fixedDelta, tick: ctx.tick };
    for (const system of this.renderSystems) {
      system.renderUpdate(frameCtx);
    }
  }

  /** Recoge los valores tuneados en caliente desde lil-gui. */
  private syncLiveConfig(): void {
    if (!this.pinned.timeScale) this.clock.timeScale = simConfig.timeScale * timeDirector.scale;
    if (!this.pinned.maxSubSteps) this.clock.maxSubSteps = simConfig.maxSubSteps;
    if (!this.pinned.maxFrameDelta) this.clock.maxFrameDelta = simConfig.maxFrameDelta;
  }

  private get fixedDelta(): number {
    return this.clock.fixedDelta;
  }

  private queue(): void {
    this.handle = this.schedule((timeMs) => {
      this.queue();
      this.frame(timeMs);
    });
  }
}

export { FIXED_DELTA };
