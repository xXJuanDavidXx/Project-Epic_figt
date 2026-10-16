import type * as THREE from 'three';
import { combatConfig } from '@/config/combat';
import { enemyConfig } from '@/config/enemy';
import { playerConfig } from '@/config/player';
import { StateMachine } from '@/core/fsm';
import type { EventBus } from '@/core/events';
import type { GameEventMap } from '@/core/eventMap';
import type { FixedUpdateSystem, FrameContext, RenderUpdateSystem, TickContext } from '@/core/loop';
import type { PhysicsWorld } from '@/physics/world';
import { KinematicMover } from '@/physics/kinematicMover';
import type { ActiveSwing, CombatEvent, Combatant } from '@/combat/Combatant';
import { activeProgress, attackPhase } from '@/combat/attackData';
import { isWithinArc } from '@/combat/hitResolver';
import { lerpVec3, localToWorld, verticalCapsule } from '@/combat/geometry';
import type { Capsule } from '@/combat/geometry';
import type { DefenseSnapshot, Team, Vec3 } from '@/combat/types';
import { rotateTowards, shortestAngleDelta, yawFromDirection } from '@/entities/player/locomotion';
import { DUMMY_PATTERN } from '@/entities/enemies/ai/dummyPattern';
import type { DuelistContext, DuelistStateId } from '@/entities/enemies/duelistStates';
import {
  continueCombo,
  createDuelistContext,
  createDuelistStates,
} from '@/entities/enemies/duelistStates';

/**
 * Duelista enmascarado (M2): enemigo de prueba con patron fijo, para aprender el deflect.
 * Mismo character controller cinematico que el jugador y mismo contrato Combatant.
 */
export class EnemyDuelist implements FixedUpdateSystem, RenderUpdateSystem, Combatant {
  readonly team: Team = 'enemy';
  readonly machine: StateMachine<DuelistContext, DuelistStateId>;
  readonly context: DuelistContext;
  readonly mover: KinematicMover;

  hitstop = 0;
  frozen = false;
  /** Posicion del objetivo (el jugador). La escribe main. */
  target: Combatant | null = null;

  private facing = 0;
  private prevFacing = 0;
  private readonly spawn: { x: number; y: number; z: number };

  constructor(
    readonly id: string,
    physics: PhysicsWorld,
    spawn: THREE.Vector3,
    spawnYaw: number,
    readonly object: THREE.Object3D,
    private readonly bus: EventBus<GameEventMap>,
    dt: number,
  ) {
    this.spawn = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.facing = spawnYaw;
    this.prevFacing = spawnYaw;
    this.mover = new KinematicMover(physics, spawn, {
      ...playerConfig,
      capsuleRadius: enemyConfig.capsuleRadius,
      capsuleHalfHeight: enemyConfig.capsuleHalfHeight,
    });
    this.context = createDuelistContext(
      enemyConfig,
      combatConfig,
      DUMMY_PATTERN,
      {
        onSwingStart: (attack, tick, ticksToActive) => {
          this.bus.emit('combat:swingStart', { tick, attackerId: this.id, attack, ticksToActive });
        },
        onTelegraph: (attack, tick, ticksToImpact) => {
          this.bus.emit('combat:telegraph', { tick, attackerId: this.id, attack, ticksToImpact });
        },
        onRespawn: (tick) => {
          this.mover.teleport(this.spawn);
          this.facing = spawnYaw;
          this.bus.emit('combat:respawn', { tick, entityId: this.id });
        },
      },
      dt,
    );
    this.machine = new StateMachine<DuelistContext, DuelistStateId>(
      createDuelistStates(),
      'idle',
      this.context,
    );
    this.context.machine = this.machine;
  }

  get position(): Vec3 {
    return this.mover.position;
  }

  get facingYaw(): number {
    return this.facing;
  }

  get posture(): DuelistContext['posture'] {
    return this.context.posture;
  }

  get vitality(): DuelistContext['vitality'] {
    return this.context.vitality;
  }

  get alive(): boolean {
    return !this.machine.is('dying', 'dead');
  }

  get stateId(): DuelistStateId {
    return this.machine.current;
  }

