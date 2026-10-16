import type { PlayerConfig } from '@/config/player';
import type { CombatConfig } from '@/config/combat';
import type { InputState } from '@/core/input';
import type { State, StateMachine, Transition } from '@/core/fsm';
import { GuardTracker } from '@/combat/deflect';
import { Posture } from '@/combat/posture';
import { Vitality } from '@/combat/vitality';
import type { AttackDef, StrikeDirection } from '@/combat/types';
import {
  PLAYER_ATTACKS,
  PLAYER_COMBO,
  attackPhase,
  inCancelWindow,
  totalTicks,
} from '@/combat/attackData';
import type { PlayerAttackId } from '@/combat/attackData';
import type { Vec2 } from '@/entities/player/locomotion';
import {
  GroundMemory,
  accelerateHorizontal,
  jumpSpeedForHeight,
} from '@/entities/player/locomotion';

/**
 * Maquina de estados del jugador: locomocion (M1) + combate (M2).
 * PURA: todo lo que necesita del mundo llega por el contexto.
 */
export type PlayerStateId =
  | 'idle'
  | 'run'
  | 'sprint'
  | 'jump'
  | 'fall'
  | 'dodge'
  | 'guard'
  | 'deflect'
  | 'blockstun'
  | 'attack'
  | 'hitstun'
  | 'guardBreak'
  | 'deathblow'
  | 'dead';

/** Lo minimo que el jugador necesita saber de su objetivo. */
export interface PlayerTarget {
  readonly position: { x: number; y: number; z: number };
  canBeDeathblowed(): boolean;
}

export interface PlayerContext {
  readonly config: PlayerConfig;
  readonly combat: CombatConfig;
  readonly input: InputState;
  readonly ground: GroundMemory;
  readonly guard: GuardTracker;
  readonly posture: Posture;
  readonly vitality: Vitality;
  machine: StateMachine<PlayerContext, PlayerStateId> | null;

  tick: number;
  dt: number;
  gravity: number;
  grounded: boolean;
  velocity: { x: number; y: number; z: number };
  desiredDirection: Vec2;
  moveMagnitude: number;
  dodgeDirection: Vec2;
  suppressGravity: boolean;
  dodgeCooldown: number;

  // --- combate ---
  /** Posicion actual (centro de la capsula). La escribe el controller. */
  position: { x: number; y: number; z: number };
  /** Yaw actual. La escribe el controller. */
  facing: number;
  /** Enemigo mas cercano dentro del rango de encaramiento, o null. */
  target: PlayerTarget | null;
  /** El estado pide encararse al objetivo en vez de a la direccion de movimiento. */
  faceTarget: boolean;
  /** Ataque en curso y ticks desde que empezo. */
  attack: AttackDef | null;
  attackTicks: number;
  comboIndex: number;
  /** Se incrementa con cada tajo: el CombatSystem lo usa para "un golpe por objetivo". */
  swingId: number;
  /** Direccion del ultimo golpe desviado (elige la animacion de deflect). */
  lastStrike: StrikeDirection;
  /** Contador de deflects: alterna entre variantes de animacion. */
  deflectCount: number;
  /** Empuje recibido, en m/s, que se va frenando. */
  knockback: Vec2;
  /** Duracion del estado de reaccion actual, en ticks. */
  reactionTicks: number;
}

export function createPlayerContext(
  config: PlayerConfig,
  combat: CombatConfig,
  input: InputState,
  gravity: number,
  dt: number,
): PlayerContext {
  return {
    config,
    combat,
    input,
    ground: new GroundMemory(),
    guard: new GuardTracker(deflectParams(combat)),
    posture: new Posture(combat.playerMaxPosture),
    vitality: new Vitality(combat.playerMaxVitality),
    machine: null,
    tick: 0,
    dt,
    gravity,
    grounded: false,
    velocity: { x: 0, y: 0, z: 0 },
    desiredDirection: { x: 0, z: 0 },
    moveMagnitude: 0,
    dodgeDirection: { x: 0, z: 0 },
    suppressGravity: false,
    dodgeCooldown: 0,
    position: { x: 0, y: 0, z: 0 },
    facing: 0,
    target: null,
    faceTarget: false,
    attack: null,
    attackTicks: 0,
    comboIndex: 0,
    swingId: 0,
    lastStrike: 'from_right',
    deflectCount: 0,
    knockback: { x: 0, z: 0 },
    reactionTicks: 0,
  };
}

