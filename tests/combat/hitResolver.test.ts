import { describe, expect, it } from 'vitest';
import { combatConfig } from '@/config/combat';
import { isWithinArc, resolveHit } from '@/combat/hitResolver';
import { DUMMY_ATTACKS } from '@/combat/attackData';
import type { AttackDef, DefenseSnapshot } from '@/combat/types';

const slash: AttackDef = DUMMY_ATTACKS.e_slash;
const noDefense: DefenseSnapshot = {
  deflect: null,
  blocking: false,
  invulnerable: false,
  facingAttacker: true,
};
const fresh = { value: 0, max: 100 };

describe('resolveHit', () => {
  it('sin defensa: golpe con daño de vitalidad', () => {
    const r = resolveHit(slash, noDefense, fresh, combatConfig);
    expect(r.outcome).toBe('hit');
    expect(r.defenderVitalityDmg).toBe(slash.vitalityDmg);
  });

  it('deflect: 0 daño de vida, poca postura propia, postura al atacante', () => {
    const r = resolveHit(slash, { ...noDefense, deflect: 'normal' }, fresh, combatConfig);
    expect(r.outcome).toBe('deflect');
    expect(r.defenderVitalityDmg).toBe(0);
    expect(r.attackerPostureDmg).toBeGreaterThan(0);
    expect(r.defenderPostureDmg).toBeLessThan(slash.postureDmg * combatConfig.blockPostureFactor);
  });

  it('el deflect perfecto castiga mas al atacante y menos al defensor', () => {
    const normal = resolveHit(slash, { ...noDefense, deflect: 'normal' }, fresh, combatConfig);
    const perfect = resolveHit(slash, { ...noDefense, deflect: 'perfect' }, fresh, combatConfig);
    expect(perfect.outcome).toBe('deflect_perfect');
    expect(perfect.attackerPostureDmg).toBeGreaterThan(normal.attackerPostureDmg);
    expect(perfect.defenderPostureDmg).toBeLessThan(normal.defenderPostureDmg);
    expect(perfect.hitstopTicks).toBeGreaterThanOrEqual(normal.hitstopTicks);
  });

  it('bloqueo: 0 daño de vida, mas postura propia que el deflect', () => {
    const block = resolveHit(slash, { ...noDefense, blocking: true }, fresh, combatConfig);
    const deflect = resolveHit(slash, { ...noDefense, deflect: 'normal' }, fresh, combatConfig);
    expect(block.outcome).toBe('block');
    expect(block.defenderVitalityDmg).toBe(0);
    expect(block.defenderPostureDmg).toBeGreaterThan(deflect.defenderPostureDmg);
  });

  it('el deflect gana al bloqueo cuando ambos aplican', () => {
    const r = resolveHit(
      slash,
      { ...noDefense, deflect: 'normal', blocking: true },
      fresh,
      combatConfig,
    );
    expect(r.outcome).toBe('deflect');
  });

  it('un bloqueo que llena la postura rompe la guardia', () => {
    const r = resolveHit(
      slash,
      { ...noDefense, blocking: true },
      { value: 90, max: 100 },
      combatConfig,
    );
    expect(r.outcome).toBe('guard_break');
  });

  it('por la espalda no se puede bloquear ni desviar', () => {
    const r = resolveHit(
      slash,
      { ...noDefense, deflect: 'perfect', blocking: true, facingAttacker: false },
      fresh,
      combatConfig,
    );
    expect(r.outcome).toBe('hit');
  });

  it('invulnerable (i-frames) esquiva todo', () => {
    const r = resolveHit(slash, { ...noDefense, invulnerable: true }, fresh, combatConfig);
    expect(r.outcome).toBe('evaded');
    expect(r.defenderVitalityDmg).toBe(0);
  });

  it('barrido y agarre ignoran guardia y deflect', () => {
    for (const kind of ['perilous_sweep', 'perilous_grab'] as const) {
      const r = resolveHit(
        { ...slash, kind },
        { ...noDefense, deflect: 'perfect', blocking: true },
        fresh,
        combatConfig,
      );
      expect(r.outcome).toBe('hit');
    }
  });

  it('la estocada no se bloquea pero si se desvia', () => {
    const thrust: AttackDef = { ...slash, kind: 'perilous_thrust' };
    expect(resolveHit(thrust, { ...noDefense, blocking: true }, fresh, combatConfig).outcome).toBe(
      'hit',
    );
    expect(
      resolveHit(thrust, { ...noDefense, deflect: 'normal' }, fresh, combatConfig).outcome,
    ).toBe('deflect');
  });

  it('con thrustRequiresPerfectDeflect, la estocada exige deflect perfecto', () => {
    const cfg = { ...combatConfig, thrustRequiresPerfectDeflect: true };
    const thrust: AttackDef = { ...slash, kind: 'perilous_thrust' };
    expect(resolveHit(thrust, { ...noDefense, deflect: 'normal' }, fresh, cfg).outcome).toBe('hit');
    expect(resolveHit(thrust, { ...noDefense, deflect: 'perfect' }, fresh, cfg).outcome).toBe(
      'deflect_perfect',
    );
  });
});

describe('isWithinArc', () => {
  const origin = { x: 0, z: 0 };
  it('delante (-Z con yaw 0) esta dentro', () => {
    expect(isWithinArc(origin, 0, { x: 0, z: -2 }, 200)).toBe(true);
  });
  it('detras esta fuera', () => {
    expect(isWithinArc(origin, 0, { x: 0, z: 2 }, 200)).toBe(false);
  });
  it('un lateral puro entra con 200 grados y no con 160', () => {
    expect(isWithinArc(origin, 0, { x: 2, z: 0 }, 200)).toBe(true);
    expect(isWithinArc(origin, 0, { x: 2, z: 0 }, 160)).toBe(false);
  });
});
