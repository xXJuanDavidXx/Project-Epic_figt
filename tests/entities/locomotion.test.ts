import { describe, expect, it } from 'vitest';
import {
  GroundMemory,
  accelerateHorizontal,
  cameraRelativeDirection,
  jumpSpeedForHeight,
  moveTowards,
  rotateTowards,
  shortestAngleDelta,
  yawFromDirection,
} from '@/entities/player/locomotion';

describe('jumpSpeedForHeight', () => {
  it('da la velocidad exacta para alcanzar la altura pedida', () => {
    // v = sqrt(2*g*h); con g=24 y h=1.7 -> 9.03 m/s
    expect(jumpSpeedForHeight(1.7, -24)).toBeCloseTo(Math.sqrt(2 * 24 * 1.7), 6);
  });

  it('simulando la caida, el apice coincide con la altura pedida', () => {
    const gravity = -24;
    const dt = 1 / 60;
    let y = 0;
    let vy = jumpSpeedForHeight(1.7, gravity);
    let apex = 0;
    while (vy > 0) {
      vy += gravity * dt;
      y += vy * dt;
      apex = Math.max(apex, y);
    }
    // Margen por la integracion discreta a 60 Hz.
    expect(apex).toBeGreaterThan(1.6);
    expect(apex).toBeLessThan(1.75);
  });

  it('acepta altura cero sin romperse', () => {
    expect(jumpSpeedForHeight(0, -24)).toBe(0);
  });
});

describe('moveTowards', () => {
  it('no se pasa del objetivo', () => {
    expect(moveTowards(0, 1, 5)).toBe(1);
    expect(moveTowards(0, -1, 5)).toBe(-1);
  });

  it('avanza como mucho maxDelta', () => {
    expect(moveTowards(0, 10, 2)).toBe(2);
    expect(moveTowards(0, -10, 2)).toBe(-2);
  });
});

describe('accelerateHorizontal', () => {
  it('acelera hacia la velocidad deseada', () => {
    const velocity = { x: 0, z: 0 };
    accelerateHorizontal(velocity, { x: 4.6, z: 0 }, 70, 55, 1 / 60);
    expect(velocity.x).toBeCloseTo(70 / 60, 6);
  });

  it('alcanza la velocidad maxima en pocos ticks (respuesta inmediata)', () => {
    const velocity = { x: 0, z: 0 };
    const desired = { x: 4.6, z: 0 };
    let ticks = 0;
    while (velocity.x < 4.6 && ticks < 60) {
      accelerateHorizontal(velocity, desired, 70, 55, 1 / 60);
      ticks += 1;
    }
    expect(ticks).toBeLessThanOrEqual(5);
  });

  it('frena con la deceleracion cuando no hay input', () => {
    const velocity = { x: 4.6, z: 0 };
    accelerateHorizontal(velocity, { x: 0, z: 0 }, 70, 55, 1 / 60);
    expect(velocity.x).toBeCloseTo(4.6 - 55 / 60, 6);
  });
});

describe('cameraRelativeDirection', () => {
  it('con yaw 0, adelante es -Z', () => {
    const dir = cameraRelativeDirection(0, 1, 0);
    expect(dir.x).toBeCloseTo(0, 6);
    expect(dir.z).toBeCloseTo(-1, 6);
  });

  it('con yaw 0, derecha es +X', () => {
    const dir = cameraRelativeDirection(1, 0, 0);
    expect(dir.x).toBeCloseTo(1, 6);
    expect(dir.z).toBeCloseTo(0, 6);
  });

  it('girar la camara 90 grados gira la direccion', () => {
    const dir = cameraRelativeDirection(0, 1, Math.PI / 2);
    expect(dir.x).toBeCloseTo(-1, 6);
    expect(dir.z).toBeCloseTo(0, 6);
  });

  it('siempre devuelve un vector normalizado', () => {
    const dir = cameraRelativeDirection(1, 1, 0.7);
    expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1, 6);
  });

  it('sin input devuelve cero', () => {
    const dir = cameraRelativeDirection(0, 0, 1.3);
    expect(dir).toEqual({ x: 0, z: 0 });
  });
});

describe('yawFromDirection', () => {
  it('es coherente con cameraRelativeDirection', () => {
    for (const yaw of [0, 0.5, -1.2, Math.PI / 2, 3]) {
      const dir = cameraRelativeDirection(0, 1, yaw);
      expect(shortestAngleDelta(yawFromDirection(dir), yaw)).toBeCloseTo(0, 6);
    }
  });
});

describe('shortestAngleDelta', () => {
  it('cruza el limite -PI/PI por el camino corto', () => {
    expect(shortestAngleDelta(3.1, -3.1)).toBeCloseTo(0.0831853, 5);
    expect(shortestAngleDelta(-3.1, 3.1)).toBeCloseTo(-0.0831853, 5);
  });
});

describe('rotateTowards', () => {
  it('no se pasa del angulo objetivo', () => {
    expect(rotateTowards(0, 0.1, 1)).toBeCloseTo(0.1, 6);
  });

  it('gira por el lado corto', () => {
    const result = rotateTowards(3.1, -3.1, 0.05);
    expect(result).toBeGreaterThan(3.1);
  });
});

describe('GroundMemory (coyote time)', () => {
  it('permite saltar mientras esta en el suelo', () => {
    const memory = new GroundMemory();
    memory.update(true);
    expect(memory.canJump(6)).toBe(true);
  });

  it('permite saltar durante los ticks de coyote tras dejar el suelo', () => {
    const memory = new GroundMemory();
    memory.update(true);
    for (let i = 0; i < 6; i += 1) memory.update(false);
    expect(memory.canJump(6)).toBe(true);
  });

  it('deja de permitirlo pasada la ventana de coyote', () => {
    const memory = new GroundMemory();
    memory.update(true);
    for (let i = 0; i < 7; i += 1) memory.update(false);
    expect(memory.canJump(6)).toBe(false);
  });

  it('no permite saltar si nunca toco el suelo', () => {
    const memory = new GroundMemory();
    memory.update(false);
    expect(memory.canJump(6)).toBe(false);
  });

  it('un salto gastado impide el doble salto aunque queden ticks de coyote', () => {
    const memory = new GroundMemory();
    memory.update(true);
    memory.spendJump();
    memory.update(false);
    expect(memory.canJump(6)).toBe(false);
  });

  it('tocar suelo recarga el salto', () => {
    const memory = new GroundMemory();
    memory.update(true);
    memory.spendJump();
    memory.update(true);
    expect(memory.canJump(6)).toBe(true);
  });
});
