import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@/core/events';

interface TestEvents {
  hit: { tick: number; damage: number };
  deflect: { tick: number };
}

describe('EventBus', () => {
  it('entrega el payload a los listeners suscritos', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('hit', listener);
    bus.emit('hit', { tick: 10, damage: 5 });
    expect(listener).toHaveBeenCalledWith({ tick: 10, damage: 5 });
  });

  it('no entrega eventos de otro tipo', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('deflect', listener);
    bus.emit('hit', { tick: 1, damage: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('la funcion devuelta por on() desuscribe', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    const off = bus.on('deflect', listener);
    off();
    bus.emit('deflect', { tick: 1 });
    expect(listener).not.toHaveBeenCalled();
    expect(bus.listenerCount('deflect')).toBe(0);
  });

  it('once solo dispara una vez', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.once('deflect', listener);
    bus.emit('deflect', { tick: 1 });
    bus.emit('deflect', { tick: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tolera que un listener se desuscriba durante el emit', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const first = vi.fn(() => {
      bus.off('deflect', second);
    });
    bus.on('deflect', first);
    bus.on('deflect', second);
    expect(() => bus.emit('deflect', { tick: 1 })).not.toThrow();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('clear elimina todos los listeners', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('hit', vi.fn());
    bus.clear();
    expect(bus.listenerCount('hit')).toBe(0);
  });
});
