/** Vitalidad (CLAUDE.md 5.1). Llega a 0 -> muerte. Modulo puro. */
export class Vitality {
  private current: number;

  constructor(public max: number) {
    this.current = max;
  }

  get value(): number {
    return this.current;
  }

  get ratio(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }

  get dead(): boolean {
    return this.current <= 0;
  }

  /** Aplica daño. Devuelve true si este golpe ha matado. */
  damage(amount: number): boolean {
    if (amount <= 0 || this.dead) return false;
    this.current = Math.max(0, this.current - amount);
    return this.current === 0;
  }

  heal(amount: number): void {
    if (this.dead) return;
    this.current = Math.min(this.max, this.current + Math.max(amount, 0));
  }

  kill(): void {
    this.current = 0;
  }

  reset(): void {
    this.current = this.max;
  }
}
