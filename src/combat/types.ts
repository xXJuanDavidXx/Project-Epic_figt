/** Tipos del combate. Modulo puro: sin Three.js ni Rapier. */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type AttackKind = 'normal' | 'perilous_sweep' | 'perilous_thrust' | 'perilous_grab';

/** Desde donde llega el golpe. Decide la pose de deflect y la direccion de las chispas. */
export type StrikeDirection = 'overhead' | 'from_left' | 'from_right' | 'thrust' | 'low';

/**
 * Ataque definido como datos (CLAUDE.md seccion 4).
 * La hitbox es una esfera que recorre de `hitboxFrom` a `hitboxTo` durante los ticks activos,
 * en espacio LOCAL del atacante (adelante = -Z). En M5 se ancla a `hitboxBone`.
 */
export interface AttackDef {
  id: string;
  startupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  vitalityDmg: number;
  postureDmg: number;
  kind: AttackKind;
  strike: StrikeDirection;
  hitboxBone: string;
  hitboxRadius: number;
  hitboxFrom: Vec3;
  hitboxTo: Vec3;
  /** Ticks [desde, hasta] (desde el inicio del ataque) en los que se puede cancelar a guardia. */
  cancelWindow?: [number, number];
  /** Avance del atacante durante el startup+active, en metros. */
  lunge?: number;
}

export type Team = 'player' | 'enemy';

export type DeflectGrade = 'perfect' | 'normal';

/** Lo que el defensor puede hacer contra un golpe en este tick. */
export interface DefenseSnapshot {
  deflect: DeflectGrade | null;
  blocking: boolean;
  invulnerable: boolean;
  /** ¿El atacante esta dentro del arco frontal de la guardia? */
  facingAttacker: boolean;
}

export type HitOutcome = 'deflect_perfect' | 'deflect' | 'block' | 'guard_break' | 'hit' | 'evaded';

export interface HitResult {
  outcome: HitOutcome;
  defenderVitalityDmg: number;
  defenderPostureDmg: number;
  attackerPostureDmg: number;
  hitstopTicks: number;
  /** Empuje al defensor, en m/s, en la direccion atacante -> defensor. */
  knockback: number;
}
