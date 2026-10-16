import type { Capsule, Sphere } from '@/combat/geometry';
import type { Posture } from '@/combat/posture';
import type { Vitality } from '@/combat/vitality';
import type { AttackDef, DefenseSnapshot, HitResult, Team, Vec3 } from '@/combat/types';

/**
 * Contrato que cumple cualquier entidad que pelea (jugador, enemigos, jefe).
 * Puro: sin Three.js ni Rapier, para que el CombatSystem se pueda testear entero.
 */
export interface ActiveSwing {
  /** Identificador unico del tajo: un tajo golpea UNA vez a cada objetivo. */
  swingId: number;
  attack: AttackDef;
  hitbox: Sphere;
}

export interface CombatEvent {
  tick: number;
  attacker: Combatant;
  defender: Combatant;
  attack: AttackDef;
  result: HitResult;
  /** Punto aproximado de contacto (simulacion). El render lo refina con las hojas reales. */
  contact: Vec3;
  /** Direccion horizontal atacante -> defensor, normalizada. */
  direction: { x: number; z: number };
  /** ¿Este golpe ha roto la postura del defensor / del atacante? */
  defenderPostureBroken: boolean;
  attackerPostureBroken: boolean;
  defenderDied: boolean;
}

export interface Combatant {
  readonly id: string;
  readonly team: Team;
  readonly posture: Posture;
  readonly vitality: Vitality;
  /** Ticks congelados restantes (hitstop). Lo pone el CombatSystem. */
  hitstop: number;

  readonly position: Vec3;
  readonly facingYaw: number;
  readonly alive: boolean;

  hurtbox(): Capsule;
  activeSwing(): ActiveSwing | null;
  defense(tick: number, attackerPosition: Vec3): DefenseSnapshot;

  /** ¿Se le puede rematar ahora (postura rota o vitalidad a cero)? */
  canBeDeathblowed(): boolean;

  onHitReceived(event: CombatEvent): void;
  onAttackResolved(event: CombatEvent): void;
  onDeathblowReceived(tick: number, attacker: Combatant): void;
}
