import { describe, expect, it } from 'vitest';
import type { ActionId } from '@/config/input';
import { playerConfig } from '@/config/player';
import { combatConfig } from '@/config/combat';
import { StateMachine } from '@/core/fsm';
import { InputBuffer } from '@/core/input';
import type { InputState } from '@/core/input';
import { PLAYER_ATTACKS } from '@/combat/attackData';
import type { PlayerContext, PlayerStateId, PlayerTarget } from '@/entities/player/playerStates';
import { createPlayerContext, createPlayerStates } from '@/entities/player/playerStates';

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
  hold(a: ActionId): void {
    if (!this.heldActions.has(a)) this.heldActions.set(a, 0);
  }
  release(a: ActionId): void {
    this.heldActions.delete(a);
  }
  held(a: ActionId): boolean {
    return this.heldActions.has(a);
  }
  heldTicks(a: ActionId): number {
    return this.heldActions.get(a) ?? 0;
  }
  pressed(): boolean {
    return false;
  }
  released(): boolean {
    return false;
  }
}

function harness() {
  const input = new FakeInput();
  const context = createPlayerContext(playerConfig, combatConfig, input, -24, 1 / 60);
  context.grounded = true;
  const machine = new StateMachine<PlayerContext, PlayerStateId>(
    createPlayerStates(),
    'idle',
    context,
  );
  context.machine = machine;
  let tick = 0;
  return {
    input,
    context,
    machine,
    get tick() {
      return tick;
    },
    /** Pulsa una accion como lo haria el InputManager (buffer + mantenida). */
    press(action: ActionId) {
      input.buffer.press(action, tick);
      input.hold(action);
    },
    run(count: number) {
      for (let i = 0; i < count; i += 1) {
        tick += 1;
        context.tick = tick;
        context.ground.update(context.grounded);
        context.guard.setHeld(input.held('guard'));
        machine.update(tick);
      }
    },
  };
}

const brokenTarget = (broken: boolean): PlayerTarget => ({
  position: { x: 0, y: 1, z: -1.5 },
  canBeDeathblowed: () => broken,
});

describe('FSM del jugador — guardia y deflect', () => {
  it('pulsar guardia entra en guard y abre la ventana de deflect', () => {
    const h = harness();
    h.press('guard');
    h.run(1);
    expect(h.machine.current).toBe('guard');
    expect(h.context.guard.evaluate(h.tick).deflect).toBe('perfect');
  });

  it('volver a la guardia con el boton ya mantenido NO abre ventana nueva', () => {
    const h = harness();
    h.input.hold('guard');
    h.run(1);
    expect(h.machine.current).toBe('guard');
    expect(h.context.guard.evaluate(h.tick).deflect).toBeNull();
    expect(h.context.guard.evaluate(h.tick).blocking).toBe(true);
  });

  it('re-pulsar durante la guardia reabre la ventana', () => {
    const h = harness();
    h.press('guard');
    h.run(30);
    expect(h.context.guard.evaluate(h.tick).deflect).toBeNull();
    h.input.buffer.press('guard', h.tick);
    h.run(1);
    expect(h.context.guard.evaluate(h.tick).deflect).not.toBeNull();
  });

  it('soltar la guardia vuelve a idle', () => {
    const h = harness();
    h.press('guard');
    h.run(3);
    h.input.release('guard');
    h.run(1);
    expect(h.machine.current).toBe('idle');
  });

  it('tras un deflect se puede contraatacar al acabar el gesto', () => {
    const h = harness();
    h.press('guard');
    h.run(1);
    h.machine.force('deflect', h.tick);
    h.press('attack');
    h.run(combatConfig.deflectRecoverTicks - 2);
    expect(h.machine.current).toBe('deflect');
    h.input.buffer.press('attack', h.tick);
    h.run(3);
    expect(h.machine.current).toBe('attack');
  });
});

describe('FSM del jugador — ataque', () => {
  it('atacar empieza el primer golpe del combo', () => {
    const h = harness();
    h.press('attack');
    h.run(1);
    expect(h.machine.current).toBe('attack');
    expect(h.context.attack?.id).toBe('atk_1');
  });

  it('pulsar de nuevo encadena el combo atk_1 -> atk_2 -> atk_3', () => {
    const h = harness();
    h.press('attack');
    h.run(1);
    const seen = new Set<string>();
    for (let i = 0; i < 120; i += 1) {
      if (i % 6 === 0) h.input.buffer.press('attack', h.tick);
      h.run(1);
      if (h.context.attack) seen.add(h.context.attack.id);
    }
    expect([...seen]).toEqual(['atk_1', 'atk_2', 'atk_3']);
  });

  it('cada golpe del combo es un tajo nuevo (swingId distinto)', () => {
    const h = harness();
    h.press('attack');
    h.run(1);
    const first = h.context.swingId;
    for (let i = 0; i < 40; i += 1) {
      h.input.buffer.press('attack', h.tick);
      h.run(1);
    }
    expect(h.context.swingId).toBeGreaterThan(first);
  });

  it('sin mas pulsaciones el ataque termina y vuelve a idle', () => {
    const h = harness();
    h.press('attack');
    h.input.release('attack');
    const a = PLAYER_ATTACKS.atk_1;
    h.run(a.startupTicks + a.activeTicks + a.recoveryTicks + 2);
    expect(h.machine.current).toBe('idle');
  });

  it('se cancela a guardia dentro de la ventana de cancelacion', () => {
    const h = harness();
    h.press('attack');
    h.input.release('attack');
    const [from] = PLAYER_ATTACKS.atk_1.cancelWindow;
    h.run(from + 1);
    h.press('guard');
    h.run(1);
    expect(h.machine.current).toBe('guard');
  });

  it('NO se cancela a guardia durante el startup (el golpe esta comprometido)', () => {
    const h = harness();
    h.press('attack');
    h.input.release('attack');
    h.run(2);
    h.press('guard');
    h.run(1);
    expect(h.machine.current).toBe('attack');
  });
});

describe('FSM del jugador — remate', () => {
  it('con el objetivo roto y cerca, atacar es rematar', () => {
    const h = harness();
    h.context.target = brokenTarget(true);
    h.press('attack');
    h.run(1);
    expect(h.machine.current).toBe('deathblow');
    expect(h.context.attack?.id).toBe('deathblow');
  });

  it('con el objetivo entero, atacar es atacar', () => {
    const h = harness();
    h.context.target = brokenTarget(false);
    h.press('attack');
    h.run(1);
    expect(h.machine.current).toBe('attack');
  });

  it('demasiado lejos no se puede rematar', () => {
    const h = harness();
    h.context.target = { position: { x: 0, y: 1, z: -10 }, canBeDeathblowed: () => true };
    h.press('attack');
    h.run(1);
    expect(h.machine.current).toBe('attack');
  });
});

describe('FSM del jugador — reacciones', () => {
  it('la rotura de guardia dura lo configurado y deja la postura en un 30%', () => {
    const h = harness();
    h.context.posture.damage(100, 0);
    h.machine.force('guardBreak', h.tick);
    h.run(combatConfig.guardBreakTicks + 1);
    expect(h.machine.current).toBe('idle');
    expect(h.context.posture.broken).toBe(false);
    expect(h.context.posture.ratio).toBeCloseTo(0.3, 1);
  });

  it('al morir se reaparece con vida y postura completas', () => {
    const h = harness();
    h.context.vitality.kill();
    h.machine.force('dead', h.tick);
    h.run(playerConfig.deadTicks + 1);
    expect(h.machine.current).toBe('idle');
    expect(h.context.vitality.ratio).toBe(1);
  });
});
