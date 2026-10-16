import GUI from 'lil-gui';
import { physicsConfig } from '@/config/physics';
import { renderConfig } from '@/config/render';
import { simConfig } from '@/config/sim';
import { events } from '@/core/eventMap';
import type { GameLoop } from '@/core/loop';
import type { SceneView } from '@/render/scene';

/**
 * Panel de tuning. Regla 4 de CLAUDE.md: todo numero de gameplay se expone aqui.
 * Solo se monta en dev; en produccion esta funcion no se llama.
 */
export function createDebugGui(loop: GameLoop, view: SceneView): GUI {
  const gui = new GUI({ title: 'Debug — Filo de Ceniza' });

  const time = gui.addFolder('Tiempo');
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

  const physics = gui.addFolder('Fisica');
  physics.add(physicsConfig.gravity, 'y', -60, 0, 1).name('gravedad Y');
  physics.add(physicsConfig, 'debugWireframe').name('wireframe colliders');

  const render = gui.addFolder('Render');
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
