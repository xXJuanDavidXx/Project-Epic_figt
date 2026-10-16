import { describe, expect, it } from 'vitest';
import { Posture } from '@/combat/posture';
import { Vitality } from '@/combat/vitality';

const REGEN = { regenPerTick: 1, guardMultiplier: 2, delayTicks: 10 };

describe('Posture', () => {
  it('acumula daño', () => {
    const posture = new Posture(100);
    posture.damage(30, 10);
    expect(posture.value).toBe(30);
    expect(posture.ratio).toBeCloseTo(0.3);
  });

  it('se rompe al llegar al maximo y lo indica', () => {
    const posture = new Posture(100);
    posture.damage(90, 10);
    expect(posture.damage(15, 10)).toBe(true);
    expect(posture.broken).toBe(true);
    expect(posture.value).toBe(100);
  });

  it('con canBreak=false se queda a 1 del maximo', () => {
    const posture = new Posture(100);
    posture.damage(95, 10);
    expect(posture.damage(20, 10, false)).toBe(false);
    expect(posture.broken).toBe(false);
    expect(posture.value).toBe(99);
  });

  it('la regeneracion se pausa N ticks tras recibir daño', () => {
    const posture = new Posture(100);
    posture.damage(50, 10);
    for (let i = 0; i < 10; i += 1) posture.update(1, false, REGEN);
    expect(posture.value).toBe(50);
    posture.update(1, false, REGEN);
    expect(posture.value).toBe(49);
  });

  it('regenera proporcional a la vitalidad restante', () => {
    const full = new Posture(100);
    const half = new Posture(100);
    full.damage(50, 0);
    half.damage(50, 0);
    full.update(1, false, REGEN);
    half.update(0.5, false, REGEN);
    expect(50 - full.value).toBeCloseTo(1);
    expect(50 - half.value).toBeCloseTo(0.5);
  });

  it('regenera mas rapido en guardia', () => {
    const posture = new Posture(100);
    posture.damage(50, 0);
    posture.update(1, true, REGEN);
    expect(posture.value).toBeCloseTo(48);
  });

  it('con vitalidad 0 no regenera', () => {
    const posture = new Posture(100);
    posture.damage(50, 0);
    posture.update(0, true, REGEN);
    expect(posture.value).toBe(50);
  });

  it('nunca baja de cero', () => {
    const posture = new Posture(100);
    posture.damage(0.5, 0);
    posture.update(1, true, REGEN);
    expect(posture.value).toBe(0);
  });

  it('rota no regenera ni recibe mas daño', () => {
    const posture = new Posture(100);
    posture.damage(100, 0);
    posture.update(1, false, REGEN);
    expect(posture.value).toBe(100);
    expect(posture.damage(10, 0)).toBe(false);
  });

  it('recover sale del estado roto', () => {
    const posture = new Posture(100);
    posture.damage(100, 0);
    posture.recover(60);
    expect(posture.broken).toBe(false);
    expect(posture.value).toBe(60);
  });
});

describe('Vitality', () => {
  it('recibe daño y muere al llegar a cero', () => {
    const vitality = new Vitality(100);
    expect(vitality.damage(60)).toBe(false);
    expect(vitality.damage(60)).toBe(true);
    expect(vitality.value).toBe(0);
    expect(vitality.dead).toBe(true);
  });

  it('muerto no recibe mas daño ni se cura', () => {
    const vitality = new Vitality(100);
    vitality.kill();
    expect(vitality.damage(10)).toBe(false);
    vitality.heal(50);
    expect(vitality.value).toBe(0);
  });

  it('la curacion no supera el maximo', () => {
    const vitality = new Vitality(100);
    vitality.damage(10);
    vitality.heal(50);
    expect(vitality.value).toBe(100);
  });
});
