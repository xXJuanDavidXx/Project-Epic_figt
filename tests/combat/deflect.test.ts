import { describe, expect, it } from 'vitest';
import { GuardTracker } from '@/combat/deflect';
import type { DeflectParams } from '@/combat/deflect';

const PARAMS: DeflectParams = {
  windowTicks: 12,
  perfectTicks: 4,
  spamPenaltyTicks: 3,
  minWindowTicks: 4,
  spamResetTicks: 30,
};

describe('GuardTracker — ventana de deflect', () => {
  it('sin pulsar no hay deflect ni bloqueo', () => {
    const guard = new GuardTracker(PARAMS);
    expect(guard.evaluate(100)).toEqual({ deflect: null, blocking: false });
  });

  it('un golpe en los primeros ticks es deflect perfecto', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(100);
    expect(guard.evaluate(100).deflect).toBe('perfect');
    expect(guard.evaluate(103).deflect).toBe('perfect');
  });

  it('despues del tramo perfecto y dentro de la ventana es deflect normal', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(100);
    expect(guard.evaluate(104).deflect).toBe('normal');
    expect(guard.evaluate(111).deflect).toBe('normal');
  });

  it('fuera de la ventana con guardia mantenida es bloqueo', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(100);
    expect(guard.evaluate(112)).toEqual({ deflect: null, blocking: true });
  });

  it('fuera de la ventana y soltado no defiende nada', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(100);
    guard.release();
    expect(guard.evaluate(112)).toEqual({ deflect: null, blocking: false });
  });

  it('un toque rapido (soltar enseguida) sigue desviando dentro de la ventana', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(100);
    guard.release();
    expect(guard.evaluate(106).deflect).toBe('normal');
  });

  it('un golpe ANTES de pulsar no cuenta como deflect', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(100);
    expect(guard.evaluate(99).deflect).toBeNull();
  });
});

describe('GuardTracker — anti-spam', () => {
  it('cada pulsacion seguida recorta la ventana de la siguiente', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(0);
    expect(guard.activeWindowTicks).toBe(12);
    guard.press(10);
    expect(guard.activeWindowTicks).toBe(9);
    guard.press(20);
    expect(guard.activeWindowTicks).toBe(6);
  });

  it('la ventana nunca baja del minimo', () => {
    const guard = new GuardTracker(PARAMS);
    for (let t = 0; t < 100; t += 5) guard.press(t);
    expect(guard.activeWindowTicks).toBe(PARAMS.minWindowTicks);
  });

  it('el spam funciona un poco: con la ventana recortada aun se puede desviar', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(0);
    guard.press(8);
    guard.press(16);
    expect(guard.evaluate(18).deflect).not.toBeNull();
    expect(guard.evaluate(23).deflect).toBeNull();
  });

  it('tras un rato sin pulsar la penalizacion se olvida', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(0);
    guard.press(5);
    guard.press(10);
    guard.press(10 + PARAMS.spamResetTicks);
    expect(guard.activeWindowTicks).toBe(12);
  });

  it('un deflect con exito perdona el spam', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(0);
    guard.press(5);
    guard.onDeflectSuccess();
    guard.press(10);
    expect(guard.activeWindowTicks).toBe(12);
  });

  it('el tramo perfecto nunca supera la ventana recortada', () => {
    const guard = new GuardTracker({ ...PARAMS, minWindowTicks: 2, perfectTicks: 4 });
    for (let t = 0; t < 60; t += 3) guard.press(t);
    const last = 57;
    expect(guard.evaluate(last + 1).deflect).toBe('perfect');
    expect(guard.evaluate(last + 2).deflect).toBeNull();
  });

  it('cancelWindow cierra la ventana pero no la guardia', () => {
    const guard = new GuardTracker(PARAMS);
    guard.press(0);
    guard.cancelWindow();
    expect(guard.evaluate(2)).toEqual({ deflect: null, blocking: true });
  });

  it('setHeld bloquea aunque no haya habido pulsacion (guardia ya mantenida)', () => {
    const guard = new GuardTracker(PARAMS);
    guard.setHeld(true);
    expect(guard.evaluate(5)).toEqual({ deflect: null, blocking: true });
    guard.setHeld(false);
    expect(guard.evaluate(6).blocking).toBe(false);
  });
});
