import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { playerConfig } from '@/config/player';
import { combatConfig } from '@/config/combat';
import type { InputState } from '@/core/input';
import type { EventBus } from '@/core/events';
import type { GameEventMap } from '@/core/eventMap';
import { StateMachine } from '@/core/fsm';
import type { FixedUpdateSystem, FrameContext, RenderUpdateSystem, TickContext } from '@/core/loop';
import type { PhysicsWorld } from '@/physics/world';
import { KinematicMover } from '@/physics/kinematicMover';
import type { CameraRig } from '@/camera/CameraRig';
import type { ActiveSwing, CombatEvent, Combatant } from '@/combat/Combatant';
import { activeProgress, attackPhase } from '@/combat/attackData';
import { isWithinArc } from '@/combat/hitResolver';
import { lerpVec3, localToWorld, verticalCapsule } from '@/combat/geometry';
import type { Capsule } from '@/combat/geometry';
import type { DefenseSnapshot, Team, Vec3 } from '@/combat/types';
import {
  cameraRelativeDirection,
  rotateTowards,
  shortestAngleDelta,
  yawFromDirection,
} from '@/entities/player/locomotion';
import type { PlayerContext, PlayerStateId, PlayerTarget } from '@/entities/player/playerStates';
import {
  DEFENSIVE_STATES,
  createPlayerContext,
  createPlayerStates,
  deflectParams,
} from '@/entities/player/playerStates';

/** Proveedor del objetivo mas cercano (sin lock-on todavia: M3). */
export type TargetProvider = (
  self: PlayerController,
  range: number,
) => (PlayerTarget & Combatant) | null;

/**
 * Jugador: character controller cinematico + FSM de locomocion y combate.
 * Cumple el contrato `Combatant` para que el CombatSystem lo trate como a cualquier enemigo.
 */
export class PlayerController implements FixedUpdateSystem, RenderUpdateSystem, Combatant {
  readonly id = 'player';
  readonly team: Team = 'player';
  readonly object: THREE.Object3D;
  readonly machine: StateMachine<PlayerContext, PlayerStateId>;
  readonly context: PlayerContext;
  readonly mover: KinematicMover;

  hitstop = 0;
  /** true si este tick estuvo congelado (lo leen las vistas para no avanzar la animacion). */
  frozen = false;
  targetProvider: TargetProvider | null = null;
  /** Bus para anunciar el inicio de los ataques (audio, trails). Opcional: los tests no lo usan. */
  bus: EventBus<GameEventMap> | null = null;
  private lastSwingId = 0;

