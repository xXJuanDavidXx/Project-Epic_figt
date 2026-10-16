import * as THREE from 'three';
import type { PhysicsWorld } from '@/physics/world';

/**
 * Nivel greybox de pruebas: suelo, rampas de distinta pendiente, escalones, plataformas
 * y muros para validar la colision de camara. Cada pieza crea malla y collider juntos,
 * para que lo que se ve y con lo que se choca no puedan desincronizarse.
 *
 * En M7 esto se sustituye por geometria real cargada desde .glb.
 */
export interface BoxSpec {
  size: [number, number, number];
  position: [number, number, number];
  /** Rotacion en grados sobre el eje indicado. */
  rotation?: { axis: 'x' | 'y' | 'z'; degrees: number };
  color?: number;
}

const PALETTE = {
  floor: 0x2b313b,
  ramp: 0x3a4250,
  step: 0x434d5c,
  platform: 0x4a5566,
  wall: 0x323944,
};

export function buildGreyboxLevel(scene: THREE.Scene, physics: PhysicsWorld): void {
  const specs: BoxSpec[] = [
    // Suelo principal.
    { size: [60, 1, 60], position: [0, -0.5, 0], color: PALETTE.floor },

    // Rampas: 15°, 30° y 45°. La de 45° no deberia poder subirse (maxSlopeClimbAngle 50°... si).
    ramp([8, 0, -6], 15, PALETTE.ramp),
    ramp([13, 0, -6], 30, PALETTE.ramp),
    ramp([18, 0, -6], 48, PALETTE.ramp),

    // Escalera de escalones de 0.3 m: debe subirse sola por autostep.
    ...stairs([-6, 0, -8], 8, 0.3, 0.9),

    // Plataformas a distinta altura para probar salto y caida.
    { size: [4, 0.5, 4], position: [-14, 1.2, 2], color: PALETTE.platform },
    { size: [4, 0.5, 4], position: [-14, 2.6, 7], color: PALETTE.platform },
    { size: [3, 0.5, 3], position: [-8, 4.0, 10], color: PALETTE.platform },

    // Pasillo estrecho: prueba de colision de camara.
    { size: [0.6, 4, 14], position: [4, 2, 12], color: PALETTE.wall },
    { size: [0.6, 4, 14], position: [8, 2, 12], color: PALETTE.wall },
    { size: [4.6, 0.5, 0.6], position: [6, 4.2, 12], color: PALETTE.wall },

    // Muros perimetrales bajos, para no caerse del mundo sin querer.
    { size: [60, 2, 1], position: [0, 1, -30], color: PALETTE.wall },
    { size: [60, 2, 1], position: [0, 1, 30], color: PALETTE.wall },
    { size: [1, 2, 60], position: [-30, 1, 0], color: PALETTE.wall },
    { size: [1, 2, 60], position: [30, 1, 0], color: PALETTE.wall },
  ];

  for (const spec of specs) {
    addBox(scene, physics, spec);
  }

  const grid = new THREE.GridHelper(60, 60, 0x3f4855, 0x323944);
  grid.position.y = 0.002;
  scene.add(grid);
}

/** Rampa: una caja girada sobre X. */
function ramp(position: [number, number, number], degrees: number, color: number): BoxSpec {
  return {
    size: [4, 0.4, 8],
    position,
    rotation: { axis: 'x', degrees },
    color,
  };
}

/** Escalera de `count` escalones de `rise` metros de alto y `run` de fondo. */
function stairs(
  origin: [number, number, number],
  count: number,
  rise: number,
  run: number,
): BoxSpec[] {
  const steps: BoxSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const height = rise * (i + 1);
    steps.push({
      size: [4, height, run],
      position: [origin[0], origin[1] + height / 2, origin[2] - i * run],
      color: PALETTE.step,
    });
  }
  return steps;
}

function addBox(scene: THREE.Scene, physics: PhysicsWorld, spec: BoxSpec): void {
  const [sx, sy, sz] = spec.size;
  const [px, py, pz] = spec.position;

  const quaternion = new THREE.Quaternion();
  if (spec.rotation) {
    const axis = new THREE.Vector3(
      spec.rotation.axis === 'x' ? 1 : 0,
      spec.rotation.axis === 'y' ? 1 : 0,
      spec.rotation.axis === 'z' ? 1 : 0,
    );
    quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(spec.rotation.degrees));
  }

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color: spec.color ?? PALETTE.floor, roughness: 0.92 }),
  );
  mesh.position.set(px, py, pz);
  mesh.quaternion.copy(quaternion);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  physics.addStaticBox(
    { x: sx / 2, y: sy / 2, z: sz / 2 },
    { x: px, y: py, z: pz },
    { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
  );
}
