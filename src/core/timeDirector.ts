/**
 * Director del tiempo de juego: camara lenta dramatica (remates, roturas de postura).
 *
 * Es un multiplicador ENCIMA del `simConfig.timeScale` de debug. No cambia el determinismo:
 * la simulacion sigue avanzando en ticks enteros, solo llegan mas despacio en tiempo real.
 * Puro y testeable: se le pasa el tiempo real transcurrido.
 */
export class TimeDirector {
  private target = 1;
  private remaining = 0;
  private current = 1;

  /** Escala efectiva actual (0..1). */
  get scale(): number {
    return this.current;
  }

  /**
   * Camara lenta durante `holdSeconds` de tiempo REAL, luego vuelve a 1 en `releaseSeconds`.
   * Una peticion mas lenta pisa a una mas rapida; nunca al reves.
   */
  slowMotion(scale: number, holdSeconds: number): void {
    if (this.remaining > 0 && scale > this.target) return;
    this.target = Math.min(Math.max(scale, 0.05), 1);
    this.remaining = holdSeconds;
    this.current = this.target;
  }

  /** Avanzar con el tiempo real del frame (sin escalar). */
  update(realDelta: number, releaseSeconds = 0.18): void {
    if (this.remaining > 0) {
      this.remaining -= realDelta;
      this.current = this.target;
      return;
    }
    if (this.current < 1) {
      this.current = Math.min(1, this.current + (realDelta / releaseSeconds) * (1 - this.target));
      if (this.current >= 0.999) {
        this.current = 1;
        this.target = 1;
      }
    }
  }

  reset(): void {
    this.target = 1;
    this.remaining = 0;
    this.current = 1;
  }
}

export const timeDirector = new TimeDirector();
