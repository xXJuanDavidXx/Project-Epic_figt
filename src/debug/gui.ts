import GUI from 'lil-gui';
import { cameraConfig } from '@/config/camera';
import { inputConfig } from '@/config/input';
import { physicsConfig } from '@/config/physics';
import { playerConfig } from '@/config/player';
import { renderConfig } from '@/config/render';
import { simConfig } from '@/config/sim';
import { events } from '@/core/eventMap';
import type { GameLoop } from '@/core/loop';
import type { SceneView } from '@/render/scene';

/**
 * Panel de tuning. Regla 4 de CLAUDE.md: todo numero de gameplay se expone aqui.
 * Solo se monta en dev; en produccion esta funcion no se importa siquiera.
 */
export function createDebugGui(loop: GameLoop, view: SceneView): GUI {
  const gui = new GUI({ title: 'Debug — epic_fights' });
  gui.close();

  const time = gui.addFolder('Tiempo').close();
  const timeScaleControl = time
    .add(simConfig, 'timeScale', 0, 2, 0.05)
    .name('timeScale')
    .onChange((value: number) => {
      events.emit('debug:timeScale', { tick: loop.clock.tick, timeScale: value });
    });
  const setTimeScale = (value: number): void => {
    simConfig.timeScale = value;
    timeScaleControl.updateDisplay();
    events.emit('debug:timeScale', { tick: loop.clock.tick, timeScale: value });
  };
  time.add({ normal: () => setTimeScale(1) }, 'normal').name('1.00x');
  time.add({ slow: () => setTimeScale(0.25) }, 'slow').name('0.25x');
  time.add({ slower: () => setTimeScale(0.1) }, 'slower').name('0.10x');
  time.add({ freeze: () => setTimeScale(0) }, 'freeze').name('congelar');
  time.add({ step: () => loop.stepOnce() }, 'step').name('avanzar 1 tick');
  time.add(simConfig, 'maxSubSteps', 1, 10, 1).name('max sub-steps');

  const player = gui.addFolder('Jugador');
  player.add(playerConfig, 'walkSpeed', 1, 12, 0.1).name('velocidad');
  player.add(playerConfig, 'sprintSpeed', 1, 16, 0.1).name('sprint');
  player.add(playerConfig, 'groundAccel', 10, 200, 1).name('aceleracion');
  player.add(playerConfig, 'groundDecel', 10, 200, 1).name('frenada');
  player.add(playerConfig, 'airControl', 0, 1, 0.05).name('control aereo');
  player.add(playerConfig, 'turnSpeed', 2, 40, 0.5).name('giro (rad/s)');
  player.add(playerConfig, 'jumpHeight', 0.5, 4, 0.1).name('altura de salto');
  player.add(playerConfig, 'fallGravityMultiplier', 1, 3, 0.05).name('gravedad al caer');
  player.add(playerConfig, 'lowJumpGravityMultiplier', 1, 4, 0.05).name('salto corto');
  player.add(playerConfig, 'coyoteTicks', 0, 15, 1).name('coyote (ticks)');
  player.add(inputConfig, 'bufferTicks', 0, 20, 1).name('input buffer (ticks)');

  const dodge = gui.addFolder('Esquiva').close();
  dodge.add(playerConfig, 'dodgeSpeed', 4, 25, 0.5).name('velocidad');
  dodge.add(playerConfig, 'dodgeTicks', 4, 40, 1).name('duracion (ticks)');
  dodge.add(playerConfig, 'dodgeRecoveryTicks', 0, 40, 1).name('recuperacion (ticks)');

  const camera = gui.addFolder('Camara');
  camera.add(cameraConfig, 'distance', 1.5, 12, 0.1).name('distancia');
  camera.add(cameraConfig, 'pivotHeight', 0.5, 3, 0.05).name('altura del pivote');
  camera.add(cameraConfig, 'shoulderOffset', -1.5, 1.5, 0.05).name('hombro');
  camera.add(cameraConfig, 'mouseSensitivity', 0.0005, 0.01, 0.0001).name('sensibilidad raton');
  camera.add(cameraConfig, 'stickSensitivity', 0.5, 8, 0.1).name('sensibilidad stick');
  camera.add(cameraConfig, 'invertY').name('invertir Y');
  camera.add(cameraConfig, 'collisionRadius', 0.05, 1, 0.05).name('radio de colision');
  camera.add(cameraConfig, 'followSmoothing', 1, 60, 1).name('suavizado vertical');

  const physics = gui.addFolder('Fisica').close();
  physics.add(physicsConfig.gravity, 'y', -60, 0, 1).name('gravedad Y');
  physics.add(physicsConfig, 'debugWireframe').name('wireframe colliders');

  const render = gui.addFolder('Render').close();
  render
    .add(renderConfig, 'fov', 30, 100, 1)
    .name('FOV')
    .onChange(() => {
      view.camera.fov = renderConfig.fov;
      view.camera.updateProjectionMatrix();
    });
  render
    .add(renderConfig, 'maxPixelRatio', 0.5, 3, 0.25)
    .name('max pixel ratio')
    .onChange(() => {
      view.resize();
    });

  return gui;
}
