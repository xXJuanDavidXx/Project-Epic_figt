/**
 * Postura (CLAUDE.md 5.1): se llena al bloquear, ser desviado o desviar; llena = rota.
 * Regenera proporcional a la vitalidad restante, mas rapido en guardia, y se pausa
 * unos ticks tras cada daño de postura. Modulo puro.
 */
export interface PostureRegenParams {
  regenPerTick: number;
  guardMultiplier: number;
  delayTicks: number;
}

export class Posture {
  private current = 0;
  private pause = 0;
  private isBroken = false;

  constructor(public max: number) {}

  get value(): number {
    return this.current;
  }

  get ratio(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }

  get broken(): boolean {
    return this.isBroken;
  }

  /** Ticks que faltan para que la regeneracion se reanude. */
  get regenPause(): number {
    return this.pause;
  }

  /**
   * Aplica daño de postura. Devuelve true si este golpe la ha roto.
   * @param canBreak false = se queda a 1 del maximo (el deflect no rompe la postura propia).
   */
  damage(amount: number, delayTicks: number, canBreak = true): boolean {
    if (amount <= 0 || this.isBroken) return false;
    this.pause = Math.max(this.pause, delayTicks);
    const next = this.current + amount;
    if (next >= this.max) {
      if (!canBreak) {
        this.current = Math.max(this.current, this.max - 1);
        return false;
      }
      this.current = this.max;
      this.isBroken = true;
      return true;
    }
    this.current = next;
    return false;
  }

  /** Un tick de regeneracion. `vitalityRatio` en [0, 1]. */
  update(vitalityRatio: number, guarding: boolean, params: PostureRegenParams): void {
    if (this.isBroken) return;
    if (this.pause > 0) {
      this.pause -= 1;
      return;
    }
    const vitality = Math.min(Math.max(vitalityRatio, 0), 1);
    const multiplier = guarding ? params.guardMultiplier : 1;
    this.current = Math.max(0, this.current - params.regenPerTick * vitality * multiplier);
  }

  /** Recuperarse de la rotura (tras el stun o un remate fallido). */
  recover(toValue = 0): void {
    this.isBroken = false;
    this.current = Math.min(Math.max(toValue, 0), this.max - 1);
    this.pause = 0;
  }

  reset(): void {
    this.current = 0;
    this.pause = 0;
    this.isBroken = false;
  }
}
