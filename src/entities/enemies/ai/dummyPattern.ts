import type { DummyAttackId } from '@/combat/attackData';

/**
 * Patron fijo del duelista (M2): se repite en bucle para poder APRENDERLO.
 * Cada paso es un combo; la pausa posterior es la ventana para contraatacar.
 * Documentado en docs/COMBAT_TUNING.md.
 */
export interface PatternStep {
  attacks: readonly DummyAttackId[];
  pauseAfter: number;
}

export const DUMMY_PATTERN: readonly PatternStep[] = [
  { attacks: ['e_slash'], pauseAfter: 55 },
  { attacks: ['e_slash', 'e_rising'], pauseAfter: 65 },
  { attacks: ['e_overhead_delayed'], pauseAfter: 55 },
  { attacks: ['e_slash', 'e_rising', 'e_overhead'], pauseAfter: 85 },
];
