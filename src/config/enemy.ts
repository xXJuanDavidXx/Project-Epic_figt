import { playerConfig } from '@/config/player';

/** Tuning del duelista de prueba (M2). Tiempos en ticks, distancias en metros. */
export interface EnemyConfig {
  maxVitality: number;
  maxPosture: number;
  walkSpeed: number;
  /** Distancia a la que empieza a atacar. */
  attackRange: number;
  /** Distancia a la que deja de acercarse. */
  keepDistance: number;
  /** Mas lejos que esto, ignora al jugador. */
  aggroRange: number;
  turnSpeed: number;
  /** Ticks antes del impacto en que brilla la hoja (aviso de lectura). */
  telegraphLeadTicks: number;
  /** Multiplicador de las pausas entre pasos del patron (mas bajo = mas agresivo). */
  pauseScale: number;
  /** Tras bloquear tantos golpes seguidos, contraataca sin esperar a la pausa. */
  counterAfterBlocks: number;
  capsuleRadius: number;
  capsuleHalfHeight: number;
}

export const enemyConfig: EnemyConfig = {
  maxVitality: 100,
  maxPosture: 100,
  walkSpeed: 2.1,
  attackRange: 2.5,
  keepDistance: 1.7,
  aggroRange: 14,
  turnSpeed: 5.5,
  telegraphLeadTicks: 12,
  pauseScale: 1,
  counterAfterBlocks: 2,
  capsuleRadius: playerConfig.capsuleRadius,
  capsuleHalfHeight: playerConfig.capsuleHalfHeight,
};
