import RAPIER from '@dimforge/rapier3d-compat';
import { physicsConfig } from '@/config/physics';
import { FIXED_DELTA } from '@/config/sim';
import type { FixedUpdateSystem } from '@/core/loop';

/**
 * Wrapper de Rapier. Unico punto del proyecto que inicializa el WASM y avanza el
 * mundo fisico, siempre con el timestep fijo de la simulacion.
 */
export class PhysicsWorld implements FixedUpdateSystem {
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;

  private constructor() {
    this.world = new RAPIER.World(physicsConfig.gravity);
    this.world.timestep = FIXED_DELTA;
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  /** Carga el WASM de Rapier y crea el mundo. Llamar una sola vez en el bootstrap. */
  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    return new PhysicsWorld();
  }

  fixedUpdate(): void {
    // La gravedad es tuneable en caliente desde lil-gui.
    this.world.gravity = physicsConfig.gravity;
    this.world.step(this.eventQueue);
  }

  /** Suelo estatico (cuboide fino). Devuelve el collider creado. */
  addStaticBox(
    halfExtents: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
  ): RAPIER.Collider {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
    );
    const desc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    return this.world.createCollider(desc, body);
  }

  /** Cuerpo dinamico de prueba (greybox M0). */
  addDynamicBox(
    halfExtents: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
  ): RAPIER.RigidBody {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z),
    );
    const desc = RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z,
    ).setRestitution(0.2);
    this.world.createCollider(desc, body);
    return body;
  }

  dispose(): void {
    this.eventQueue.free();
    this.world.free();
  }
}

export { RAPIER };