  private facingYaw_ = 0;
  private prevYaw = 0;
  private readonly spawn: THREE.Vector3;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: InputState,
    private readonly rig: CameraRig,
    spawn: THREE.Vector3,
    object: THREE.Object3D,
    dt: number,
  ) {
    this.object = object;
    this.spawn = spawn.clone();
    this.mover = new KinematicMover(physics, spawn, playerConfig);
    this.context = createPlayerContext(
      playerConfig,
      combatConfig,
      input,
      physics.world.gravity.y,
      dt,
    );
    this.machine = new StateMachine<PlayerContext, PlayerStateId>(
      createPlayerStates(),
      'idle',
      this.context,
    );
    this.context.machine = this.machine;
  }

  // ------------------------------------------------------------ lectura
  get characterCollider(): RAPIER.Collider {
    return this.mover.collider;
  }

  get worldPosition(): THREE.Vector3 {
    return this.mover.position;
  }

  get position(): Vec3 {
    return this.mover.position;
  }

  get yaw(): number {
    return this.facingYaw_;
  }

  get facingYaw(): number {
    return this.facingYaw_;
  }

  get stateId(): PlayerStateId {
    return this.machine.current;
  }

  get velocity(): Readonly<{ x: number; y: number; z: number }> {
    return this.context.velocity;
  }

  get grounded(): boolean {
    return this.context.grounded;
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.context.velocity.x, this.context.velocity.z);
  }

  get posture(): PlayerContext['posture'] {
    return this.context.posture;
  }

  get vitality(): PlayerContext['vitality'] {
    return this.context.vitality;
  }

  get alive(): boolean {
    return !this.context.vitality.dead;
  }

  // ------------------------------------------------------------ simulacion
  fixedUpdate(ctx: TickContext): void {
    const context = this.context;
    context.tick = ctx.tick;

    // Hitstop: todo congelado, pero el input sigue entrando al buffer (se ejecuta al soltar).
    if (this.hitstop > 0) {
      this.hitstop -= 1;
      this.frozen = true;
      this.mover.hold();
      this.prevYaw = this.facingYaw_;
      return;
    }
    this.frozen = false;

    const config = playerConfig;
    context.dt = ctx.dt;
    context.gravity = this.physics.world.gravity.y;
    context.suppressGravity = false;
    context.position = this.mover.position;
    context.facing = this.facingYaw_;
    context.guard.setParams(deflectParams(combatConfig));
    if (context.dodgeCooldown > 0) context.dodgeCooldown -= 1;
    context.guard.setHeld(this.input.held('guard'));
    context.target = this.targetProvider?.(this, config.softLockRange) ?? null;

    // 1. Input -> direccion del mundo relativa a la camara.
    const direction = cameraRelativeDirection(this.input.moveX, this.input.moveY, this.rig.yaw);
    context.desiredDirection = direction;
    context.moveMagnitude = this.input.moveMagnitude;

    // 2. Memoria de suelo, FSM.
    context.ground.update(context.grounded);
    this.machine.update(ctx.tick);
    if (context.swingId !== this.lastSwingId && context.attack) {
      this.lastSwingId = context.swingId;
      this.bus?.emit('combat:swingStart', {
        tick: ctx.tick,
        attackerId: this.id,
        attack: context.attack,
      });
    }

    // 3. Postura: regenera segun la vitalidad, mas rapido con la guardia alta.
    context.posture.update(context.vitality.ratio, this.machine.is('guard'), {
      regenPerTick: combatConfig.postureRegenPerTick,
      guardMultiplier: combatConfig.postureGuardRegenMultiplier,
      delayTicks: combatConfig.postureRegenDelayTicks,
    });

    // 4. Gravedad asimetrica y salto variable.
    if (!context.suppressGravity) {
      const rising = context.velocity.y > 0;
      let multiplier = 1;
      if (!rising) multiplier = config.fallGravityMultiplier;
      else if (!this.input.held('jump')) multiplier = config.lowJumpGravityMultiplier;
      context.velocity.y += context.gravity * multiplier * ctx.dt;
      context.velocity.y = Math.max(context.velocity.y, -config.maxFallSpeed);
    }
    if (context.grounded && context.velocity.y < 0) context.velocity.y = -2;

    // 5. Empuje de los golpes, que se va frenando.
    const kb = context.knockback;
    const moveX = context.velocity.x + kb.x;
    const moveZ = context.velocity.z + kb.z;
    kb.x *= config.knockbackRetention;
    kb.z *= config.knockbackRetention;
    if (Math.hypot(kb.x, kb.z) < 0.05) {
      kb.x = 0;
      kb.z = 0;
    }

    // 6. Movimiento con colisiones.
    const movement = this.mover.move(moveX * ctx.dt, context.velocity.y * ctx.dt, moveZ * ctx.dt);
    if (
      !this.mover.grounded &&
      context.velocity.y > 0 &&
      movement.y < context.velocity.y * ctx.dt * 0.5
    ) {
      context.velocity.y = 0;
    }
    context.grounded = this.mover.grounded;

    // 7. Orientacion: al objetivo en combate, si no a la direccion de movimiento.
    this.prevYaw = this.facingYaw_;
    const target = context.target;
    if (context.faceTarget && target) {
      const toTarget = {
        x: target.position.x - this.mover.position.x,
        z: target.position.z - this.mover.position.z,
      };
      if (Math.hypot(toTarget.x, toTarget.z) > 1e-3) {
        this.facingYaw_ = rotateTowards(
          this.facingYaw_,
          yawFromDirection(toTarget),
          config.combatTurnSpeed * ctx.dt,
        );
      }
    } else if (
      !context.faceTarget &&
      (direction.x !== 0 || direction.z !== 0) &&
      this.canTurnFreely()
    ) {
      this.facingYaw_ = rotateTowards(
        this.facingYaw_,
        yawFromDirection(direction),
        config.turnSpeed * ctx.dt,
      );
    }
  }

  renderUpdate(ctx: FrameContext): void {
    const alpha = this.frozen ? 1 : ctx.alpha;
    this.object.position.lerpVectors(this.mover.previousPosition, this.mover.position, alpha);
    const yaw = this.prevYaw + shortestAngleDelta(this.prevYaw, this.facingYaw_) * alpha;
    this.object.rotation.set(0, yaw, 0);
  }

  private canTurnFreely(): boolean {
    return !this.machine.is(
      'attack',
      'deathblow',
      'hitstun',
      'guardBreak',
      'dead',
      'deflect',
      'blockstun',
    );
  }

  // ------------------------------------------------------------ Combatant
  hurtbox(): Capsule {
    return verticalCapsule(
      this.mover.position,
      playerConfig.capsuleHalfHeight,
      playerConfig.capsuleRadius,
    );
  }

  activeSwing(): ActiveSwing | null {
    const attack = this.context.attack;
    if (!attack || !this.machine.is('attack', 'deathblow')) return null;
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
        center: localToWorld(local, this.mover.position, this.facingYaw_),
        radius: attack.hitboxRadius,
      },
    };
  }

  defense(tick: number, attackerPosition: Vec3): DefenseSnapshot {
    const state = this.machine.current;
    const facingAttacker = isWithinArc(
      this.mover.position,
      this.facingYaw_,
      attackerPosition,
      combatConfig.guardArcDeg,
    );
    const [iFrom, iTo] = combatConfig.dodgeIFrames;
    const invulnerable =
      state === 'dodge' && this.machine.ticksInState >= iFrom && this.machine.ticksInState <= iTo;
    if (!DEFENSIVE_STATES.includes(state)) {
      return { deflect: null, blocking: false, invulnerable, facingAttacker };
    }
    const guard = this.context.guard.evaluate(tick);
    return {
      deflect: guard.deflect,
      blocking: guard.blocking || state !== 'guard',
      invulnerable,
      facingAttacker,
    };
  }

  canBeDeathblowed(): boolean {
    return false;
  }

  onHitReceived(event: CombatEvent): void {
    const context = this.context;
    const { result, direction } = event;
    context.knockback.x = direction.x * result.knockback;
    context.knockback.z = direction.z * result.knockback;
    context.lastStrike = event.attack.strike;

    switch (result.outcome) {
      case 'deflect':
      case 'deflect_perfect':
        context.guard.onDeflectSuccess();
        this.machine.force('deflect', event.tick);
        break;
      case 'block':
        this.machine.force('blockstun', event.tick);
        break;
      case 'guard_break':
        this.machine.force('guardBreak', event.tick);
        break;
      case 'hit':
        this.machine.force(event.defenderDied ? 'dead' : 'hitstun', event.tick);
        break;
      case 'evaded':
        break;
    }
  }

  onAttackResolved(event: CombatEvent): void {
    // Si el enemigo desvia un golpe nuestro, el tajo se corta (no sigue cortando).
    if (event.result.outcome === 'deflect' || event.result.outcome === 'deflect_perfect') {
      this.context.knockback.x = -event.direction.x * combatConfig.knockbackDeflect;
      this.context.knockback.z = -event.direction.z * combatConfig.knockbackDeflect;
    }
  }

  onDeathblowReceived(): void {
    // El jugador no puede ser rematado en M2.
  }

  // ------------------------------------------------------------ utilidades
  teleport(target: { x: number; y: number; z: number }): void {
    this.mover.teleport(target);
    this.context.velocity.x = 0;
    this.context.velocity.y = 0;
    this.context.velocity.z = 0;
    this.context.ground.reset();
    this.machine.force('fall', this.context.tick);
  }

  respawn(): void {
    this.teleport(this.spawn);
  }

  dispose(): void {
    this.mover.dispose();
  }
}