export function deflectParams(combat: CombatConfig): ConstructorParameters<typeof GuardTracker>[0] {
  return {
    windowTicks: combat.deflectWindowTicks,
    perfectTicks: combat.perfectDeflectTicks,
    spamPenaltyTicks: combat.deflectSpamPenaltyTicks,
    minWindowTicks: combat.deflectMinWindowTicks,
    spamResetTicks: combat.deflectSpamResetTicks,
  };
}

// ------------------------------------------------------------------ condiciones
const wantsToMove = (ctx: PlayerContext): boolean => ctx.moveMagnitude > 0.1;

const wantsSprint = (ctx: PlayerContext): boolean =>
  wantsToMove(ctx) && ctx.input.held('sprint') && ctx.input.heldTicks('sprint') > 6;

const wantsDodge = (ctx: PlayerContext): boolean =>
  ctx.dodgeCooldown <= 0 && ctx.input.buffer.peek('dodge', ctx.tick);

const canJump = (ctx: PlayerContext): boolean =>
  ctx.ground.canJump(ctx.config.coyoteTicks) && ctx.input.buffer.peek('jump', ctx.tick);

const wantsGuard = (ctx: PlayerContext): boolean => ctx.input.held('guard');

const wantsAttack = (ctx: PlayerContext): boolean => ctx.input.buffer.peek('attack', ctx.tick);

/** El objetivo esta roto y a tiro: el boton de ataque se convierte en remate. */
const wantsDeathblow = (ctx: PlayerContext): boolean => {
  if (!ctx.target || !ctx.target.canBeDeathblowed()) return false;
  if (!ctx.input.buffer.peek('attack', ctx.tick) && !ctx.input.buffer.peek('interact', ctx.tick)) {
    return false;
  }
  const dx = ctx.target.position.x - ctx.position.x;
  const dz = ctx.target.position.z - ctx.position.z;
  return Math.hypot(dx, dz) <= ctx.combat.deathblowRange;
};

const ticks = (ctx: PlayerContext): number => ctx.machine?.ticksInState ?? 0;

// ------------------------------------------------------------------ acciones
function driveHorizontal(ctx: PlayerContext, maxSpeed: number, controlFactor: number): void {
  const target =
    ctx.moveMagnitude > 0.1
      ? {
          x: ctx.desiredDirection.x * maxSpeed * ctx.moveMagnitude,
          z: ctx.desiredDirection.z * maxSpeed * ctx.moveMagnitude,
        }
      : { x: 0, z: 0 };
  accelerateHorizontal(
    ctx.velocity,
    target,
    ctx.config.groundAccel * controlFactor,
    ctx.config.groundDecel * controlFactor,
    ctx.dt,
  );
}

function stopHorizontal(ctx: PlayerContext): void {
  accelerateHorizontal(ctx.velocity, { x: 0, z: 0 }, 0, ctx.config.groundDecel * 1.5, ctx.dt);
}

function startJump(ctx: PlayerContext): void {
  ctx.input.buffer.consume('jump', ctx.tick);
  ctx.ground.spendJump();
  ctx.velocity.y = jumpSpeedForHeight(ctx.config.jumpHeight, ctx.gravity);
}

function beginAttack(ctx: PlayerContext, id: PlayerAttackId): void {
  ctx.attack = PLAYER_ATTACKS[id];
  ctx.attackTicks = 0;
  ctx.swingId += 1;
  ctx.guard.cancelWindow();
}

