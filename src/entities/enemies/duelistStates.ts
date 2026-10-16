import type { CombatConfig } from '@/config/combat';
import type { EnemyConfig } from '@/config/enemy';
import type { State, StateMachine } from '@/core/fsm';
import { DUMMY_ATTACKS, attackPhase } from '@/combat/attackData';
import { Posture } from '@/combat/posture';
import { Vitality } from '@/combat/vitality';
import type { AttackDef } from '@/combat/types';
import type { PatternStep } from '@/entities/enemies/ai/dummyPattern';

/**
 * FSM del duelista. PURA: decide que hace; el controller lo aplica al mundo.
 */
export type DuelistStateId =
  'idle' | 'approach' | 'attack' | 'recoil' | 'blockstun' | 'hitstun' | 'broken' | 'dying' | 'dead';

export interface DuelistCallbacks {
  onSwingStart(attack: AttackDef, tick: number): void;
  onTelegraph(attack: AttackDef, tick: number, ticksToImpact: number): void;
  onRespawn(tick: number): void;
}

export interface DuelistContext {
  readonly config: EnemyConfig;
  readonly combat: CombatConfig;
  readonly pattern: readonly PatternStep[];
  readonly posture: Posture;
  readonly vitality: Vitality;
  readonly callbacks: DuelistCallbacks;
  machine: StateMachine<DuelistContext, DuelistStateId> | null;

  tick: number;
  dt: number;
  position: { x: number; y: number; z: number };
  facing: number;
  /** Jugador (o null si no hay objetivo). */
  target: { x: number; y: number; z: number } | null;
  targetDistance: number;

  patternIndex: number;
  stepAttackIndex: number;
  attack: AttackDef | null;
  attackTicks: number;
  swingId: number;
  telegraphed: boolean;
  pauseTicks: number;
  blocksInARow: number;
  /** Ultimo resultado de un ataque propio desviado (para elegir animacion). */
  deflectedCount: number;

  velocity: { x: number; z: number };
  /** Misma velocidad en 3D (para la animacion secundaria). */
  readonly velocity3: { x: number; y: number; z: number };
  knockback: { x: number; z: number };
  faceTarget: boolean;
  reactionTicks: number;
}

export function createDuelistContext(
  config: EnemyConfig,
  combat: CombatConfig,
  pattern: readonly PatternStep[],
  callbacks: DuelistCallbacks,
  dt: number,
): DuelistContext {
  return {
    config,
    combat,
    pattern,
    posture: new Posture(config.maxPosture),
    vitality: new Vitality(config.maxVitality),
    callbacks,
    machine: null,
    tick: 0,
    dt,
    position: { x: 0, y: 0, z: 0 },
    facing: 0,
    target: null,
    targetDistance: Number.POSITIVE_INFINITY,
    patternIndex: 0,
    stepAttackIndex: 0,
    attack: null,
    attackTicks: 0,
    swingId: 0,
    telegraphed: false,
    pauseTicks: 40,
    blocksInARow: 0,
    deflectedCount: 0,
    velocity: { x: 0, z: 0 },
    velocity3: { x: 0, y: 0, z: 0 },
    knockback: { x: 0, z: 0 },
    faceTarget: true,
    reactionTicks: 0,
  };
}

const ticks = (ctx: DuelistContext): number => ctx.machine?.ticksInState ?? 0;
const reactionDone = (ctx: DuelistContext): boolean => ticks(ctx) >= ctx.reactionTicks;

function currentStep(ctx: DuelistContext): PatternStep | null {
  if (ctx.pattern.length === 0) return null;
  return ctx.pattern[ctx.patternIndex % ctx.pattern.length] ?? null;
}

export function beginAttack(ctx: DuelistContext, attack: AttackDef): void {
  ctx.attack = attack;
  ctx.attackTicks = 0;
  ctx.swingId += 1;
  ctx.telegraphed = false;
  ctx.callbacks.onSwingStart(attack, ctx.tick);
}

/** ¿Queda otro golpe en el combo actual? Si si, lo empieza y devuelve true. */
export function continueCombo(ctx: DuelistContext): boolean {
  const step = currentStep(ctx);
  if (!step) return false;
  const nextId = step.attacks[ctx.stepAttackIndex + 1];
  if (!nextId) return false;
  ctx.stepAttackIndex += 1;
  beginAttack(ctx, DUMMY_ATTACKS[nextId]);
  return true;
}

function finishStep(ctx: DuelistContext): void {
  const step = currentStep(ctx);
  ctx.pauseTicks = Math.round((step?.pauseAfter ?? 60) * ctx.config.pauseScale);
  ctx.patternIndex += 1;
  ctx.attack = null;
}

function stop(ctx: DuelistContext): void {
  ctx.velocity.x = 0;
  ctx.velocity.z = 0;
}

