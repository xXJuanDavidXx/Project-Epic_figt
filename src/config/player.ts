import { secondsToTicks } from '@/config/sim';

/**
 * Tuning del jugador. Todos los tiempos en TICKS (60 Hz); las velocidades en m/s.
 * Punto de partida para tunear, no verdades (CLAUDE.md seccion 5).
 */
export interface PlayerConfig {
  // Cuerpo
  capsuleRadius: number;
  capsuleHalfHeight: number;
  /** Separacion que el character controller mantiene con el entorno. */
  skinOffset: number;

  // Locomocion
  walkSpeed: number;
  sprintSpeed: number;
  /** Aceleracion en suelo, m/s^2. Alta = respuesta inmediata (pilar 1). */
  groundAccel: number;
  groundDecel: number;
  /** Fraccion de la aceleracion disponible en el aire. */
  airControl: number;
  /** Velocidad de giro del personaje hacia su direccion de movimiento, rad/s. */
  turnSpeed: number;

  // Salto y caida
  jumpHeight: number;
  /** Multiplicador de gravedad al caer: caer mas rapido que subir se siente mejor. */
  fallGravityMultiplier: number;
  /** Multiplicador de gravedad al soltar el salto antes del apice (salto variable). */
  lowJumpGravityMultiplier: number;
  maxFallSpeed: number;
  /**
   * Ticks tras dejar el suelo en los que todavia se puede saltar.
   * La ventana del salto "pedido en el aire" la da `inputConfig.bufferTicks`.
   */
  coyoteTicks: number;

  // Esquiva
  dodgeSpeed: number;
  dodgeTicks: number;
  dodgeRecoveryTicks: number;

  // Combate
  /** Velocidad andando con la guardia alta. */
  guardWalkSpeed: number;
  /** Distancia a la que el jugador se encara solo al enemigo mas cercano (sin lock-on). */
  softLockRange: number;
  /** Giro hacia el objetivo en guardia/ataque, rad/s. */
  combatTurnSpeed: number;
  /** Fraccion del empuje que se conserva cada tick (0.8 = frena rapido). */
  knockbackRetention: number;
  /** El avance de un ataque se detiene a esta distancia del objetivo. */
  attackStopDistance: number;
  /** Ticks muerto antes de reaparecer (M2: sin menu de muerte todavia). */
  deadTicks: number;

  // Terreno
  maxSlopeClimbAngleDeg: number;
  minSlopeSlideAngleDeg: number;
  autostepMaxHeight: number;
  autostepMinWidth: number;
  snapToGroundDistance: number;
}

export const playerConfig: PlayerConfig = {
  capsuleRadius: 0.35,
  capsuleHalfHeight: 0.55,
  skinOffset: 0.02,

  walkSpeed: 4.6,
  sprintSpeed: 7.6,
  groundAccel: 70,
  groundDecel: 55,
  airControl: 0.35,
  turnSpeed: 14,

  jumpHeight: 1.7,
  fallGravityMultiplier: 1.45,
  lowJumpGravityMultiplier: 2.2,
  maxFallSpeed: 42,
  coyoteTicks: secondsToTicks(0.1),

  dodgeSpeed: 11.5,
  dodgeTicks: 16,
  dodgeRecoveryTicks: 8,

  guardWalkSpeed: 2.3,
  softLockRange: 7,
  combatTurnSpeed: 16,
  knockbackRetention: 0.8,
  attackStopDistance: 1.25,
  deadTicks: 150,

  maxSlopeClimbAngleDeg: 50,
  minSlopeSlideAngleDeg: 38,
  autostepMaxHeight: 0.45,
  autostepMinWidth: 0.2,
  snapToGroundDistance: 0.35,
};

/** Altura total de la capsula (radio + cilindro + radio). */
export function playerCapsuleHeight(config: PlayerConfig = playerConfig): number {
  return config.capsuleHalfHeight * 2 + config.capsuleRadius * 2;
}
