import type { DeflectGrade } from '@/combat/types';

/**
 * Ventana de deflect con anti-spam (CLAUDE.md 5.2).
 *
 * - Pulsar guardia abre una ventana de N ticks. Un golpe dentro = deflect; en los primeros
 *   ticks = deflect perfecto. El deflect funciona aunque ya se haya soltado el boton (un toque
 *   basta, como en el juego de referencia).
 * - Fuera de la ventana pero con guardia mantenida = bloqueo.
 * - Cada pulsacion seguida recorta la ventana de la SIGUIENTE; tras un rato sin pulsar se olvida.
 *   Un deflect con exito tambien perdona el spam: desviar bien un combo rapido no se castiga.
 *
 * Modulo puro y testeado.
 */
export interface DeflectParams {
  windowTicks: number;
  perfectTicks: number;
  spamPenaltyTicks: number;
  minWindowTicks: number;
  spamResetTicks: number;
}

export interface GuardEvaluation {
  deflect: DeflectGrade | null;
  blocking: boolean;
}

export class GuardTracker {
  private held = false;
  private pressTick: number | null = null;
  private lastPressTick: number | null = null;
  private spamCount = 0;
  private currentWindow = 0;

  constructor(private params: DeflectParams) {}

  setParams(params: DeflectParams): void {
    this.params = params;
  }

  get isHeld(): boolean {
    return this.held;
  }

  /** Ventana concedida a la ultima pulsacion (para el debug y los tests). */
  get activeWindowTicks(): number {
    return this.currentWindow;
  }

  get spamLevel(): number {
    return this.spamCount;
  }

  press(tick: number): void {
    const p = this.params;
    if (this.lastPressTick !== null && tick - this.lastPressTick < p.spamResetTicks) {
      this.spamCount += 1;
    } else {
      this.spamCount = 0;
    }
    this.lastPressTick = tick;
    this.pressTick = tick;
    this.held = true;
    this.currentWindow = Math.max(
      p.minWindowTicks,
      p.windowTicks - this.spamCount * p.spamPenaltyTicks,
    );
  }

  release(): void {
    this.held = false;
  }

  /**
   * Estado real del boton, una vez por tick. Sin esto, entrar en guardia con el boton ya
   * mantenido (sin pulsacion nueva) dejaria al personaje en pose de guardia SIN bloquear.
   */
  setHeld(held: boolean): void {
    this.held = held;
  }

  /** ¿Que pasa si un golpe conecta en este tick? */
  evaluate(tick: number): GuardEvaluation {
    let deflect: DeflectGrade | null = null;
    if (this.pressTick !== null) {
      const age = tick - this.pressTick;
      if (age >= 0 && age < this.currentWindow) {
        const perfectTicks = Math.min(this.params.perfectTicks, this.currentWindow);
        deflect = age < perfectTicks ? 'perfect' : 'normal';
      }
    }
    return { deflect, blocking: this.held };
  }

  /** Llamar tras un deflect con exito: el spam queda perdonado. */
  onDeflectSuccess(): void {
    this.spamCount = 0;
    this.lastPressTick = null;
  }

  /** Cerrar la ventana (p. ej. al ser golpeado o al empezar a atacar). */
  cancelWindow(): void {
    this.pressTick = null;
  }

  reset(): void {
    this.held = false;
    this.pressTick = null;
    this.lastPressTick = null;
    this.spamCount = 0;
    this.currentWindow = 0;
  }
}
