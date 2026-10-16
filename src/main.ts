import * as THREE from 'three';
import { GameLoop } from '@/core/loop';
import { PhysicsWorld } from '@/physics/world';
import { InterpolatedBody } from '@/physics/bodySync';
import { SceneView, addGreyboxGround, addGreyboxLighting } from '@/render/scene';
import { DebugStats } from '@/debug/stats';
import { PhysicsDebugView } from '@/debug/physicsDebugView';

/**
 * Bootstrap. Orden fijo: fisica -> render -> sistemas -> loop.
 * Los sistemas se registran en el orden en que deben correr.
 */
async function bootstrap(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#viewport');
  if (!canvas) throw new Error('No se encontro el canvas #viewport.');

  const physics = await PhysicsWorld.create();
  const view = new SceneView(canvas);
  addGreyboxLighting(view.scene);
  addGreyboxGround(view.scene, 60);

  const loop = new GameLoop();

  // 1. Fisica (simulacion).
  loop.add(physics);

  // --- Greybox M0: suelo fisico + cubo dinamico que cae. Se reemplaza en M1. ---
  physics.addStaticBox({ x: 30, y: 0.25, z: 30 }, { x: 0, y: -0.25, z: 0 });

  const cubeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xc8503c, roughness: 0.5, metalness: 0.1 }),
  );
  cubeMesh.castShadow = true;
  view.scene.add(cubeMesh);

  const cubeBody = physics.addDynamicBox({ x: 0.5, y: 0.5, z: 0.5 }, { x: 0, y: 6, z: 0 });
  cubeBody.setAngvel({ x: 1.2, y: 2.4, z: 0.6 }, true);
  loop.add(new InterpolatedBody(cubeBody, cubeMesh));
  // --- fin greybox M0 ---

  // 2. Render (al final, cuando todas las poses ya estan interpoladas).
  loop.add(view);

  if (import.meta.env.DEV) {
    loop.add(new PhysicsDebugView(physics, view.scene));
    loop.add(new DebugStats(loop));
    const { createDebugGui } = await import('@/debug/gui');
    createDebugGui(loop, view);
  }

  loop.start();
}

void bootstrap().catch((error: unknown) => {
  console.error('[bootstrap] fallo al arrancar:', error);
});
