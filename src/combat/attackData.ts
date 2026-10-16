import type { AttackDef } from '@/combat/types';

/**
 * Catalogo de ataques. Coordenadas de hitbox en espacio local del atacante:
 * adelante = -Z, derecha = +X, y relativo al CENTRO de la capsula (~0.9 m sobre los pies).
 *
 * Regla de legibilidad (pilar 3): el startup de un enemigo nunca baja de ~14 ticks y los
 * golpes "de remate" de un combo tienen el wind-up mas largo. Documentado en COMBAT_TUNING.md.
 */

// ---------------------------------------------------------------- jugador
export const PLAYER_ATTACKS = {
  atk_1: {
    id: 'atk_1',
    startupTicks: 7,
    activeTicks: 4,
    recoveryTicks: 16,
    vitalityDmg: 12,
    postureDmg: 14,
    kind: 'normal',
    strike: 'from_right',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.45,
    hitboxFrom: { x: 0.9, y: 0.45, z: -0.5 },
    hitboxTo: { x: -0.9, y: 0.3, z: -0.9 },
    cancelWindow: [11, 27],
    lunge: 0.45,
  },
  atk_2: {
    id: 'atk_2',
    startupTicks: 7,
    activeTicks: 4,
    recoveryTicks: 16,
    vitalityDmg: 12,
    postureDmg: 14,
    kind: 'normal',
    strike: 'from_left',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.45,
    hitboxFrom: { x: -0.9, y: 0.0, z: -0.6 },
    hitboxTo: { x: 0.8, y: 0.6, z: -0.9 },
    cancelWindow: [11, 27],
    lunge: 0.45,
  },
  atk_3: {
    id: 'atk_3',
    startupTicks: 12,
    activeTicks: 4,
    recoveryTicks: 24,
    vitalityDmg: 18,
    postureDmg: 22,
    kind: 'normal',
    strike: 'overhead',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.5,
    hitboxFrom: { x: 0.1, y: 1.1, z: -0.7 },
    hitboxTo: { x: 0.0, y: -0.2, z: -1.2 },
    cancelWindow: [16, 40],
    lunge: 0.85,
  },
  deathblow: {
    id: 'deathblow',
    startupTicks: 14,
    activeTicks: 3,
    recoveryTicks: 40,
    vitalityDmg: 0,
    postureDmg: 0,
    kind: 'normal',
    strike: 'thrust',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.4,
    hitboxFrom: { x: 0, y: 0.4, z: -0.6 },
    hitboxTo: { x: 0, y: 0.4, z: -1.3 },
    lunge: 0.6,
  },
} as const satisfies Record<string, AttackDef>;

export type PlayerAttackId = keyof typeof PLAYER_ATTACKS;

/** Orden del combo ligero (CLAUDE.md 5.4). */
export const PLAYER_COMBO: readonly PlayerAttackId[] = ['atk_1', 'atk_2', 'atk_3'];

// ---------------------------------------------------------------- dummy
export const DUMMY_ATTACKS = {
  /** Tajo horizontal de derecha a izquierda. El ataque basico: se aprende en 3 intentos. */
  e_slash: {
    id: 'e_slash',
    startupTicks: 26,
    activeTicks: 5,
    recoveryTicks: 26,
    vitalityDmg: 20,
    postureDmg: 22,
    kind: 'normal',
    strike: 'from_right',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.55,
    hitboxFrom: { x: 1.3, y: 0.5, z: -0.6 },
    hitboxTo: { x: -1.3, y: 0.4, z: -1.2 },
    lunge: 0.6,
  },
  /** Corte ascendente rapido de izquierda a derecha: segundo golpe de los combos. */
  e_rising: {
    id: 'e_rising',
    startupTicks: 15,
    activeTicks: 5,
    recoveryTicks: 28,
    vitalityDmg: 18,
    postureDmg: 20,
    kind: 'normal',
    strike: 'from_left',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.55,
    hitboxFrom: { x: -1.2, y: -0.1, z: -0.8 },
    hitboxTo: { x: 1.1, y: 0.9, z: -1.1 },
    lunge: 0.5,
  },
  /** Tajo vertical. Wind-up largo y visible: el golpe que mas postura quita al desviarlo. */
  e_overhead: {
    id: 'e_overhead',
    startupTicks: 32,
    activeTicks: 4,
    recoveryTicks: 30,
    vitalityDmg: 26,
    postureDmg: 30,
    kind: 'normal',
    strike: 'overhead',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.55,
    hitboxFrom: { x: 0.1, y: 1.3, z: -0.9 },
    hitboxTo: { x: 0.0, y: -0.1, z: -1.6 },
    lunge: 0.9,
  },
  /** Mismo tajo vertical con el arma en alto mas tiempo: castiga el deflect impaciente. */
  e_overhead_delayed: {
    id: 'e_overhead_delayed',
    startupTicks: 50,
    activeTicks: 4,
    recoveryTicks: 30,
    vitalityDmg: 26,
    postureDmg: 30,
    kind: 'normal',
    strike: 'overhead',
    hitboxBone: 'weapon_r',
    hitboxRadius: 0.55,
    hitboxFrom: { x: 0.1, y: 1.3, z: -0.9 },
    hitboxTo: { x: 0.0, y: -0.1, z: -1.6 },
    lunge: 0.9,
  },
} as const satisfies Record<string, AttackDef>;

export type DummyAttackId = keyof typeof DUMMY_ATTACKS;

/** Fase de un ataque en un tick dado desde su inicio. */
export type AttackPhase = 'startup' | 'active' | 'recovery' | 'done';

export function attackPhase(attack: AttackDef, ticksSinceStart: number): AttackPhase {
  if (ticksSinceStart < attack.startupTicks) return 'startup';
  if (ticksSinceStart < attack.startupTicks + attack.activeTicks) return 'active';
  if (ticksSinceStart < totalTicks(attack)) return 'recovery';
  return 'done';
}

export function totalTicks(attack: AttackDef): number {
  return attack.startupTicks + attack.activeTicks + attack.recoveryTicks;
}

/** Progreso [0, 1] dentro de los ticks activos (para mover la hitbox a lo largo del arco). */
export function activeProgress(attack: AttackDef, ticksSinceStart: number): number {
  const t = (ticksSinceStart - attack.startupTicks) / Math.max(attack.activeTicks - 1, 1);
  return Math.min(Math.max(t, 0), 1);
}

export function inCancelWindow(attack: AttackDef, ticksSinceStart: number): boolean {
  if (!attack.cancelWindow) return false;
  const [from, to] = attack.cancelWindow;
  return ticksSinceStart >= from && ticksSinceStart <= to;
}
