export interface PhysicsConfig {
  /** Gravedad en m/s^2. Se aplica al mundo de Rapier. */
  gravity: { x: number; y: number; z: number };
  /** Dibujar wireframe de colliders (solo dev). */
  debugWireframe: boolean;
}

export const physicsConfig: PhysicsConfig = {
  gravity: { x: 0, y: -24, z: 0 },
  debugWireframe: false,
};
