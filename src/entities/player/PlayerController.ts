import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { playerConfig, playerCapsuleHeight } from '@/config/player';
import type { InputState } from '@/core/input';
import { StateMachine } from '@/core/fsm';
import type { FixedUpdateSystem, FrameContext, RenderUpdateSystem, TickContext } from '@/core/loop';
import type { PhysicsWorld } from '@/physics/world';
import { RAPIER as Rapier } from '@/physics/world';
import type { CameraRig } from '@/camera/CameraRig';
import {
  cameraRelativeDirection,
  rotateTowards,
  shortestAngleDelta,
  yawFromDirection,
} from '@/entities/player/locomotion';
import type { PlayerContext, PlayerStateId } from '@/entities/player/playerStates';
import { createPlayerContext, createPlayerStates } from '@/entities/player/playerStates';

/**
 * Jugador: character controller CINEMATICO de Rapier (nunca un rigidbody dinamico,
 * CLAUDE.md seccion 2) + maquina de estados.
 *
 * Orden dentro del tick: el controller calcula la pose objetivo ANTES de que el mundo
 * haga step, y mantiene el la pose autoritativa para interpolar el render.
 */
export class PlayerController implements FixedUpdateSystem, RenderUpdateSystem {
  readonly object: THREE.Object3D;
  readonly machine: StateMachine<PlayerContext, PlayerStateId>;
  readonly context: PlayerContext;

  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;

  private readonly position = new THREE.Vector3();
  private readonly prevPosition = new THREE.Vector3();
  private yaw = 0;
  private prevYaw = 0;
  private readonly desiredTranslation = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly input: InputState,
    private readonly rig: CameraRig,
    spawn: THREE.Vector3,
    object: THREE.Object3D,
    dt: number,
  ) {
    this.object = object;
    this.position.copy(spawn);
    this.prevPosition.copy(spawn);

    const world = physics.world;
    this.body = world.createRigidBody(
      Rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      Rapier.ColliderDesc.capsule(playerConfig.capsuleHalfHeight, playerConfig.capsuleRadius),
      this.body,
    );

    this.controller = world.createCharacterController(playerConfig.skinOffset);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(
      playerConfig.autostepMaxHeight,
      playerConfig.autostepMinWidth,
      true,
    );
    this.controller.enableSnapToGround(playerConfig.snapToGroundDistance);
    this.controller.setMaxSlopeClimbAngle(
      THREE.MathUtils.degToRad(playerConfig.maxSlopeClimbAngleDeg),
    );
    this.controller.setMinSlopeSlideAngle(
      THREE.MathUtils.degToRad(playerConfig.minSlopeSlideAngleDeg),
    );
    this.controller.setApplyImpulsesToDynamicBodies(true);

    this.context = createPlayerContext(playerConfig, input, physics.world.gravity.y, dt);
    this.machine = new StateMachine<PlayerContext, PlayerStateId>(
      createPlayerStates(),
      'idle',
      this.context,
    );
    this.context.machine = this.machine;
  }

  /** Collider de la capsula: la camara lo ignora al buscar obstaculos. */
  get characterCollider(): RAPIER.Collider {
    return this.collider;
  }

  /** Centro de la capsula en el mundo (pies + media altura). */
  get worldPosition(): THREE.Vector3 {
    return this.position;
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

  fixedUpdate(ctx: TickContext): void {
    const config = playerConfig;
    const context = this.context;
    context.tick = ctx.tick;
    context.dt = ctx.dt;
    context.gravity = this.physics.world.gravity.y;
    context.suppressGravity = false;
    if (context.dodgeCooldown > 0) context.dodgeCooldown -= 1;

    // 1. Input -> direccion del mundo relativa a la camara.
    const direction = cameraRelativeDirection(this.input.moveX, this.input.moveY, this.rig.yaw);
    context.desiredDirection = direction;
    context.moveMagnitude = this.input.moveMagnitude;

    // 2. Memoria de suelo (coyote time) y FSM.
    context.ground.update(context.grounded);
    this.machine.update(ctx.tick);

    // 3. Gravedad, con caida mas rapida que subida y salto variable.
    if (!context.suppressGravity) {
      const rising = context.velocity.y > 0;
      const holdingJump = this.input.held('jump');
      let multiplier = 1;
      if (!rising) multiplier = config.fallGravityMultiplier;
      else if (!holdingJump) multiplier = config.lowJumpGravityMultiplier;
      context.velocity.y += context.gravity * multiplier * ctx.dt;
      context.velocity.y = Math.max(context.velocity.y, -config.maxFallSpeed);
    }
    if (context.grounded && context.velocity.y < 0) {
      // Pequeña velocidad hacia abajo: mantiene el contacto en rampas y escalones.
      context.velocity.y = -2;
    }

    // 4. Movimiento resuelto por el character controller (deslizamiento, escalones, pendientes).
    this.desiredTranslation.x = context.velocity.x * ctx.dt;
    this.desiredTranslation.y = context.velocity.y * ctx.dt;
    this.desiredTranslation.z = context.velocity.z * ctx.dt;
    this.controller.computeColliderMovement(this.collider, this.desiredTranslation);
    const movement = this.controller.computedMovement();

    this.prevPosition.copy(this.position);
    this.position.x += movement.x;
    this.position.y += movement.y;
    this.position.z += movement.z;
    this.body.setNextKinematicTranslation(this.position);

    const grounded = this.controller.computedGrounded();
    // Si choca con el techo, corta el impulso de subida.
    if (!grounded && context.velocity.y > 0 && movement.y < this.desiredTranslation.y * 0.5) {
      context.velocity.y = 0;
    }
    context.grounded = grounded;

    // 5. Orientacion: el personaje mira hacia donde se mueve.
    this.prevYaw = this.yaw;
    if (direction.x !== 0 || direction.z !== 0) {
      this.yaw = rotateTowards(this.yaw, yawFromDirection(direction), config.turnSpeed * ctx.dt);
    }
  }

  renderUpdate(ctx: FrameContext): void {
    this.object.position.lerpVectors(this.prevPosition, this.position, ctx.alpha);
    const yaw = this.prevYaw + shortestAngleDelta(this.prevYaw, this.yaw) * ctx.alpha;
    this.object.rotation.set(0, yaw, 0);
  }

  /** Teletransporta al jugador (checkpoints, caida al vacio). */
  teleport(target: THREE.Vector3): void {
    this.position.copy(target);
    this.prevPosition.copy(target);
    this.body.setTranslation(target, true);
    this.context.velocity.x = 0;
    this.context.velocity.y = 0;
    this.context.velocity.z = 0;
    this.context.ground.reset();
    this.machine.force('fall', this.context.tick);
  }

  dispose(): void {
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeCollider(this.collider, false);
    this.physics.world.removeRigidBody(this.body);
  }
}

/** Malla greybox del jugador: capsula + marca de frente para leer la orientacion. */
export function createPlayerGreyboxMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const height = playerCapsuleHeight();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(
      playerConfig.capsuleRadius,
      playerConfig.capsuleHalfHeight * 2,
      6,
      16,
    ),
    new THREE.MeshStandardMaterial({ color: 0xd8dde8, roughness: 0.6 }),
  );
  body.castShadow = true;
  group.add(body);

  // Marca de frente (-Z): sin ella es imposible saber hacia donde mira una capsula.
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xc8503c, roughness: 0.5 }),
  );
  nose.position.set(0, height * 0.18, -playerConfig.capsuleRadius - 0.18);
  nose.castShadow = true;
  group.add(nose);

  return group;
}
