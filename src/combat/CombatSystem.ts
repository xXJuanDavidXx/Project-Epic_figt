import { combatConfig } from '@/config/combat';
import type { CombatConfig } from '@/config/combat';
import type { EventBus } from '@/core/events';
import type { GameEventMap } from '@/core/eventMap';
import type { ActiveSwing, CombatEvent, Combatant } from '@/combat/Combatant';
import { sphereIntersectsCapsule } from '@/combat/geometry';
import { resolveHit } from '@/combat/hitResolver';
import type { Vec3 } from '@/combat/types';

/**
 * Resuelve el combate una vez por tick, DESPUES de que todas las entidades se hayan movido.
 *
 * - Un tajo golpea una sola vez a cada objetivo (CLAUDE.md seccion 4).
 * - Aplica postura/vitalidad, pone el hitstop a ambos y notifica a las entidades.
 * - Emite los eventos que consumen vfx, audio, camara y HUD.
 *
 * No importa Three.js ni Rapier: testeable con combatientes falsos.
 */
export class CombatSystem {
  private readonly combatants: Combatant[] = [];
  /** swingKey -> ids de objetivos ya golpeados por ese tajo. */
  private readonly hitRegistry = new Map<string, Set<string>>();

  constructor(
    private readonly bus: EventBus<GameEventMap> | null = null,
    private readonly config: CombatConfig = combatConfig,
  ) {}

  add(combatant: Combatant): void {
    this.combatants.push(combatant);
  }

  remove(combatant: Combatant): void {
    const index = this.combatants.indexOf(combatant);
    if (index >= 0) this.combatants.splice(index, 1);
  }

  get all(): readonly Combatant[] {
    return this.combatants;
  }

  /** Enemigo vivo mas cercano a `from` (para el encaramiento suave sin lock-on). */
  nearestOpponent(of: Combatant, maxDistance: number): Combatant | null {
    let best: Combatant | null = null;
    let bestDistance = maxDistance;
    for (const other of this.combatants) {
      if (other === of || other.team === of.team || !other.alive) continue;
      const d = Math.hypot(other.position.x - of.position.x, other.position.z - of.position.z);
      if (d < bestDistance) {
        bestDistance = d;
        best = other;
      }
    }
    return best;
  }

  fixedUpdate(ctx: { tick: number }): void {
    const liveKeys = new Set<string>();

    for (const attacker of this.combatants) {
      if (!attacker.alive) continue;
      const swing = attacker.activeSwing();
      if (!swing) continue;
      const key = `${attacker.id}:${swing.swingId}`;
      // El tajo sigue vivo aunque el atacante este congelado por hitstop: si no se marca,
      // su registro se borraria y al descongelarse volveria a golpear al mismo objetivo.
      liveKeys.add(key);
      if (attacker.hitstop > 0) continue;
      let hits = this.hitRegistry.get(key);
      if (!hits) {
        hits = new Set();
        this.hitRegistry.set(key, hits);
      }

      for (const defender of this.combatants) {
        if (defender === attacker || defender.team === attacker.team || !defender.alive) continue;
        if (hits.has(defender.id)) continue;
        if (!sphereIntersectsCapsule(swing.hitbox, defender.hurtbox())) continue;
        hits.add(defender.id);
        this.resolve(ctx.tick, attacker, defender, swing);
        // Un deflect detiene el tajo: no sigue cortando a otros objetivos.
        if (attacker.activeSwing() === null) break;
      }
    }

    // Olvidar tajos que ya terminaron.
    for (const key of this.hitRegistry.keys()) {
      if (!liveKeys.has(key)) this.hitRegistry.delete(key);
    }
  }

  private resolve(
    tick: number,
    attacker: Combatant,
    defender: Combatant,
    swing: ActiveSwing,
  ): void {
    const direction = horizontalDirection(attacker.position, defender.position);
    const contact = contactPoint(attacker.position, defender.position, swing);

    if (swing.attack.id === 'deathblow') {
      if (defender.canBeDeathblowed()) {
        defender.vitality.kill();
        attacker.hitstop = this.config.hitstopDeathblow;
        defender.hitstop = this.config.hitstopDeathblow;
        defender.onDeathblowReceived(tick, attacker);
        this.bus?.emit('combat:deathblow', {
          tick,
          attackerId: attacker.id,
          victimId: defender.id,
          position: { ...defender.position },
        });
      }
      return;
    }

    const result = resolveHit(
      swing.attack,
      defender.defense(tick, attacker.position),
      { value: defender.posture.value, max: defender.posture.max },
      this.config,
    );

    const isDeflect = result.outcome === 'deflect' || result.outcome === 'deflect_perfect';
    const defenderPostureBroken = defender.posture.damage(
      result.defenderPostureDmg,
      this.config.postureRegenDelayTicks,
      isDeflect ? this.config.deflectCanBreakPosture : true,
    );
    const attackerPostureBroken = attacker.posture.damage(
      result.attackerPostureDmg,
      this.config.postureRegenDelayTicks,
    );
    const defenderDied = defender.vitality.damage(result.defenderVitalityDmg);

    if (result.hitstopTicks > 0) {
      attacker.hitstop = Math.max(attacker.hitstop, result.hitstopTicks);
      defender.hitstop = Math.max(defender.hitstop, result.hitstopTicks);
    }

    const event: CombatEvent = {
      tick,
      attacker,
      defender,
      attack: swing.attack,
      result,
      contact,
      direction,
      defenderPostureBroken,
      attackerPostureBroken,
      defenderDied,
    };
    defender.onHitReceived(event);
    attacker.onAttackResolved(event);

    this.bus?.emit('combat:resolved', {
      tick,
      attackerId: attacker.id,
      defenderId: defender.id,
      attackId: swing.attack.id,
      strike: swing.attack.strike,
      outcome: result.outcome,
      contact,
      direction,
      postureDamage: result.defenderPostureDmg,
      vitalityDamage: result.defenderVitalityDmg,
    });
    if (defenderPostureBroken) {
      this.bus?.emit('combat:postureBreak', {
        tick,
        entityId: defender.id,
        position: { ...defender.position },
      });
    }
    if (attackerPostureBroken) {
      this.bus?.emit('combat:postureBreak', {
        tick,
        entityId: attacker.id,
        position: { ...attacker.position },
      });
    }
  }
}

function horizontalDirection(from: Vec3, to: Vec3): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  return length > 1e-6 ? { x: dx / length, z: dz / length } : { x: 0, z: -1 };
}

/** Punto de choque estimado: sobre la linea entre ambos, a la altura del golpe. */
function contactPoint(attacker: Vec3, defender: Vec3, swing: ActiveSwing): Vec3 {
  const t = 0.62;
  return {
    x: attacker.x + (defender.x - attacker.x) * t,
    y: swing.hitbox.center.y,
    z: attacker.z + (defender.z - attacker.z) * t,
  };
}