  fixedUpdate(ctx: TickContext): void {
    const context = this.context;
    context.tick = ctx.tick;
    if (this.hitstop > 0) {
      this.hitstop -= 1;
      this.frozen = true;
      this.mover.hold();
      this.prevFacing = this.facing;
      return;
    }
    this.frozen = false;
    context.dt = ctx.dt;
    context.position = this.mover.position;
    context.facing = this.facing;

    const target = this.target && this.target.alive ? this.target.position : null;
    context.target = target;
    context.targetDistance = target
      ? Math.hypot(target.x - this.mover.position.x, target.z - this.mover.position.z)
      : Number.POSITIVE_INFINITY;

    this.machine.update(ctx.tick);

    context.posture.update(
      context.vitality.ratio,
      this.machine.is('idle', 'approach', 'blockstun'),
      {
        regenPerTick: combatConfig.postureRegenPerTick,
        guardMultiplier: combatConfig.postureGuardRegenMultiplier,
        delayTicks: combatConfig.postureRegenDelayTicks,
      },
    );

    const kb = context.knockback;
    const moveX = context.velocity.x + kb.x;
    const moveZ = context.velocity.z + kb.z;
    kb.x *= playerConfig.knockbackRetention;
    kb.z *= playerConfig.knockbackRetention;
    this.mover.move(moveX * ctx.dt, -2 * ctx.dt, moveZ * ctx.dt);
    context.velocity3.x = moveX;
    context.velocity3.z = moveZ;

    this.prevFacing = this.facing;
    if (context.faceTarget && target) {
      const dir = { x: target.x - this.mover.position.x, z: target.z - this.mover.position.z };
      if (Math.hypot(dir.x, dir.z) > 1e-3) {
        this.facing = rotateTowards(
          this.facing,
          yawFromDirection(dir),
          enemyConfig.turnSpeed * ctx.dt,
        );
      }
    }
  }

  renderUpdate(ctx: FrameContext): void {
    const alpha = this.frozen ? 1 : ctx.alpha;
    this.object.position.lerpVectors(this.mover.previousPosition, this.mover.position, alpha);
    this.object.rotation.set(
      0,
      this.prevFacing + shortestAngleDelta(this.prevFacing, this.facing) * alpha,
      0,
    );
  }

  // ------------------------------------------------------------ Combatant
  hurtbox(): Capsule {
    return verticalCapsule(
      this.mover.position,
      enemyConfig.capsuleHalfHeight,
      enemyConfig.capsuleRadius,
    );
  }

  activeSwing(): ActiveSwing | null {
    const attack = this.context.attack;
    if (!attack || !this.machine.is('attack')) return null;
    if (attackPhase(attack, this.context.attackTicks) !== 'active') return null;
    const local = lerpVec3(
      attack.hitboxFrom,
      attack.hitboxTo,
      activeProgress(attack, this.context.attackTicks),
    );
    return {
      swingId: this.context.swingId,
      attack,
      hitbox: {
        center: localToWorld(local, this.mover.position, this.facing),
        radius: attack.hitboxRadius,
      },
    };
  }

  defense(_tick: number, attackerPosition: Vec3): DefenseSnapshot {
    const guarding = this.machine.is('idle', 'approach', 'blockstun');
    return {
      deflect: null,
      blocking: guarding,
      invulnerable: false,
      facingAttacker: isWithinArc(
        this.mover.position,
        this.facing,
        attackerPosition,
        combatConfig.guardArcDeg,
      ),
    };
  }

  canBeDeathblowed(): boolean {
    return this.machine.is('broken');
  }

  onHitReceived(event: CombatEvent): void {
    const context = this.context;
    context.knockback.x = event.direction.x * event.result.knockback;
    context.knockback.z = event.direction.z * event.result.knockback;

    if (event.defenderPostureBroken || event.defenderDied || context.vitality.value <= 0) {
      this.machine.force('broken', event.tick);
      return;
    }
    switch (event.result.outcome) {
      case 'block':
        context.blocksInARow += 1;
        // Reacciona a la agresion: tras varios bloqueos seguidos, contraataca enseguida.
        if (context.blocksInARow >= enemyConfig.counterAfterBlocks) context.pauseTicks = 0;
        this.machine.force('blockstun', event.tick);
        break;
      case 'guard_break':
        this.machine.force('broken', event.tick);
        break;
      case 'hit':
        this.machine.force('hitstun', event.tick);
        break;
      default:
        break;
    }
  }

  onAttackResolved(event: CombatEvent): void {
    const outcome = event.result.outcome;
    if (outcome !== 'deflect' && outcome !== 'deflect_perfect') return;
    const context = this.context;
    context.deflectedCount += 1;
    context.lastDeflectedStrike = event.attack.strike;
    context.knockback.x = -event.direction.x * combatConfig.knockbackDeflect;
    context.knockback.z = -event.direction.z * combatConfig.knockbackDeflect;
    if (event.attackerPostureBroken) {
      this.machine.force('broken', event.tick);
      return;
    }
    // El deflect NO corta el combo: si queda otro golpe, sale ya (el ritmo clang-clang-clang).
    if (!continueCombo(context, combatConfig.deflectBounceTicks)) {
      this.machine.force('recoil', event.tick);
    }
  }

  onDeathblowReceived(tick: number): void {
    this.machine.force('dying', tick);
    this.bus.emit('combat:death', { tick, entityId: this.id });
  }

  dispose(): void {
    this.mover.dispose();
  }
}
