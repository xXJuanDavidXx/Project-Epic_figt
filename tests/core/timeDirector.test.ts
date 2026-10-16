import { describe, expect, it } from 'vitest';
import { TimeDirector } from '@/core/timeDirector';

describe('TimeDirector', () => {
  it('empieza a velocidad normal', () => {
    expect(new TimeDirector().scale).toBe(1);
  });

  it('mantiene la camara lenta el tiempo pedido y luego vuelve a 1', () => {
    const d = new TimeDirector();
    d.slowMotion(0.3, 0.5);
    d.update(0.4);
    expect(d.scale).toBeCloseTo(0.3);
    d.update(0.2);
    for (let i = 0; i < 30; i += 1) d.update(0.016);
    expect(d.scale).toBe(1);
  });

  it('una peticion mas rapida no pisa a una camara lenta en curso', () => {
    const d = new TimeDirector();
    d.slowMotion(0.2, 1);
    d.slowMotion(0.6, 1);
    expect(d.scale).toBeCloseTo(0.2);
  });

  it('nunca congela del todo (minimo 0.05)', () => {
    const d = new TimeDirector();
    d.slowMotion(0, 1);
    expect(d.scale).toBeGreaterThan(0);
  });
});
