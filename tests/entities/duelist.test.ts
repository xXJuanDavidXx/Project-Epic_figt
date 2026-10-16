import { describe, expect, it } from 'vitest';
import { combatConfig } from '@/config/combat';
import { enemyConfig } from '@/config/enemy';
import { StateMachine } from '@/core/fsm';
import { DUMMY_ATTACKS, attackPhase } from '@/combat/attackData';
import type { DuelistContext, DuelistStateId } from '@/entities/enemies/duelistStates';
import {
  continueCombo,
  createDuelistContext,
  createDuelistStates,
} from '@/entities/enemies/duelistStates';

function duelist() {
  const swings: { id: string; ticksToActive: number }[] = [];
  const ctx = createDuelistContext(
    enemyConfig,
    combatConfig,
    [{ attacks: ['e_slash', 'e_rising'], pauseAfter: 60 }],
    {
      onSwingStart: (attack, _tick, ticksToActive) => swings.push({ id: attack.id, ticksToActive }),
      onTelegraph: () => undefined,
      onRespawn: () => undefined,
    },
    1 / 60,
  );
  ctx.target = { x: 0, y: 1, z: 1.8 };
  ctx.targetDistance = 1.8;
  ctx.pauseTicks = 0;
  const machine = new StateMachine<DuelistContext, DuelistStateId>(
    createDuelistStates(),
    'idle',
    ctx,
  );
  ctx.machine = machine;
  let tick = 0;
  return {
    ctx,
    machine,
    swings,
    run(n: number) {
      for (let i = 0; i < n; i += 1) {
        tick += 1;
        ctx.tick = tick;
        machine.update(tick);
      }
    },
  };
}

describe('Duelista — rebote tras deflect', () => {
  it('a mitad de combo, el siguiente golpe espera el rebote antes de su startup', () => {
    const d = duelist();
    d.run(1);
    expect(d.machine.current).toBe('attack');
    expect(d.ctx.attack?.id).toBe('e_slash');

    // Deflect del primer golpe: el combo continua con rebote.
    expect(continueCombo(d.ctx, combatConfig.deflectBounceTicks)).toBe(true);
    expect(d.ctx.attack?.id).toBe('e_rising');
    expect(d.ctx.attackTicks).toBe(-combatConfig.deflectBounceTicks);

    const rising = DUMMY_ATTACKS.e_rising;
    const ticksUntilActive = combatConfig.deflectBounceTicks + rising.startupTicks;
    d.run(ticksUntilActive - 1);
    expect(attackPhase(rising, d.ctx.attackTicks)).toBe('startup');
    d.run(1);
    expect(attackPhase(rising, d.ctx.attackTicks)).toBe('active');
  });

  it('el aviso de silbido descuenta el rebote', () => {
    const d = duelist();
    d.run(1);
    continueCombo(d.ctx, combatConfig.deflectBounceTicks);
    const last = d.swings.at(-1);
    expect(last?.ticksToActive).toBe(
      DUMMY_ATTACKS.e_rising.startupTicks + combatConfig.deflectBounceTicks,
    );
  });

  it('en el ultimo golpe del combo no hay continuacion (se queda abierto)', () => {
    const d = duelist();
    d.run(1);
    continueCombo(d.ctx);
    expect(continueCombo(d.ctx, 9)).toBe(false);
  });
});
