import { EventBus } from '@/core/events';

/**
 * Eventos del juego. Cada milestone añade los suyos aqui; el payload siempre lleva
 * el `tick` en el que ocurrio para que el log de debug sea exacto (CLAUDE.md seccion 10).
 */
export interface GameEventMap {
  'sim:reset': { tick: number };
  'debug:timeScale': { tick: number; timeScale: number };
  // M2 añadira: 'combat:hit' | 'combat:block' | 'combat:deflect' | 'combat:postureBreak'
}

/** Bus global del juego. Instancia unica por sesion. */
export const events = new EventBus<GameEventMap>();
