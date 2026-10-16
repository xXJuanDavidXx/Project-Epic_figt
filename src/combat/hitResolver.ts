import type { CombatConfig } from '@/config/combat';
import type { AttackDef, DefenseSnapshot, HitResult } from '@/combat/types';

/**
 * Resuelve un golpe contra el estado del defensor. Funcion PURA: no muta nada; devuelve
 * cuanto daño de vitalidad/postura recibe cada uno, el hitstop y el empuje.
 *
 * Reglas (CLAUDE.md 5.2 y 5.3):
 * - Invulnerable (i-frames de esquiva) -> evaded.
 * - Barrido y agarre no se pueden bloquear ni desviar -> hit.
 * - Estocada: no se bloquea; se puede desviar (perfecto si `thrustRequiresPerfectDeflect`).
 * - Normal: deflect > bloqueo > golpe. La guardia solo cubre el arco frontal.
 * - Un bloqueo que llena la postura -> guard_break.
 */
export function resolveHit(
  attack: AttackDef,
  defense: DefenseSnapshot,
  defenderPosture: { value: number; max: number },
  config: CombatConfig,
): HitResult {
  if (defense.invulnerable) {
    return result('evaded', 0, 0, 0, 0, 0);
  }

  const canDefend = defense.facingAttacker;
  const blockable = attack.kind === 'normal';
  const deflectable = attack.kind === 'normal' || attack.kind === 'perilous_thrust';

  if (canDefend && deflectable && defense.deflect !== null) {
    const needsPerfect = attack.kind === 'perilous_thrust' && config.thrustRequiresPerfectDeflect;
    if (defense.deflect === 'perfect') {
      return result(
        'deflect_perfect',
        0,
        attack.postureDmg * config.perfectDeflectSelfPostureFactor,
        attack.postureDmg * config.perfectDeflectReflectPostureFactor,
        config.hitstopPerfectDeflect,
        config.knockbackDeflect,
      );
    }
    if (!needsPerfect) {
      return result(
        'deflect',
        0,
        attack.postureDmg * config.deflectSelfPostureFactor,
        attack.postureDmg * config.deflectReflectPostureFactor,
        config.hitstopDeflect,
        config.knockbackDeflect,
      );
    }
  }

  if (canDefend && blockable && defense.blocking) {
    const postureDmg = attack.postureDmg * config.blockPostureFactor;
    if (defenderPosture.value + postureDmg >= defenderPosture.max) {
      return result(
        'guard_break',
        0,
        postureDmg,
        0,
        config.hitstopPostureBreak,
        config.knockbackHit,
      );
    }
    return result('block', 0, postureDmg, 0, config.hitstopBlock, config.knockbackBlock);
  }

  return result(
    'hit',
    attack.vitalityDmg,
    attack.postureDmg * config.hitPostureFactor,
    0,
    config.hitstopHit,
    config.knockbackHit,
  );
}

function result(
  outcome: HitResult['outcome'],
  defenderVitalityDmg: number,
  defenderPostureDmg: number,
  attackerPostureDmg: number,
  hitstopTicks: number,
  knockback: number,
): HitResult {
  return {
    outcome,
    defenderVitalityDmg,
    defenderPostureDmg,
    attackerPostureDmg,
    hitstopTicks,
    knockback,
  };
}

/** ¿Esta `target` dentro del arco frontal de quien mira con `yaw` desde `origin`? */
export function isWithinArc(
  origin: { x: number; z: number },
  yaw: number,
  target: { x: number; z: number },
  arcDeg: number,
): boolean {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return true;
  // Adelante con este yaw es (-sin, -cos) (misma convencion que la locomocion).
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const cos = (dx * forwardX + dz * forwardZ) / length;
  const halfArc = ((arcDeg / 2) * Math.PI) / 180;
  return cos >= Math.cos(Math.min(halfArc, Math.PI));
}
