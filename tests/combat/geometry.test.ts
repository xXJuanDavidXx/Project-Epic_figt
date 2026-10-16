import { describe, expect, it } from 'vitest';
import {
  closestPointOnSegment,
  localToWorld,
  sphereIntersectsCapsule,
  verticalCapsule,
} from '@/combat/geometry';
import { attackPhase, activeProgress, inCancelWindow, totalTicks } from '@/combat/attackData';
import { DUMMY_ATTACKS, PLAYER_ATTACKS } from '@/combat/attackData';

describe('geometry', () => {
  it('localToWorld: adelante local (-Z) con yaw 0 es -Z del mundo', () => {
    const p = localToWorld({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, 0);
    expect(p.z).toBeCloseTo(-1);
  });

  it('localToWorld: con yaw 90 grados, adelante apunta a -X', () => {
    const p = localToWorld({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0 }, Math.PI / 2);
    expect(p.x).toBeCloseTo(-1);
    expect(p.z).toBeCloseTo(0);
  });

  it('closestPointOnSegment se recorta a los extremos', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 0, y: 2, z: 0 };
    expect(closestPointOnSegment({ x: 1, y: 5, z: 0 }, a, b)).toEqual({ x: 0, y: 2, z: 0 });
    expect(closestPointOnSegment({ x: 1, y: 1, z: 0 }, a, b)).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('esfera contra capsula: toca y no toca', () => {
    const capsule = verticalCapsule({ x: 0, y: 1, z: 0 }, 0.55, 0.35);
    expect(sphereIntersectsCapsule({ center: { x: 0.8, y: 1, z: 0 }, radius: 0.5 }, capsule)).toBe(
      true,
    );
    expect(sphereIntersectsCapsule({ center: { x: 1.0, y: 1, z: 0 }, radius: 0.5 }, capsule)).toBe(
      false,
    );
  });
});

describe('fases de ataque', () => {
  const atk = DUMMY_ATTACKS.e_slash;

  it('recorre startup -> active -> recovery -> done en los ticks exactos', () => {
    expect(attackPhase(atk, 0)).toBe('startup');
    expect(attackPhase(atk, atk.startupTicks - 1)).toBe('startup');
    expect(attackPhase(atk, atk.startupTicks)).toBe('active');
    expect(attackPhase(atk, atk.startupTicks + atk.activeTicks - 1)).toBe('active');
    expect(attackPhase(atk, atk.startupTicks + atk.activeTicks)).toBe('recovery');
    expect(attackPhase(atk, totalTicks(atk))).toBe('done');
  });

  it('el progreso activo va de 0 a 1 durante los ticks activos', () => {
    expect(activeProgress(atk, atk.startupTicks)).toBe(0);
    expect(activeProgress(atk, atk.startupTicks + atk.activeTicks - 1)).toBe(1);
  });

  it('la ventana de cancelacion del combo es la declarada', () => {
    const a1 = PLAYER_ATTACKS.atk_1;
    expect(inCancelWindow(a1, a1.cancelWindow[0] - 1)).toBe(false);
    expect(inCancelWindow(a1, a1.cancelWindow[0])).toBe(true);
    expect(inCancelWindow(a1, a1.cancelWindow[1])).toBe(true);
  });

  it('todos los ataques del dummy tienen un wind-up legible (>= 14 ticks)', () => {
    for (const attack of Object.values(DUMMY_ATTACKS)) {
      expect(attack.startupTicks).toBeGreaterThanOrEqual(14);
    }
  });
});
