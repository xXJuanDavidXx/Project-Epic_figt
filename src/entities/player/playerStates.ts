import type { PlayerConfig } from '@/config/player';
import type { InputState } from '@/core/input';
import type { State, StateMachine } from '@/core/fsm';
import type { Vec2 } from '@/entities/player/locomotion';
import {
  GroundMemory,
  accelerateHorizontal,
  jumpSpeedForHeight,
} from '@/entities/player/locomotion';

/**
 * Estados del jugador para M1 (movimiento). M2 añadira Attack/Guard/Deflect/
 * Hitstun/GuardBreak/Deathblow/Dead sobre esta misma maquina.
 */
export type PlayerStateId = 'idle' | 'run' | 'sprint' | 'jump' | 'fall' | 'dodge';

/**
 * Contexto compartido por todos los estados. Es un objeto plano: la FSM es pura,
 * el PlayerController es quien lo rellena con datos del mundo y luego los aplica.
 */
export interface PlayerContext {
  readonly config: PlayerConfig;
  readonly input: InputState;
  readonly ground: GroundMemory;
  machine: StateMachine<PlayerContext, PlayerStateId> | null;

  /** Tick actual de simulacion. */
  tick: number;
  /** Duracion de un tick, en segundos. */
  dt: number;
  /** Gravedad del mundo (negativa). */
  gravity: number;

  /** ¿El character controller reporto suelo este tick? */
  grounded: boolean;
  /** Velocidad del jugador en m/s. */
  velocity: { x: number; y: number; z: number };
  /** Direccion deseada en el mundo (ya relativa a la camara), normalizada o cero. */
  desiredDirection: Vec2;
  /** Magnitud del input de movimiento, 0..1. */
  moveMagnitude: number;
  /** Direccion congelada de la esquiva en curso. */
  dodgeDirection: Vec2;
  /** El tick lo pone el estado: si es true, el controller no aplica gravedad. */
  suppressGravity: boolean;
  /** Ticks restantes de bloqueo de esquiva. */
  dodgeCooldown: number;
}

export function createPlayerContext(
  config: PlayerConfig,
  input: InputState,
  gravity: number,
  dt: number,
): PlayerContext {
  return {
    config,
    input,
    ground: new GroundMemory(),
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
  };
}

const wantsToMove = (ctx: PlayerContext): boolean => ctx.moveMagnitude > 0.1;

const wantsSprint = (ctx: PlayerContext): boolean =>
  wantsToMove(ctx) && ctx.input.held('sprint') && ctx.input.heldTicks('sprint') > 6;

/** La esquiva se dispara con una pulsacion (tap); mantener es sprint. */
const wantsDodge = (ctx: PlayerContext): boolean =>
  ctx.dodgeCooldown <= 0 && ctx.input.buffer.peek('dodge', ctx.tick);

const canJump = (ctx: PlayerContext): boolean =>
  ctx.ground.canJump(ctx.config.coyoteTicks) && ctx.input.buffer.peek('jump', ctx.tick);

/** Aplica la velocidad horizontal objetivo segun la velocidad maxima del estado. */
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

function startJump(ctx: PlayerContext): void {
  ctx.input.buffer.consume('jump', ctx.tick);
  ctx.ground.spendJump();
  ctx.velocity.y = jumpSpeedForHeight(ctx.config.jumpHeight, ctx.gravity);
}

export function createPlayerStates(): readonly State<PlayerContext, PlayerStateId>[] {
  const toAirborne = [
    { to: 'jump' as const, when: canJump, label: 'salto' },
    { to: 'fall' as const, when: (ctx: PlayerContext) => !ctx.grounded, label: 'sin suelo' },
  ];
  const toDodge = { to: 'dodge' as const, when: wantsDodge, label: 'esquiva' };

  const idle: State<PlayerContext, PlayerStateId> = {
    id: 'idle',
    transitions: [
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
      {
        to: 'idle',
        when: (ctx) => (ctx.machine?.ticksInState ?? 0) >= ctx.config.dodgeTicks,
        label: 'fin de esquiva',
      },
    ],
    enter(ctx) {
      ctx.input.buffer.consume('dodge', ctx.tick);
      // Sin input direccional, la esquiva va hacia atras respecto a donde mira el jugador.
      const dir = wantsToMove(ctx)
        ? { ...ctx.desiredDirection }
        : { x: -ctx.velocity.x, z: -ctx.velocity.z };
      const length = Math.hypot(dir.x, dir.z);
      ctx.dodgeDirection =
        length > 1e-4 ? { x: dir.x / length, z: dir.z / length } : { x: 0, z: 1 };
      ctx.velocity.x = ctx.dodgeDirection.x * ctx.config.dodgeSpeed;
      ctx.velocity.z = ctx.dodgeDirection.z * ctx.config.dodgeSpeed;
      ctx.dodgeCooldown = ctx.config.dodgeTicks + ctx.config.dodgeRecoveryTicks;
    },
    update(ctx) {
      // Desaceleracion suave durante la esquiva: termina controlada, no en seco.
      const t = (ctx.machine?.ticksInState ?? 0) / Math.max(ctx.config.dodgeTicks, 1);
      const speed = ctx.config.dodgeSpeed * (1 - t * 0.65);
      ctx.velocity.x = ctx.dodgeDirection.x * speed;
      ctx.velocity.z = ctx.dodgeDirection.z * speed;
    },
  };

  return [idle, run, sprint, jump, fall, dodge];
}
