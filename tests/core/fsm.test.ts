import { describe, expect, it, vi } from 'vitest';
import { StateMachine } from '@/core/fsm';
import type { State } from '@/core/fsm';

type Id = 'a' | 'b' | 'c';
interface Ctx {
  goB: boolean;
  goC: boolean;
  log: string[];
}

function machineWith(context: Ctx): StateMachine<Ctx, Id> {
  const states: State<Ctx, Id>[] = [
    {
      id: 'a',
      transitions: [{ to: 'b', when: (ctx) => ctx.goB }],
      enter: (ctx) => ctx.log.push('enter:a'),
      update: (ctx) => ctx.log.push('update:a'),
      exit: (ctx) => ctx.log.push('exit:a'),
    },
    {
      id: 'b',
      transitions: [{ to: 'c', when: (ctx) => ctx.goC }],
      enter: (ctx) => ctx.log.push('enter:b'),
      update: (ctx) => ctx.log.push('update:b'),
      exit: (ctx) => ctx.log.push('exit:b'),
    },
    {
      id: 'c',
      enter: (ctx) => ctx.log.push('enter:c'),
      update: (ctx) => ctx.log.push('update:c'),
    },
  ];
  return new StateMachine<Ctx, Id>(states, 'a', context);
}

describe('StateMachine', () => {
  it('entra en el estado inicial al construirse', () => {
    const ctx: Ctx = { goB: false, goC: false, log: [] };
    const machine = machineWith(ctx);
    expect(machine.current).toBe('a');
    expect(ctx.log).toEqual(['enter:a']);
  });

  it('ejecuta el update del estado activo en cada tick', () => {
    const ctx: Ctx = { goB: false, goC: false, log: [] };
    const machine = machineWith(ctx);
    machine.update(1);
    machine.update(2);
    expect(ctx.log.filter((l) => l === 'update:a')).toHaveLength(2);
  });

  it('transiciona y llama exit/enter en el orden correcto', () => {
    const ctx: Ctx = { goB: true, goC: false, log: [] };
    const machine = machineWith(ctx);
    machine.update(1);
    expect(machine.current).toBe('b');
    expect(ctx.log).toEqual(['enter:a', 'exit:a', 'enter:b', 'update:b']);
  });

  it('encadena transiciones dentro del mismo tick', () => {
    const ctx: Ctx = { goB: true, goC: true, log: [] };
    const machine = machineWith(ctx);
    machine.update(1);
    expect(machine.current).toBe('c');
    expect(ctx.log).toContain('update:c');
  });

  it('ticksInState se reinicia al cambiar de estado', () => {
    const ctx: Ctx = { goB: false, goC: false, log: [] };
    const machine = machineWith(ctx);
    machine.update(1);
    machine.update(2);
    expect(machine.ticksInState).toBe(2);
    ctx.goB = true;
    machine.update(3);
    expect(machine.current).toBe('b');
    expect(machine.ticksInState).toBe(1);
  });

  it('requestTransition se aplica al final del update', () => {
    const ctx: Ctx = { goB: false, goC: false, log: [] };
    const states: State<Ctx, Id>[] = [
      {
        id: 'a',
        update: (c) => {
          c.log.push('update:a');
          machine.requestTransition('b');
        },
      },
      { id: 'b', update: (c) => c.log.push('update:b') },
    ];
    const machine = new StateMachine<Ctx, Id>(states, 'a', ctx);
    machine.update(1);
    expect(machine.current).toBe('b');
    expect(ctx.log).toEqual(['update:a']);
  });

  it('force ignora las condiciones', () => {
    const ctx: Ctx = { goB: false, goC: false, log: [] };
    const machine = machineWith(ctx);
    machine.force('c', 5);
    expect(machine.current).toBe('c');
  });

  it('no entra en bucle infinito con transiciones circulares', () => {
    const ctx = { log: [] as string[] };
    type PingPong = 'ping' | 'pong';
    const states: State<typeof ctx, PingPong>[] = [
      { id: 'ping', transitions: [{ to: 'pong', when: () => true }] },
      { id: 'pong', transitions: [{ to: 'ping', when: () => true }] },
    ];
    const machine = new StateMachine(states, 'ping', ctx);
    expect(() => machine.update(1)).not.toThrow();
  });

  it('registra el historial de cambios con su tick', () => {
    const ctx: Ctx = { goB: true, goC: false, log: [] };
    const machine = machineWith(ctx);
    machine.update(42);
    expect(machine.lastChanges.at(-1)).toEqual({ from: 'a', to: 'b', tick: 42 });
  });

  it('rechaza estados duplicados y estados desconocidos', () => {
    const dup: State<Ctx, Id>[] = [{ id: 'a' }, { id: 'a' }];
    expect(() => new StateMachine(dup, 'a', { goB: false, goC: false, log: [] })).toThrow();
    expect(
      () => new StateMachine([{ id: 'a' }], 'b', { goB: false, goC: false, log: [] }),
    ).toThrow();
  });

  it('no llama exit si la transicion apunta al estado actual', () => {
    const ctx = { log: [] as string[] };
    const exit = vi.fn();
    const states: State<typeof ctx, 'solo'>[] = [
      { id: 'solo', transitions: [{ to: 'solo', when: () => true }], exit },
    ];
    const machine = new StateMachine(states, 'solo', ctx);
    machine.update(1);
    expect(exit).not.toHaveBeenCalled();
  });
});
