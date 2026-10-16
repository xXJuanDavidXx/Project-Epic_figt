import * as THREE from 'three';
import { GameLoop } from '@/core/loop';
import { InputManager } from '@/core/input';
import { events } from '@/core/eventMap';
import { PhysicsWorld } from '@/physics/world';
import { SceneView, addGreyboxLighting } from '@/render/scene';
import { buildGreyboxLevel } from '@/world/greyboxLevel';
import { CameraRig } from '@/camera/CameraRig';
import { ThirdPersonCamera } from '@/camera/ThirdPersonCamera';
import { CombatSystem } from '@/combat/CombatSystem';
import { PlayerController } from '@/entities/player/PlayerController';
import { PlayerView } from '@/entities/player/PlayerView';
import { EnemyDuelist } from '@/entities/enemies/EnemyDuelist';
import { EnemyView } from '@/entities/enemies/EnemyView';
import { CombatFeedback } from '@/render/vfx/CombatFeedback';
import { SfxSynth } from '@/audio/sfx';
import { CombatAudio } from '@/audio/CombatAudio';
import { Hud } from '@/ui/hud';
import { DebugStats } from '@/debug/stats';
import { PhysicsDebugView } from '@/debug/physicsDebugView';
import { FIXED_DELTA } from '@/config/sim';

/**
 * Bootstrap.
 *
 * El ORDEN de registro de sistemas es parte del diseño:
 *   simulacion: input -> camara (yaw) -> jugador -> enemigos -> COMBATE -> vistas -> fisica
 *   render:     entidades (interpolan) -> vistas (poses) -> camara -> debug -> escena
 *
 * El combate se resuelve despues de mover a todos y ANTES de que las vistas avancen la
 * animacion: asi el corte a la pose de deflect cae en el mismo tick del choque.
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
  const combat = new CombatSystem(events);

  // --- jugador ---
  const spawn = new THREE.Vector3(0, 1, 6);
  const playerObject = new THREE.Group();
  playerObject.name = 'player';
  view.scene.add(playerObject);
  const player = new PlayerController(physics, input, rig, spawn, playerObject, FIXED_DELTA);
  const playerView = new PlayerView(player, playerObject);
  combat.add(player);

  // --- duelista de prueba, de cara al jugador ---
  const enemyObject = new THREE.Group();
  enemyObject.name = 'duelist';
  view.scene.add(enemyObject);
  const enemy = new EnemyDuelist(
    'duelist',
    physics,
    new THREE.Vector3(0, 1, 1.5),
    Math.PI,
    enemyObject,
    events,
    FIXED_DELTA,
  );
  const enemyView = new EnemyView(enemy, enemyObject);
  enemy.target = player;
  combat.add(enemy);
  player.targetProvider = (self, range) => combat.nearestOpponent(self, range);

  const camera = new ThirdPersonCamera(
    view.camera,
    rig,
    playerObject,
    physics,
    player.characterCollider,
  );
  player.bus = events;

  // --- presentacion del combate: chispas, luz, sacudida, sonido, HUD ---
  const feedback = new CombatFeedback(view.scene, view.camera, camera, events);
  feedback.register(player.id, playerView.rig);
  feedback.register(enemy.id, enemyView.rig);
  const sfx = new SfxSynth();
  new CombatAudio(sfx, view.camera, events);
  // El audio del navegador solo arranca tras un gesto del usuario.
  const unlockAudio = (): void => sfx.unlock();
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  const hud = new Hud(view.camera, player, enemy, events);

  // --- simulacion (orden estricto) ---
  loop.add(input);
  loop.add(rig);
  loop.add(player);
  loop.add(enemy);
  loop.add(combat);
  loop.add(playerView);
  loop.add(enemyView);
  loop.add(physics);

  // Red de seguridad: si se cae del mundo, vuelve al punto de aparicion.
  loop.add({
    fixedUpdate: () => {
      if (player.worldPosition.y < -20) player.respawn();
    },
  });

  // --- render (orden: poses -> camara -> efectos -> HUD -> dibujo) ---
  loop.add(camera);
  loop.add(feedback);
  loop.add(hud);

  if (import.meta.env.DEV) {
    loop.add(new PhysicsDebugView(physics, view.scene));
    loop.add(new DebugStats(loop, player));
    const [{ createDebugGui }, { exposeDevHandle }, { CombatLog }, { HitboxView }] =
      await Promise.all([
        import('@/debug/gui'),
        import('@/debug/devHandle'),
        import('@/debug/combatLog'),
        import('@/debug/hitboxView'),
      ]);
    loop.add(new CombatLog(events));
    loop.add(new HitboxView(view.scene, () => combat.all));
    createDebugGui(loop, view, camera);
    exposeDevHandle({
      loop,
      input,
      rig,
      player,
      playerView,
      physics,
      view,
      enemy,
      enemyView,
      combat,
    });
  }

  loop.add(view);
  loop.start();
}

void bootstrap().catch((error: unknown) => {
  console.error('[bootstrap] fallo al arrancar:', error);
});
