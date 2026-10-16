/**
 * Tuning del combate (CLAUDE.md seccion 5). Tiempos en TICKS a 60 Hz.
 * Son puntos de partida: se ajustan probando, no se defienden.
 */
export interface CombatConfig {
  // --- Deflect (5.2) ---
  /** Ventana de deflect tras pulsar guardia, sin penalizacion por spam. */
  deflectWindowTicks: number;
  /** Primeros ticks de la ventana que cuentan como deflect perfecto. */
  perfectDeflectTicks: number;
  /** Ticks que se recorta la ventana por cada pulsacion seguida. */
  deflectSpamPenaltyTicks: number;
  /** Ventana minima por mucho que se spamee. */
  deflectMinWindowTicks: number;
  /** Ticks sin pulsar para que la penalizacion se olvide. */
  deflectSpamResetTicks: number;
  /** Un deflect nunca rompe la postura propia (la deja a 1 del maximo). */
  deflectCanBreakPosture: boolean;
  /** Arco frontal, en grados, en el que la guardia funciona. Por la espalda no se bloquea. */
  guardArcDeg: number;
  /** La estocada (perilous) exige deflect perfecto en vez de deflect normal. */
  thrustRequiresPerfectDeflect: boolean;

  // --- Postura (5.1) ---
  playerMaxPosture: number;
  playerMaxVitality: number;
  /** Regeneracion base de postura por tick, con vitalidad completa. */
  postureRegenPerTick: number;
  /** Multiplicador de regeneracion mientras se mantiene la guardia. */
  postureGuardRegenMultiplier: number;
  /** Ticks de pausa de la regeneracion tras recibir daño de postura. */
  postureRegenDelayTicks: number;

  // --- Reparto de postura segun el resultado (fraccion del postureDmg del ataque) ---
  deflectSelfPostureFactor: number;
  perfectDeflectSelfPostureFactor: number;
  deflectReflectPostureFactor: number;
  perfectDeflectReflectPostureFactor: number;
  blockPostureFactor: number;
  hitPostureFactor: number;

  // --- Hitstop (5.7): ticks congelados atacante y defensor ---
  hitstopDeflect: number;
  hitstopPerfectDeflect: number;
  hitstopBlock: number;
  hitstopHit: number;
  hitstopPostureBreak: number;
  hitstopDeathblow: number;

  // --- Empujes, en m/s aplicados al instante ---
  knockbackDeflect: number;
  knockbackBlock: number;
  knockbackHit: number;

  // --- Duraciones de reaccion ---
  blockStunTicks: number;
  hitStunTicks: number;
  guardBreakTicks: number;
  /** Ticks del gesto de deflect antes de poder volver a atacar o esquivar. */
  deflectRecoverTicks: number;
  /** Ticks que el atacante queda rebotado tras ser desviado (ultimo golpe del combo). */
  attackerRecoilTicks: number;
  /**
   * Rebote del arma tras un deflect A MITAD de combo: el siguiente golpe espera estos ticks.
   * Sin rebote la hoja enemiga "atraviesa" la guardia y el deflect no se siente.
   */
  deflectBounceTicks: number;
  /** Ventana de remate tras romper la postura (5.5). */
  postureBrokenTicks: number;
  deathblowRange: number;
  /** Ticks de invulnerabilidad de la esquiva [desde, hasta]. */
  dodgeIFrames: [number, number];
  /** Ticks hasta que el dummy reaparece tras un remate. */
  enemyRespawnTicks: number;
}

export const combatConfig: CombatConfig = {
  deflectWindowTicks: 12,
  perfectDeflectTicks: 4,
  deflectSpamPenaltyTicks: 3,
  deflectMinWindowTicks: 4,
  deflectSpamResetTicks: 30,
  deflectCanBreakPosture: false,
  guardArcDeg: 200,
  thrustRequiresPerfectDeflect: false,

  playerMaxPosture: 100,
  playerMaxVitality: 100,
  postureRegenPerTick: 0.2,
  postureGuardRegenMultiplier: 1.8,
  postureRegenDelayTicks: 45,

  deflectSelfPostureFactor: 0.3,
  perfectDeflectSelfPostureFactor: 0.1,
  deflectReflectPostureFactor: 0.7,
  perfectDeflectReflectPostureFactor: 1.1,
  blockPostureFactor: 1,
  hitPostureFactor: 0.5,

  hitstopDeflect: 5,
  hitstopPerfectDeflect: 8,
  hitstopBlock: 3,
  hitstopHit: 5,
  hitstopPostureBreak: 10,
  hitstopDeathblow: 14,

  knockbackDeflect: 2.6,
  knockbackBlock: 4.2,
  knockbackHit: 4.5,

  blockStunTicks: 12,
  hitStunTicks: 22,
  guardBreakTicks: 75,
  deflectRecoverTicks: 10,
  attackerRecoilTicks: 24,
  deflectBounceTicks: 9,
  postureBrokenTicks: 150,
  deathblowRange: 2.6,
  dodgeIFrames: [2, 11],
  enemyRespawnTicks: 180,
};
