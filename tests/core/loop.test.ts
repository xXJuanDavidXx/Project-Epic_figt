import { describe, expect, it } from 'vitest';
import { FixedStepAccumulator, GameLoop } from '@/core/loop';
import type { TickContext } from '@/core/loop';

const TICK = 1 / 60;

describe('FixedStepAccumulator', () => {
  it('simula exactamente un tick cuando pasa justo un tick', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60 });
    expect(clock.advance(TICK)).toBe(1);
    expect(clock.tick).toBe(1);
    expect(clock.alpha).toBeCloseTo(0, 6);
  });

  it('no simula nada si el delta es menor que un tick y acumula el resto en alpha', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60 });
    expect(clock.advance(TICK / 2)).toBe(0);
    expect(clock.tick).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.5, 6);
  });

  it('acumula fracciones hasta completar un tick (sin perder tiempo)', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60 });
    clock.advance(TICK * 0.6);
    expect(clock.advance(TICK * 0.6)).toBe(1);
    expect(clock.alpha).toBeCloseTo(0.2, 5);
  });

  it('mantiene alpha siempre en [0, 1)', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60 });
    for (let i = 0; i < 500; i += 1) {
      clock.advance(0.0137);
      expect(clock.alpha).toBeGreaterThanOrEqual(0);
      expect(clock.alpha).toBeLessThan(1);
    }
  });

  it('recorta el delta de frame al maximo configurado', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60, maxSubSteps: 100, maxFrameDelta: 0.25 });
    // 10 s de pestania en segundo plano -> solo se simulan 0.25 s = 15 ticks.
    expect(clock.advance(10)).toBe(15);
  });

  it('descarta el backlog en vez de entrar en spiral of death', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60, maxSubSteps: 5, maxFrameDelta: 1 });
    const steps = clock.advance(0.5); // 30 ticks pedidos, 5 permitidos
    expect(steps).toBe(5);
    expect(clock.droppedTicks).toBe(25);
    expect(clock.alpha).toBeLessThan(1);
  });

  it('timeScale 0 congela la simulacion pero no rompe alpha (hitstop)', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60 });
    clock.advance(TICK * 0.5);
    const frozenAlpha = clock.alpha;
    clock.timeScale = 0;
    expect(clock.advance(TICK * 10)).toBe(0);
    expect(clock.tick).toBe(0);
    expect(clock.alpha).toBeCloseTo(frozenAlpha, 6);
  });

  it('timeScale 0.25 simula un cuarto de los ticks (slow motion)', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60, maxSubSteps: 100 });
    clock.timeScale = 0.25;
    expect(clock.advance(TICK * 8)).toBe(2);
  });

  it('ignora deltas invalidos o negativos', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60 });
    expect(clock.advance(Number.NaN)).toBe(0);
    expect(clock.advance(-1)).toBe(0);
    expect(clock.tick).toBe(0);
  });

  it('reset vuelve al estado inicial', () => {
    const clock = new FixedStepAccumulator({ tickRate: 60 });
    clock.advance(0.5);
    clock.reset();
    expect(clock.tick).toBe(0);
    expect(clock.alpha).toBe(0);
    expect(clock.droppedTicks).toBe(0);
  });

  it('rechaza un tickRate invalido', () => {
    expect(() => new FixedStepAccumulator({ tickRate: 0 })).toThrow();
  });
});

describe('GameLoop', () => {
  function makeLoop(): { loop: GameLoop; ticks: number[]; frames: number[] } {
    const ticks: number[] = [];
    const frames: number[] = [];
    const loop = new GameLoop({
      tickRate: 60,
      maxSubSteps: 100,
      now: () => 0,
      schedule: () => 0,
      cancel: () => undefined,
    });
    loop.add({
      fixedUpdate: (ctx: TickContext) => {
        ticks.push(ctx.tick);
      },
    });
    loop.add({
      renderUpdate: (ctx) => {
        frames.push(ctx.alpha);
      },
    });
    return { loop, ticks, frames };
  }

  it('entrega ticks consecutivos y un unico render por frame', () => {
    const { loop, ticks, frames } = makeLoop();
    loop.frame(100); // 0.1 s -> 6 ticks
    expect(ticks).toEqual([1, 2, 3, 4, 5, 6]);
    expect(frames).toHaveLength(1);
  });

  it('el dt de cada tick es constante e igual al timestep fijo', () => {
    const dts: number[] = [];
    const loop = new GameLoop({ tickRate: 60, now: () => 0, schedule: () => 0 });
    loop.add({
      fixedUpdate: (ctx) => {
        dts.push(ctx.dt);
      },
    });
    loop.frame(50);
    expect(dts.length).toBeGreaterThan(0);
    expect(new Set(dts.map((d) => d.toFixed(8))).size).toBe(1);
    expect(dts[0]).toBeCloseTo(TICK, 8);
  });

  it('renderiza aunque no haya ticks que simular', () => {
    const { loop, ticks, frames } = makeLoop();
    loop.frame(1); // 1 ms: menos de un tick
    expect(ticks).toEqual([]);
    expect(frames).toHaveLength(1);
  });

  it('stepOnce avanza un tick exacto sin consumir tiempo real', () => {
    const { loop, ticks } = makeLoop();
    loop.stepOnce();
    loop.stepOnce();
    expect(ticks).toEqual([1, 2]);
  });

  it('rechaza sistemas que no implementan nada', () => {
    const { loop } = makeLoop();
    expect(() => loop.add({} as never)).toThrow();
  });

  it('remove desregistra el sistema', () => {
    const { loop, ticks } = makeLoop();
    const system = {
      fixedUpdate: () => {
        ticks.push(-1);
      },
    };
    loop.add(system);
    loop.remove(system);
    loop.frame(100);
    expect(ticks).not.toContain(-1);
  });
});

describe('GameLoop — arranque', () => {
  it('no simula el tiempo de carga del primer frame', () => {
    const ticks: number[] = [];
    const pending: ((t: number) => void)[] = [];
    const loop = new GameLoop({
      tickRate: 60,
      now: () => 0,
      schedule: (cb) => {
        pending.push(cb);
        return 1;
      },
      cancel: () => undefined,
    });
    loop.add({
      fixedUpdate: (ctx) => {
        ticks.push(ctx.tick);
      },
    });
    loop.start();
    // El primer frame llega 2 s despues (carga de WASM, shaders): no debe simularse.
    pending.shift()?.(2000);
    expect(ticks).toEqual([]);
    pending.shift()?.(2020);
    expect(ticks).toEqual([1]);
  });
});
