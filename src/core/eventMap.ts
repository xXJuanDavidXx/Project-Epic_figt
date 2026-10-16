import { EventBus } from '@/core/events';
import type { AttackDef, HitOutcome, StrikeDirection, Vec3 } from '@/combat/types';

/**
 * Eventos del juego. La logica emite; vfx, audio, camara, HUD y el log de debug escuchan.
 * Cada payload lleva el `tick` exacto (CLAUDE.md seccion 10).
 */
export interface CombatHitPayload {
  tick: number;
  attackerId: string;
  defenderId: string;
  attackId: string;
  strike: StrikeDirection;
  outcome: HitOutcome;
  contact: Vec3;
  direction: { x: number; z: number };
  postureDamage: number;
  vitalityDamage: number;
}

export interface GameEventMap {
  'sim:reset': { tick: number };
  'debug:timeScale': { tick: number; timeScale: number };

  /** Un ataque empieza su startup (silbido, trail). */
  /** `ticksToActive`: ticks hasta el primer tick activo (para sincronizar silbido y trail). */
  'combat:swingStart': {
    tick: number;
    attackerId: string;
    attack: AttackDef;
    ticksToActive: number;
  };
  /** Aviso de lectura: brillo en la hoja poco antes del golpe de un enemigo. */
  'combat:telegraph': {
    tick: number;
    attackerId: string;
    attack: AttackDef;
    ticksToImpact: number;
  };
  /** Cualquier golpe resuelto: deflect, bloqueo, impacto, rotura de guardia o esquiva. */
  'combat:resolved': CombatHitPayload;
  'combat:postureBreak': { tick: number; entityId: string; position: Vec3 };
  'combat:deathblow': { tick: number; attackerId: string; victimId: string; position: Vec3 };
  'combat:death': { tick: number; entityId: string };
  'combat:respawn': { tick: number; entityId: string };
}

/** Bus global del juego. Instancia unica por sesion. */
export const events = new EventBus<GameEventMap>();
