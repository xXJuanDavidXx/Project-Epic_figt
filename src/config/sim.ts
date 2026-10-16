/**
 * Parametros de la simulacion. Todo el timing de combate se mide en TICKS,
 * nunca en milisegundos de frame (CLAUDE.md seccion 4 y 11).
 */
export interface SimConfig {
  /** Frecuencia de la simulacion fija, en Hz. Solo se lee al construir el loop. */
  readonly tickRate: number;
  /** Maximo de pasos de simulacion por frame, para evitar la "spiral of death". */
  maxSubSteps: number;
  /** Delta de frame maximo aceptado, en segundos (protege al volver de otra pestania). */
  maxFrameDelta: number;
  /** Escala temporal global: 1 = normal, 0 = congelado (hitstop), 0.25 = slow-mo debug. */
  timeScale: number;
}

export const simConfig: SimConfig = {
  tickRate: 60,
  maxSubSteps: 5,
  maxFrameDelta: 0.25,
  timeScale: 1,
};

/** Duracion de un tick en segundos. Derivado, no tunear a mano. */
export const FIXED_DELTA = 1 / simConfig.tickRate;

/** Convierte ticks a segundos (util para configurar y para leer logs). */
export function ticksToSeconds(ticks: number): number {
  return ticks * FIXED_DELTA;
}

/** Convierte segundos a ticks enteros (redondeo al mas cercano). */
export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * simConfig.tickRate);
}
