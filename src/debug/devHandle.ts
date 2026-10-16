import type { GameLoop } from '@/core/loop';
import { cameraConfig } from '@/config/camera';
import { combatConfig } from '@/config/combat';
import { playerConfig } from '@/config/player';
import { simConfig } from '@/config/sim';
import type { InputManager } from '@/core/input';
import type { CameraRig } from '@/camera/CameraRig';
import type { PhysicsWorld } from '@/physics/world';
import type { PlayerController } from '@/entities/player/PlayerController';
import type { SceneView } from '@/render/scene';
import type { PlayerView } from '@/entities/player/PlayerView';
import type { EnemyDuelist } from '@/entities/enemies/EnemyDuelist';
import type { EnemyView } from '@/entities/enemies/EnemyView';
import type { CombatSystem } from '@/combat/CombatSystem';

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
  playerView: PlayerView;
  physics: PhysicsWorld;
  view: SceneView;
  enemy: EnemyDuelist;
  enemyView: EnemyView;
  combat: CombatSystem;
  config?: typeof devConfigs;
  events?: typeof events;
}

import { events } from '@/core/eventMap';

export const devConfigs = {
  camera: cameraConfig,
  combat: combatConfig,
  player: playerConfig,
  sim: simConfig,
};

declare global {
  interface Window {
    __game?: DevHandle;
  }
}

export function exposeDevHandle(handle: DevHandle): void {
  window.__game = { ...handle, config: devConfigs, events };
}