export function createDuelistStates(): readonly State<DuelistContext, DuelistStateId>[] {
  const inRange = (ctx: DuelistContext): boolean =>
    ctx.target !== null && ctx.targetDistance <= ctx.config.attackRange;
  const wantsApproach = (ctx: DuelistContext): boolean =>
    ctx.target !== null &&
    ctx.targetDistance > ctx.config.attackRange &&
    ctx.targetDistance < ctx.config.aggroRange;

  const idle: State<DuelistContext, DuelistStateId> = {
    id: 'idle',
    transitions: [
      { to: 'attack', when: (ctx) => inRange(ctx) && ctx.pauseTicks <= 0, label: 'ataca' },
      { to: 'approach', when: wantsApproach, label: 'se acerca' },
    ],
    enter(ctx) {
      ctx.faceTarget = true;
      ctx.attack = null;
    },
    update(ctx) {
      if (ctx.pauseTicks > 0) ctx.pauseTicks -= 1;
      stop(ctx);
    },
  };

  const approach: State<DuelistContext, DuelistStateId> = {
    id: 'approach',
    transitions: [
      { to: 'attack', when: (ctx) => inRange(ctx) && ctx.pauseTicks <= 0 },
      {
        to: 'idle',
        when: (ctx) =>
          ctx.target === null ||
          ctx.targetDistance <= ctx.config.keepDistance ||
          ctx.targetDistance >= ctx.config.aggroRange ||
          (inRange(ctx) && ctx.pauseTicks > 0),
      },
    ],
    update(ctx) {
      if (ctx.pauseTicks > 0) ctx.pauseTicks -= 1;
      if (!ctx.target) return stop(ctx);
      ctx.velocity.x = -Math.sin(ctx.facing) * ctx.config.walkSpeed;
      ctx.velocity.z = -Math.cos(ctx.facing) * ctx.config.walkSpeed;
    },
  };

  const attack: State<DuelistContext, DuelistStateId> = {
    id: 'attack',
    transitions: [{ to: 'idle', when: (ctx) => ctx.attack === null, label: 'fin del combo' }],
    enter(ctx) {
      const step = currentStep(ctx);
      const first = step?.attacks[0];
      ctx.stepAttackIndex = 0;
      ctx.blocksInARow = 0;
      if (first) beginAttack(ctx, DUMMY_ATTACKS[first]);
    },
    update(ctx) {
      const current = ctx.attack;
      if (!current) return;
      ctx.attackTicks += 1;
      const phase = attackPhase(current, ctx.attackTicks);

      const ticksToImpact = current.startupTicks - ctx.attackTicks;
      if (!ctx.telegraphed && ticksToImpact <= ctx.config.telegraphLeadTicks) {
        ctx.telegraphed = true;
        ctx.callbacks.onTelegraph(current, ctx.tick, ticksToImpact);
      }

      // Sigue al jugador durante el wind-up; despues el golpe esta comprometido.
      ctx.faceTarget = phase === 'startup';

      // Avance: reparte el lunge entre startup y active, sin meterse encima del jugador.
      // El avance ocurre en la segunda mitad del wind-up y durante el golpe.
      const lungeWindow = current.startupTicks * 0.5 + current.activeTicks;
      const tooClose = ctx.targetDistance <= ctx.config.keepDistance - 0.3;
      const lunging =
        (phase === 'startup' && ctx.attackTicks > current.startupTicks * 0.5) || phase === 'active';
      const speed = lunging && !tooClose ? (current.lunge ?? 0) / lungeWindow / ctx.dt : 0;
      ctx.velocity.x = -Math.sin(ctx.facing) * speed;
      ctx.velocity.z = -Math.cos(ctx.facing) * speed;

      if (phase === 'done' && !continueCombo(ctx)) finishStep(ctx);
    },
    exit(ctx) {
      ctx.faceTarget = true;
    },
  };

  const recoil: State<DuelistContext, DuelistStateId> = {
    id: 'recoil',
    transitions: [{ to: 'idle', when: reactionDone }],
    enter(ctx) {
      ctx.reactionTicks = ctx.combat.attackerRecoilTicks;
      ctx.faceTarget = false;
      finishStep(ctx);
      ctx.pauseTicks = Math.min(ctx.pauseTicks, 30);
    },
    update: stop,
  };

  const blockstun: State<DuelistContext, DuelistStateId> = {
    id: 'blockstun',
    transitions: [{ to: 'idle', when: reactionDone }],
    enter(ctx) {
      ctx.reactionTicks = Math.round(ctx.combat.blockStunTicks * 0.6);
      ctx.faceTarget = true;
    },
    update: stop,
  };

  const hitstun: State<DuelistContext, DuelistStateId> = {
    id: 'hitstun',
    transitions: [{ to: 'idle', when: reactionDone }],
    enter(ctx) {
      ctx.reactionTicks = Math.round(ctx.combat.hitStunTicks * 0.7);
      ctx.attack = null;
      ctx.blocksInARow = 0;
      ctx.faceTarget = false;
    },
    update: stop,
  };

  const broken: State<DuelistContext, DuelistStateId> = {
    id: 'broken',
    transitions: [{ to: 'idle', when: (ctx) => ticks(ctx) >= ctx.combat.postureBrokenTicks }],
    enter(ctx) {
      ctx.attack = null;
      ctx.faceTarget = false;
    },
    update: stop,
    exit(ctx) {
      // No lo remataron a tiempo: se recompone con media postura (y algo de vida si llego a 0).
      ctx.posture.recover(ctx.posture.max * 0.5);
      if (ctx.vitality.value <= 0) ctx.vitality.reset();
      ctx.pauseTicks = 30;
    },
  };

  const dying: State<DuelistContext, DuelistStateId> = {
    id: 'dying',
    transitions: [{ to: 'dead', when: (ctx) => ticks(ctx) >= 60 }],
    enter(ctx) {
      ctx.attack = null;
      ctx.faceTarget = false;
    },
    update: stop,
  };

  const dead: State<DuelistContext, DuelistStateId> = {
    id: 'dead',
    transitions: [{ to: 'idle', when: (ctx) => ticks(ctx) >= ctx.combat.enemyRespawnTicks }],
    update: stop,
    exit(ctx) {
      ctx.vitality.reset();
      ctx.posture.reset();
      ctx.patternIndex = 0;
      ctx.pauseTicks = 60;
      ctx.callbacks.onRespawn(ctx.tick);
    },
  };

  return [idle, approach, attack, recoil, blockstun, hitstun, broken, dying, dead];
}
