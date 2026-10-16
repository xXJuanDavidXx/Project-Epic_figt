import { describe, expect, it } from 'vitest';
import type { ActionId } from '@/config/input';
import { playerConfig } from '@/config/player';
import { combatConfig } from '@/config/combat';
import { StateMachine } from '@/core/fsm';
import { InputBuffer } from '@/core/input';
import type { InputState } from '@/core/input';
import type { PlayerContext, PlayerStateId } from '@/entities/player/playerStates';
import { createPlayerContext, createPlayerStates } from '@/entities/player/playerStates';
import { cameraRelativeDirection } from '@/entities/player/locomotion';

const DT = 1 / 60;
const GRAVITY = -24;

/** Input falso controlable desde el test: la FSM no sabe de teclados. */
class FakeInput implements InputState {
  moveX = 0;
  moveY = 0;
  moveMagnitude = 0;
  lookDeltaX = 0;
  lookDeltaY = 0;
  lookStickX = 0;
  lookStickY = 0;
  readonly buffer = new InputBuffer(9);

  private readonly heldActions = new Map<ActionId, number>();

  hold(action: ActionId): void {
    if (!this.heldActions.has(action)) this.heldActions.set(action, 0);
  }

  release(action: ActionId): void {
    this.heldActions.delete(action);
  }

  tick(): void {
    for (const [action, ticks] of this.heldActions) this.heldActions.set(action, ticks + 1);
  }

  held(action: ActionId): boolean {
    return this.heldActions.has(action);
  }

  heldTicks(action: ActionId): number {
    return this.heldActions.get(action) ?? 0;
  }

  pressed(): boolean {
    return false;
  }

  released(): boolean {
    return false;
  }

  moveForward(): void {
    this.moveX = 0;
    this.moveY = 1;
    this.moveMagnitude = 1;
  }

  stop(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.moveMagnitude = 0;
  }
}

interface Harness {
  input: FakeInput;
  context: PlayerContext;
  machine: StateMachine<PlayerContext, PlayerStateId>;
  /** Avanza `count` ticks manteniendo el estado de suelo indicado. */
  run(count: number, grounded?: boolean): void;
  tick: number;
}

function harness(grounded = true): Harness {
  const input = new FakeInput();
  const context = createPlayerContext(playerConfig, combatConfig, input, GRAVITY, DT);
  context.grounded = grounded;
  context.desiredDirection = { x: 0, z: -1 };
  const machine = new StateMachine<PlayerContext, PlayerStateId>(
    createPlayerStates(),
    'idle',
    context,
  );
  context.machine = machine;

  const h: Harness = {
    input,
    context,
    machine,
    tick: 0,
    run(count, groundedDuring) {
      for (let i = 0; i < count; i += 1) {
        h.tick += 1;
        context.tick = h.tick;
        if (groundedDuring !== undefined) context.grounded = groundedDuring;
        if (context.dodgeCooldown > 0) context.dodgeCooldown -= 1;
        // Lo mismo que hace PlayerController antes de actualizar la FSM.
        context.desiredDirection = cameraRelativeDirection(input.moveX, input.moveY, 0);
        context.moveMagnitude = input.moveMagnitude;
        context.ground.update(context.grounded);
        machine.update(h.tick);
        input.tick();
      }
    },
  };
  return h;
}

describe('FSM del jugador — locomocion', () => {
  it('arranca en idle', () => {
    expect(harness().machine.current).toBe('idle');
  });

  it('idle -> run al mover', () => {
    const h = harness();
    h.input.moveForward();
    h.run(1);
    expect(h.machine.current).toBe('run');
  });

  it('run -> idle al soltar', () => {
    const h = harness();
    h.input.moveForward();
    h.run(2);
    h.input.stop();
    h.run(1);
    expect(h.machine.current).toBe('idle');
  });

  it('run -> sprint solo tras mantener el boton varios ticks', () => {
    const h = harness();
    h.input.moveForward();
    h.input.hold('sprint');
    h.run(3);
    expect(h.machine.current).toBe('run');
    h.run(6);
    expect(h.machine.current).toBe('sprint');
  });

  it('sprint -> run al soltar el boton', () => {
    const h = harness();
    h.input.moveForward();
    h.input.hold('sprint');
    h.run(10);
    expect(h.machine.current).toBe('sprint');
    h.input.release('sprint');
    h.run(1);
    expect(h.machine.current).toBe('run');
  });

  it('corriendo se alcanza la velocidad de sprint', () => {
    const h = harness();
    h.input.moveForward();
    h.input.hold('sprint');
    h.run(40);
    expect(Math.hypot(h.context.velocity.x, h.context.velocity.z)).toBeCloseTo(
      playerConfig.sprintSpeed,
      2,
    );
  });
});

