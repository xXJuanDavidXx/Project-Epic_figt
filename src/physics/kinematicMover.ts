import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from '@/physics/world';
import { RAPIER as Rapier } from '@/physics/world';

export interface MoverOptions {
  capsuleHalfHeight: number;
  capsuleRadius: number;
  skinOffset: number;
  autostepMaxHeight: number;
  autostepMinWidth: number;
  snapToGroundDistance: number;
  maxSlopeClimbAngleDeg: number;
  minSlopeSlideAngleDeg: number;
}

/**
 * Cuerpo cinematico + character controller de Rapier. Lo comparten jugador y enemigos
 * (CLAUDE.md seccion 2: nada de rigidbodies dinamicos para personajes).
 *
 * Mantiene la pose AUTORITATIVA (la de la simulacion) y la anterior, para interpolar.
 */
export class KinematicMover {
  readonly position = new THREE.Vector3();
  readonly previousPosition = new THREE.Vector3();
  readonly collider: RAPIER.Collider;
  grounded = false;

  private readonly body: RAPIER.RigidBody;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly delta = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly physics: PhysicsWorld,
    spawn: THREE.Vector3,
    options: MoverOptions,
  ) {
    this.position.copy(spawn);
    this.previousPosition.copy(spawn);
    const world = physics.world;
    this.body = world.createRigidBody(
      Rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      Rapier.ColliderDesc.capsule(options.capsuleHalfHeight, options.capsuleRadius),
      this.body,
    );
    this.controller = world.createCharacterController(options.skinOffset);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(options.autostepMaxHeight, options.autostepMinWidth, true);
    this.controller.enableSnapToGround(options.snapToGroundDistance);
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(options.maxSlopeClimbAngleDeg));
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(options.minSlopeSlideAngleDeg));
    this.controller.setApplyImpulsesToDynamicBodies(true);
  }

  /** Congela la pose este tick (hitstop): el render no interpola movimiento. */
  hold(): void {
    this.previousPosition.copy(this.position);
  }

  /** Mueve con colisiones. Devuelve el desplazamiento real aplicado. */
  move(dx: number, dy: number, dz: number): { x: number; y: number; z: number } {
    this.delta.x = dx;
    this.delta.y = dy;
    this.delta.z = dz;
    this.controller.computeColliderMovement(this.collider, this.delta);
    const movement = this.controller.computedMovement();
    this.previousPosition.copy(this.position);
    this.position.x += movement.x;
    this.position.y += movement.y;
    this.position.z += movement.z;
    this.body.setNextKinematicTranslation(this.position);
    this.grounded = this.controller.computedGrounded();
    return movement;
  }

  teleport(target: { x: number; y: number; z: number }): void {
    this.position.set(target.x, target.y, target.z);
    this.previousPosition.copy(this.position);
    this.body.setTranslation(this.position, true);
  }

  dispose(): void {
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeCollider(this.collider, false);
    this.physics.world.removeRigidBody(this.body);
  }
}
