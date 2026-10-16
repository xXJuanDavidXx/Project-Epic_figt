import * as THREE from 'three';
import { GameLoop } from '@/core/loop';
import { InputManager } from '@/core/input';
import { PhysicsWorld } from '@/physics/world';
import { SceneView, addGreyboxLighting } from '@/render/scene';
import { buildGreyboxLevel } from '@/world/greyboxLevel';
import { CameraRig } from '@/camera/CameraRig';
import { ThirdPersonCamera } from '@/camera/ThirdPersonCamera';
import { PlayerController, createPlayerGreyboxMesh } from '@/entities/player/PlayerController';
import { DebugStats } from '@/debug/stats';
import { PhysicsDebugView } from '@/debug/physicsDebugView';
import { FIXED_DELTA } from '@/config/sim';

/**
 * Bootstrap.
 *
 * El ORDEN de registro de sistemas es parte del diseño:
 *   simulacion: input -> camara (yaw) -> jugador (mueve) -> fisica (step)
 *   render:     jugador (interpola) -> camara (coloca) -> debug -> escena (dibuja)
 */
async function bootstrap(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#viewport');
  if (!canvas) throw new Error('No se encontro el canvas #viewport.');

  const physics = await PhysicsWorld.create();
  const view = new SceneView(canvas);
  addGreyboxLighting(view.scene);
  buildGreyboxLevel(view.scene, physics);

  const loop = new GameLoop();
  const input = new InputManager(canvas);
  const rig = new CameraRig(input);

  const playerMesh = createPlayerGreyboxMesh();
  view.scene.add(playerMesh);
  const player = new PlayerController(
    physics,
    input,
    rig,
    new THREE.Vector3(0, 2, 6),
    playerMesh,
    FIXED_DELTA,
  );
  const camera = new ThirdPersonCamera(
    view.camera,
    rig,
    playerMesh,
    physics,
    player.characterCollider,
  );

  // --- simulacion (orden estricto) ---
  loop.add(input);
  loop.add(rig);
  loop.add(player);
  loop.add(physics);

  // Red de seguridad: si se cae del mundo, vuelve al punto de aparicion.
  const spawn = new THREE.Vector3(0, 2, 6);
  loop.add({
    fixedUpdate: () => {
      if (player.worldPosition.y < -20) player.teleport(spawn);
    },
  });

  // --- render ---
  loop.add(camera);

  if (import.meta.env.DEV) {
    loop.add(new PhysicsDebugView(physics, view.scene));
    loop.add(new DebugStats(loop, player));
    const [{ createDebugGui }, { exposeDevHandle }] = await Promise.all([
      import('@/debug/gui'),
      import('@/debug/devHandle'),
    ]);
    createDebugGui(loop, view);
    exposeDevHandle({ loop, input, rig, player, physics, view });
  }

  loop.add(view);
  loop.start();
}

void bootstrap().catch((error: unknown) => {
  console.error('[bootstrap] fallo al arrancar:', error);
});
