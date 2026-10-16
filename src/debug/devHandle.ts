import type { GameLoop } from '@/core/loop';
import type { InputManager } from '@/core/input';
import type { CameraRig } from '@/camera/CameraRig';
import type { PhysicsWorld } from '@/physics/world';
import type { PlayerController } from '@/entities/player/PlayerController';
import type { SceneView } from '@/render/scene';

/**
 * Handle de depuracion expuesto en `window.__game` SOLO en dev. Permite inspeccionar y
 * dirigir la simulacion desde la consola del navegador (o desde un test de integracion
 * manejado por DevTools) sin tocar el codigo de juego.
 */
export interface DevHandle {
  loop: GameLoop;
  input: InputManager;
  rig: CameraRig;
  player: PlayerController;
  physics: PhysicsWorld;
  view: SceneView;
}

declare global {
  interface Window {
    __game?: DevHandle;
  }
}

export function exposeDevHandle(handle: DevHandle): void {
  window.__game = handle;
}
