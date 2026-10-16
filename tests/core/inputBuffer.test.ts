import { describe, expect, it } from 'vitest';
import { InputBuffer, applyDeadzone } from '@/core/input';

describe('InputBuffer', () => {
  it('consume una pulsacion dentro de la ventana', () => {
    const buffer = new InputBuffer(9);
    buffer.press('attack', 100);
    expect(buffer.consume('attack', 105)).toBe(true);
  });

  it('consume justo en el ultimo tick de la ventana', () => {
    const buffer = new InputBuffer(9);
    buffer.press('attack', 100);
    expect(buffer.consume('attack', 109)).toBe(true);
  });

  it('descarta la pulsacion un tick despues de expirar', () => {
    const buffer = new InputBuffer(9);
    buffer.press('attack', 100);
    expect(buffer.consume('attack', 110)).toBe(false);
  });

  it('una pulsacion solo se ejecuta una vez', () => {
    const buffer = new InputBuffer(9);
    buffer.press('jump', 10);
    expect(buffer.consume('jump', 12)).toBe(true);
    expect(buffer.consume('jump', 13)).toBe(false);
  });

  it('peek no consume', () => {
    const buffer = new InputBuffer(9);
    buffer.press('dodge', 10);
    expect(buffer.peek('dodge', 12)).toBe(true);
    expect(buffer.peek('dodge', 12)).toBe(true);
    expect(buffer.consume('dodge', 12)).toBe(true);
  });

  it('una pulsacion nueva reemplaza a la anterior (la mas reciente manda)', () => {
    const buffer = new InputBuffer(9);
    buffer.press('attack', 10);
    buffer.press('attack', 18);
    expect(buffer.consume('attack', 26)).toBe(true);
  });

  it('las acciones son independientes', () => {
    const buffer = new InputBuffer(9);
    buffer.press('attack', 10);
    expect(buffer.consume('guard', 11)).toBe(false);
    expect(buffer.consume('attack', 11)).toBe(true);
  });

  it('ageOf da la antiguedad de la pulsacion pendiente', () => {
    const buffer = new InputBuffer(9);
    buffer.press('guard', 40);
    expect(buffer.ageOf('guard', 43)).toBe(3);
    expect(buffer.ageOf('attack', 43)).toBeNull();
  });

  it('cambiar la ventana afecta a las pulsaciones ya registradas', () => {
    const buffer = new InputBuffer(9);
    buffer.press('attack', 100);
    buffer.setWindow(2);
    expect(buffer.consume('attack', 105)).toBe(false);
  });

  it('clear vacia el buffer', () => {
    const buffer = new InputBuffer(9);
    buffer.press('attack', 1);
    buffer.clear();
    expect(buffer.consume('attack', 2)).toBe(false);
  });
});

describe('applyDeadzone', () => {
  it('anula los valores dentro de la zona muerta', () => {
    expect(applyDeadzone(0.1, 0.18)).toBe(0);
    expect(applyDeadzone(-0.18, 0.18)).toBe(0);
  });

  it('reescala el resto del recorrido para no perder precision', () => {
    expect(applyDeadzone(1, 0.2)).toBeCloseTo(1, 6);
    expect(applyDeadzone(0.6, 0.2)).toBeCloseTo(0.5, 6);
    expect(applyDeadzone(-0.6, 0.2)).toBeCloseTo(-0.5, 6);
  });
});
