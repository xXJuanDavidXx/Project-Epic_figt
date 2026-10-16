import { describe, expect, it } from 'vitest';
import { applyEase, blendPoses, clipFinished, sampleClip } from '@/animation/sampler';
import { attackClip, clip, key, pose } from '@/animation/poseKit';
import type { Pose } from '@/animation/types';
import { DUMMY_ATTACKS, PLAYER_ATTACKS } from '@/combat/attackData';
import { RONIN_CLIPS } from '@/animation/clips/ronin';
import { DUELIST_CLIPS } from '@/animation/clips/duelist';

const SWORD = { hand: [0, 1, 0], blade: [0, 0, -1], spine: [0, 1, 0], pole: [1, 0, 0] } as const;

function poseWithChest(x: number, handY = 1): Pose {
  return pose({ joints: { chest: [x, 0, 0] }, sword: { ...SWORD, hand: [0, handY, 0] } });
}

describe('applyEase', () => {
  it('todas las curvas empiezan en 0 y acaban en 1', () => {
    for (const ease of ['linear', 'in', 'out', 'inOut', 'snap'] as const) {
      expect(applyEase(ease, 0)).toBeCloseTo(0, 5);
      expect(applyEase(ease, 1)).toBeCloseTo(1, 5);
    }
  });

  it('snap recorre la mayor parte del camino al principio (tajos secos)', () => {
    expect(applyEase('snap', 0.25)).toBeGreaterThan(0.8);
  });

  it('hold se queda en el origen hasta el final del tramo', () => {
    expect(applyEase('hold', 0.99)).toBe(0);
    expect(applyEase('hold', 1)).toBe(1);
  });
});

describe('sampleClip', () => {
  const a = poseWithChest(0, 1);
  const b = poseWithChest(1, 2);
  const once = clip('test', 10, false, [key(0, a), key(10, b, 'linear')]);

  it('interpola linealmente entre claves', () => {
    const mid = sampleClip(once, 5);
    expect(mid.joints.chest?.[0]).toBeCloseTo(0.5);
    expect(mid.sword.hand[1]).toBeCloseTo(1.5);
  });

  it('acepta tiempo fraccionario (render interpolado)', () => {
    expect(sampleClip(once, 2.5).joints.chest?.[0]).toBeCloseTo(0.25);
  });

  it('un clip de una pasada se queda en la ultima clave', () => {
    expect(sampleClip(once, 50).joints.chest?.[0]).toBeCloseTo(1);
    expect(clipFinished(once, 10)).toBe(true);
    expect(clipFinished(once, 9)).toBe(false);
  });

  it('un clip en bucle vuelve a la primera clave', () => {
    const loop = clip('loop', 10, true, [key(0, a), key(5, b, 'linear')]);
    expect(sampleClip(loop, 10).joints.chest?.[0]).toBeCloseTo(0);
    expect(sampleClip(loop, 15).joints.chest?.[0]).toBeCloseTo(1);
    expect(sampleClip(loop, 7.5).joints.chest?.[0]).toBeCloseTo(0.5);
  });

  it('las direcciones de la hoja se mantienen normalizadas al interpolar', () => {
    const left = pose({ sword: { ...SWORD, blade: [-1, 0, 0] } });
    const fwd = pose({ sword: { ...SWORD, blade: [0, 0, -1] } });
    const mid = blendPoses(left, fwd, 0.5);
    expect(Math.hypot(...mid.sword.blade)).toBeCloseTo(1, 6);
  });
});

describe('clips de ataque construidos desde el AttackDef', () => {
  it('el golpe visible empieza exactamente en el primer tick activo', () => {
    const def = DUMMY_ATTACKS.e_slash;
    const built = attackClip('x', def, {
      ready: poseWithChest(0),
      windup: poseWithChest(0.1),
      coil: poseWithChest(0.2),
      strikeStart: poseWithChest(0.3),
      strikeMid: poseWithChest(0.4),
      strikeEnd: poseWithChest(0.5),
      followThrough: poseWithChest(0.6),
      recover: poseWithChest(0),
    });
    const times = built.keys.map((k) => k.t);
    expect(times).toContain(def.startupTicks);
    expect(times).toContain(def.startupTicks + def.activeTicks);
    expect(built.durationTicks).toBe(def.startupTicks + def.activeTicks + def.recoveryTicks);
  });

  it('cada clip de ataque del catalogo dura exactamente lo que su ataque', () => {
    for (const id of ['atk_1', 'atk_2', 'atk_3'] as const) {
      const def = PLAYER_ATTACKS[id];
      expect(RONIN_CLIPS[id].durationTicks).toBe(
        def.startupTicks + def.activeTicks + def.recoveryTicks,
      );
    }
    for (const id of ['e_slash', 'e_rising', 'e_overhead', 'e_overhead_delayed'] as const) {
      const def = DUMMY_ATTACKS[id];
      expect(DUELIST_CLIPS[id].durationTicks).toBe(
        def.startupTicks + def.activeTicks + def.recoveryTicks,
      );
    }
  });

  it('todas las claves de todos los clips estan dentro de su duracion y ordenadas', () => {
    for (const c of [...Object.values(RONIN_CLIPS), ...Object.values(DUELIST_CLIPS)]) {
      let last = -1;
      for (const k of c.keys) {
        expect(k.t).toBeGreaterThanOrEqual(last);
        expect(k.t).toBeLessThanOrEqual(c.durationTicks);
        last = k.t;
      }
    }
  });
});