/** Avance del ataque: reparte `lunge` metros entre startup y active, sin atravesar al objetivo. */
function applyLunge(ctx: PlayerContext): void {
  const attack = ctx.attack;
  if (!attack) return;
  const phase = attackPhase(attack, ctx.attackTicks);
  const lungeTicks = attack.startupTicks + attack.activeTicks;
  let speed =
    phase === 'recovery' || phase === 'done' ? 0 : (attack.lunge ?? 0) / (lungeTicks * ctx.dt);
  if (ctx.target) {
    const dx = ctx.target.position.x - ctx.position.x;
    const dz = ctx.target.position.z - ctx.position.z;
    if (Math.hypot(dx, dz) <= ctx.config.attackStopDistance) speed = 0;
  }
  ctx.velocity.x = -Math.sin(ctx.facing) * speed;
  ctx.velocity.z = -Math.cos(ctx.facing) * speed;
}

// ------------------------------------------------------------------ estados
export function createPlayerStates(): readonly State<PlayerContext, PlayerStateId>[] {
  const toAirborne: Transition<PlayerContext, PlayerStateId>[] = [
    { to: 'jump', when: canJump, label: 'salto' },
    { to: 'fall', when: (ctx) => !ctx.grounded, label: 'sin suelo' },
  ];
  const toCombat: Transition<PlayerContext, PlayerStateId>[] = [
    { to: 'deathblow', when: wantsDeathblow, label: 'remate' },
    { to: 'attack', when: wantsAttack, label: 'ataque' },
    { to: 'guard', when: wantsGuard, label: 'guardia' },
  ];
  const toDodge: Transition<PlayerContext, PlayerStateId> = {
    to: 'dodge',
    when: wantsDodge,
    label: 'esquiva',
  };

  const idle: State<PlayerContext, PlayerStateId> = {
    id: 'idle',
    transitions: [
      ...toCombat,
      ...toAirborne,
      toDodge,
      { to: 'sprint', when: wantsSprint },
      { to: 'run', when: wantsToMove },
    ],
    update(ctx) {
      driveHorizontal(ctx, 0, 1);
    },
  };

  const run: State<PlayerContext, PlayerStateId> = {
    id: 'run',
    transitions: [
      ...toCombat,
      ...toAirborne,
      toDodge,
      { to: 'sprint', when: wantsSprint },
      { to: 'idle', when: (ctx) => !wantsToMove(ctx) },
    ],
    update(ctx) {
      driveHorizontal(ctx, ctx.config.walkSpeed, 1);
    },
  };

  const sprint: State<PlayerContext, PlayerStateId> = {
    id: 'sprint',
    transitions: [
      ...toCombat,
      ...toAirborne,
      toDodge,
      { to: 'idle', when: (ctx) => !wantsToMove(ctx) },
      { to: 'run', when: (ctx) => !wantsSprint(ctx) },
    ],
    update(ctx) {
      driveHorizontal(ctx, ctx.config.sprintSpeed, 1);
    },
  };

  const jump: State<PlayerContext, PlayerStateId> = {
    id: 'jump',
    transitions: [{ to: 'fall', when: (ctx) => ctx.velocity.y <= 0, label: 'apice' }],
    enter(ctx) {
      startJump(ctx);
    },
    update(ctx) {
      const speed = wantsSprint(ctx) ? ctx.config.sprintSpeed : ctx.config.walkSpeed;
      driveHorizontal(ctx, speed, ctx.config.airControl);
    },
  };

  const fall: State<PlayerContext, PlayerStateId> = {
    id: 'fall',
    transitions: [
      { to: 'jump', when: canJump, label: 'coyote o buffer' },
      { to: 'idle', when: (ctx) => ctx.grounded && !wantsToMove(ctx), label: 'aterriza' },
      { to: 'run', when: (ctx) => ctx.grounded, label: 'aterriza en marcha' },
    ],
    update(ctx) {
      const speed = wantsSprint(ctx) ? ctx.config.sprintSpeed : ctx.config.walkSpeed;
      driveHorizontal(ctx, speed, ctx.config.airControl);
    },
  };

  const dodge: State<PlayerContext, PlayerStateId> = {
    id: 'dodge',
    transitions: [
      { to: 'idle', when: (ctx) => ticks(ctx) >= ctx.config.dodgeTicks, label: 'fin de esquiva' },
    ],
    enter(ctx) {
      ctx.input.buffer.consume('dodge', ctx.tick);
      const dir = wantsToMove(ctx)
        ? { ...ctx.desiredDirection }
        : { x: -ctx.velocity.x, z: -ctx.velocity.z };
      const length = Math.hypot(dir.x, dir.z);
      ctx.dodgeDirection =
        length > 1e-4
          ? { x: dir.x / length, z: dir.z / length }
          : { x: Math.sin(ctx.facing), z: Math.cos(ctx.facing) };
      ctx.velocity.x = ctx.dodgeDirection.x * ctx.config.dodgeSpeed;
      ctx.velocity.z = ctx.dodgeDirection.z * ctx.config.dodgeSpeed;
      ctx.dodgeCooldown = ctx.config.dodgeTicks + ctx.config.dodgeRecoveryTicks;
    },
    update(ctx) {
      const t = ticks(ctx) / Math.max(ctx.config.dodgeTicks, 1);
      const speed = ctx.config.dodgeSpeed * (1 - t * 0.65);
      ctx.velocity.x = ctx.dodgeDirection.x * speed;
      ctx.velocity.z = ctx.dodgeDirection.z * speed;
    },
  };

  // ---------------------------------------------------------------- combate
  /** Re-pulsar guardia durante cualquier estado defensivo abre una ventana nueva. */
  function rePressGuard(ctx: PlayerContext): void {
    if (ctx.input.buffer.consume('guard', ctx.tick)) ctx.guard.press(ctx.tick);
  }

  const guard: State<PlayerContext, PlayerStateId> = {
    id: 'guard',
    transitions: [
      { to: 'deathblow', when: wantsDeathblow, label: 'remate' },
      { to: 'attack', when: wantsAttack, label: 'ataque desde guardia' },
      toDodge,
      { to: 'jump', when: canJump },
      { to: 'fall', when: (ctx) => !ctx.grounded },
      { to: 'idle', when: (ctx) => !wantsGuard(ctx), label: 'suelta guardia' },
    ],
    enter(ctx) {
      ctx.faceTarget = true;
      // La ventana de deflect solo se abre con una pulsacion real, no al volver a la guardia
      // desde otro estado con el boton ya mantenido.
      if (ctx.input.buffer.consume('guard', ctx.tick)) ctx.guard.press(ctx.tick);
    },
    update(ctx) {
      rePressGuard(ctx);
      driveHorizontal(ctx, ctx.config.guardWalkSpeed, 1);
    },
    exit(ctx) {
      ctx.faceTarget = false;
    },
  };

  const reactionDone = (ctx: PlayerContext): boolean => ticks(ctx) >= ctx.reactionTicks;

  const deflect: State<PlayerContext, PlayerStateId> = {
    id: 'deflect',
    transitions: [
      { to: 'deathblow', when: (ctx) => reactionDone(ctx) && wantsDeathblow(ctx) },
      { to: 'attack', when: (ctx) => reactionDone(ctx) && wantsAttack(ctx), label: 'contraataque' },
      { to: 'dodge', when: (ctx) => reactionDone(ctx) && wantsDodge(ctx) },
      { to: 'guard', when: (ctx) => reactionDone(ctx) && wantsGuard(ctx) },
      { to: 'idle', when: reactionDone },
    ],
    enter(ctx) {
      ctx.faceTarget = true;
      ctx.reactionTicks = ctx.combat.deflectRecoverTicks;
      ctx.deflectCount += 1;
    },
    update(ctx) {
      rePressGuard(ctx);
      stopHorizontal(ctx);
    },
    exit(ctx) {
      ctx.faceTarget = false;
    },
  };

  const blockstun: State<PlayerContext, PlayerStateId> = {
    id: 'blockstun',
    transitions: [
      { to: 'guard', when: (ctx) => reactionDone(ctx) && wantsGuard(ctx) },
      { to: 'idle', when: reactionDone },
    ],
    enter(ctx) {
      ctx.faceTarget = true;
      ctx.reactionTicks = ctx.combat.blockStunTicks;
    },
    update(ctx) {
      rePressGuard(ctx);
      stopHorizontal(ctx);
    },
    exit(ctx) {
      ctx.faceTarget = false;
    },
  };

  const attack: State<PlayerContext, PlayerStateId> = {
    id: 'attack',
    transitions: [
      {
        to: 'guard',
        when: (ctx) =>
          ctx.attack !== null &&
          inCancelWindow(ctx.attack, ctx.attackTicks) &&
          ctx.input.buffer.peek('guard', ctx.tick),
        label: 'cancelar a guardia',
      },
      {
        to: 'idle',
        when: (ctx) => ctx.attack === null || attackPhase(ctx.attack, ctx.attackTicks) === 'done',
        label: 'fin del combo',
      },
    ],
    enter(ctx) {
      ctx.faceTarget = true;
      ctx.input.buffer.consume('attack', ctx.tick);
      ctx.comboIndex = 0;
      beginAttack(ctx, PLAYER_COMBO[0] ?? 'atk_1');
    },
    update(ctx) {
      const current = ctx.attack;
      if (!current) return;
      ctx.attackTicks += 1;

      // Encadenar: el siguiente golpe sale en cuanto termina el activo del actual.
      const phase = attackPhase(current, ctx.attackTicks);
      const nextId = PLAYER_COMBO[ctx.comboIndex + 1];
      if (
        nextId &&
        (phase === 'recovery' || phase === 'done') &&
        ctx.input.buffer.consume('attack', ctx.tick)
      ) {
        ctx.comboIndex += 1;
        beginAttack(ctx, nextId);
      }
      // Solo se corrige la direccion durante el startup: despues el golpe esta comprometido.
      ctx.faceTarget = attackPhase(ctx.attack ?? current, ctx.attackTicks) === 'startup';
      applyLunge(ctx);
    },
    exit(ctx) {
      ctx.attack = null;
      ctx.faceTarget = false;
    },
  };

  const deathblow: State<PlayerContext, PlayerStateId> = {
    id: 'deathblow',
    transitions: [
      {
        to: 'idle',
        when: (ctx) => ctx.attack !== null && ctx.attackTicks >= totalTicks(ctx.attack),
      },
    ],
    enter(ctx) {
      ctx.input.buffer.consume('attack', ctx.tick);
      ctx.input.buffer.consume('interact', ctx.tick);
      ctx.faceTarget = true;
      beginAttack(ctx, 'deathblow');
    },
    update(ctx) {
      ctx.attackTicks += 1;
      applyLunge(ctx);
    },
    exit(ctx) {
      ctx.attack = null;
      ctx.faceTarget = false;
    },
  };

  const hitstun: State<PlayerContext, PlayerStateId> = {
    id: 'hitstun',
    transitions: [{ to: 'idle', when: reactionDone }],
    enter(ctx) {
      ctx.reactionTicks = ctx.combat.hitStunTicks;
    },
    update(ctx) {
      stopHorizontal(ctx);
    },
  };

  const guardBreak: State<PlayerContext, PlayerStateId> = {
    id: 'guardBreak',
    transitions: [{ to: 'idle', when: reactionDone }],
    enter(ctx) {
      ctx.reactionTicks = ctx.combat.guardBreakTicks;
      ctx.guard.reset();
    },
    update(ctx) {
      stopHorizontal(ctx);
    },
    exit(ctx) {
      // Tras el aturdimiento la postura vuelve a un valor jugable.
      ctx.posture.recover(ctx.posture.max * 0.3);
    },
  };

  const dead: State<PlayerContext, PlayerStateId> = {
    id: 'dead',
    transitions: [{ to: 'idle', when: (ctx) => ticks(ctx) >= ctx.config.deadTicks }],
    enter(ctx) {
      ctx.guard.reset();
    },
    update(ctx) {
      stopHorizontal(ctx);
    },
    exit(ctx) {
      ctx.vitality.reset();
      ctx.posture.reset();
    },
  };

  return [
    idle,
    run,
    sprint,
    jump,
    fall,
    dodge,
    guard,
    deflect,
    blockstun,
    attack,
    deathblow,
    hitstun,
    guardBreak,
    dead,
  ];
}

/** Estados en los que la guardia/deflect cuentan como defensa. */
export const DEFENSIVE_STATES: readonly PlayerStateId[] = ['guard', 'deflect', 'blockstun'];