describe('FSM del jugador — salto', () => {
  it('salta desde el suelo con el input en buffer', () => {
    const h = harness();
    h.input.buffer.press('jump', 0);
    h.run(1);
    expect(h.machine.current).toBe('jump');
    expect(h.context.velocity.y).toBeGreaterThan(0);
  });

  it('no permite doble salto en el aire', () => {
    const h = harness();
    h.input.buffer.press('jump', 0);
    h.run(1);
    h.context.velocity.y = 5;
    h.input.buffer.press('jump', h.tick);
    h.run(1, false);
    expect(h.machine.current).toBe('jump');
    expect(h.machine.ticksInState).toBeGreaterThan(0);
  });

  it('jump -> fall al pasar el apice', () => {
    const h = harness();
    h.input.buffer.press('jump', 0);
    h.run(1);
    h.context.velocity.y = -0.1;
    h.run(1, false);
    expect(h.machine.current).toBe('fall');
  });

  it('idle -> fall al quedarse sin suelo', () => {
    const h = harness();
    h.run(1, false);
    expect(h.machine.current).toBe('fall');
  });

  it('fall -> idle al aterrizar quieto', () => {
    const h = harness();
    h.run(3, false);
    expect(h.machine.current).toBe('fall');
    h.run(1, true);
    expect(h.machine.current).toBe('idle');
  });

  it('fall -> run al aterrizar en marcha', () => {
    const h = harness();
    h.run(3, false);
    h.input.moveForward();
    h.run(1, true);
    expect(h.machine.current).toBe('run');
  });

  it('coyote time: salta tras dejar el borde', () => {
    const h = harness();
    h.run(1, true);
    h.run(playerConfig.coyoteTicks - 1, false);
    expect(h.machine.current).toBe('fall');
    h.input.buffer.press('jump', h.tick);
    h.run(1, false);
    expect(h.machine.current).toBe('jump');
  });

  it('pasada la ventana de coyote ya no se puede saltar', () => {
    const h = harness();
    h.run(1, true);
    h.run(playerConfig.coyoteTicks + 3, false);
    h.input.buffer.press('jump', h.tick);
    h.run(1, false);
    expect(h.machine.current).toBe('fall');
  });

  it('input buffer: saltar justo antes de aterrizar ejecuta el salto al tocar suelo', () => {
    const h = harness();
    h.run(10, false);
    h.input.buffer.press('jump', h.tick);
    h.run(3, false);
    expect(h.machine.current).toBe('fall');
    h.run(1, true);
    expect(h.machine.current).toBe('jump');
  });
});

describe('FSM del jugador — esquiva', () => {
  it('idle -> dodge con el input en buffer', () => {
    const h = harness();
    h.input.buffer.press('dodge', 0);
    h.run(1);
    expect(h.machine.current).toBe('dodge');
  });

  it('la esquiva dura los ticks configurados y vuelve a idle', () => {
    const h = harness();
    h.input.buffer.press('dodge', 0);
    h.run(1);
    h.run(playerConfig.dodgeTicks - 1);
    expect(h.machine.current).toBe('dodge');
    h.run(1);
    expect(h.machine.current).toBe('idle');
  });

  it('la esquiva arranca a la velocidad configurada y va frenando', () => {
    const h = harness();
    h.input.moveForward();
    h.input.buffer.press('dodge', 0);
    h.run(1);
    const initial = Math.hypot(h.context.velocity.x, h.context.velocity.z);
    expect(initial).toBeCloseTo(playerConfig.dodgeSpeed, 2);
    h.run(playerConfig.dodgeTicks - 2);
    expect(Math.hypot(h.context.velocity.x, h.context.velocity.z)).toBeLessThan(initial);
  });

  it('no se puede encadenar otra esquiva durante la recuperacion', () => {
    const h = harness();
    h.input.buffer.press('dodge', 0);
    h.run(playerConfig.dodgeTicks + 1);
    expect(h.machine.current).toBe('idle');
    h.input.buffer.press('dodge', h.tick);
    h.run(1);
    expect(h.machine.current).toBe('idle');
  });

  it('se puede esquivar de nuevo pasada la recuperacion', () => {
    const h = harness();
    h.input.buffer.press('dodge', 0);
    h.run(playerConfig.dodgeTicks + playerConfig.dodgeRecoveryTicks + 2);
    h.input.buffer.press('dodge', h.tick);
    h.run(1);
    expect(h.machine.current).toBe('dodge');
  });

  it('sin direccion, la esquiva va hacia atras del movimiento actual', () => {
    const h = harness();
    h.context.velocity.x = 0;
    h.context.velocity.z = -4;
    h.input.buffer.press('dodge', 0);
    h.run(1);
    expect(h.context.dodgeDirection.z).toBeGreaterThan(0);
  });
});
