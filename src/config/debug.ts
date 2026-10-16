/** Herramientas de debug (CLAUDE.md seccion 10). Solo dev. */
export interface DebugConfig {
  showStats: boolean;
  showHitboxes: boolean;
  showCombatLog: boolean;
}

export const debugConfig: DebugConfig = {
  showStats: true,
  showHitboxes: false,
  showCombatLog: true,
};
