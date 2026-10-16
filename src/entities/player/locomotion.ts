/**
 * Matematicas de locomocion. Modulo PURO: sin Three.js, sin Rapier, sin DOM.
 * Todo lo que decide como se mueve el jugador y es testeable vive aqui.
 */

export interface Vec2 {
  x: number;
  z: number;
}

/** Velocidad vertical inicial para alcanzar `height` metros con esa gravedad. */
export function jumpSpeedForHeight(height: number, gravity: number): number {
  return Math.sqrt(2 * Math.abs(gravity) * Math.max(height, 0));
}

/** Acerca `current` a `target` sin pasarse, como mucho `maxDelta`. */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/**
 * Acelera la velocidad horizontal hacia la deseada. Acelerar y frenar usan ritmos
 * distintos: arrancar rapido y frenar algo mas lento se siente mejor que un lerp unico.
 */
export function accelerateHorizontal(
  velocity: Vec2,
  desired: Vec2,
  accel: number,
  decel: number,
  dt: number,
): void {
  const wantsToMove = desired.x !== 0 || desired.z !== 0;
  const rate = (wantsToMove ? accel : decel) * dt;
  velocity.x = moveTowards(velocity.x, desired.x, rate);
  velocity.z = moveTowards(velocity.z, desired.z, rate);
}

/** Diferencia angular mas corta entre dos angulos, en (-PI, PI]. */
export function shortestAngleDelta(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta <= -Math.PI) delta += twoPi;
  return delta;
}

/** Gira `current` hacia `target` como mucho `maxDelta` radianes. */
export function rotateTowards(current: number, target: number, maxDelta: number): number {
  const delta = shortestAngleDelta(current, target);
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

/**
 * Convierte el input del stick (x lateral, y adelante) a una direccion del mundo,
 * usando el yaw de la camara. Es lo que hace que "adelante" sea siempre hacia donde miras.
 */
export function cameraRelativeDirection(inputX: number, inputY: number, yaw: number): Vec2 {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // Adelante de la camara en el plano XZ es (-sin(yaw), -cos(yaw)).
  const forwardX = -sin;
  const forwardZ = -cos;
  const rightX = cos;
  const rightZ = -sin;
  const x = forwardX * inputY + rightX * inputX;
  const z = forwardZ * inputY + rightZ * inputX;
  const length = Math.hypot(x, z);
  if (length < 1e-6) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

/** Angulo de giro (yaw) para mirar en una direccion del mundo. */
export function yawFromDirection(direction: Vec2): number {
  return Math.atan2(-direction.x, -direction.z);
}

/**
 * Memoria de suelo: implementa coyote time (poder saltar unos ticks despues de
 * dejar el borde) y evita el doble salto.
 */
export class GroundMemory {
  private ticksSinceGrounded = Number.POSITIVE_INFINITY;
  private jumpSpent = false;

  /** Llamar una vez por tick con el estado real del character controller. */
  update(grounded: boolean): void {
    if (grounded) {
      this.ticksSinceGrounded = 0;
      this.jumpSpent = false;
    } else if (this.ticksSinceGrounded !== Number.POSITIVE_INFINITY) {
      this.ticksSinceGrounded += 1;
    }
  }

  /** ¿Puede saltar ahora, contando el coyote time? */
  canJump(coyoteTicks: number): boolean {
    return !this.jumpSpent && this.ticksSinceGrounded <= coyoteTicks;
  }

  /** Marca el salto como gastado: no se puede volver a saltar hasta tocar suelo. */
  spendJump(): void {
    this.jumpSpent = true;
    this.ticksSinceGrounded = Number.POSITIVE_INFINITY;
  }

  get airborneTicks(): number {
    return this.ticksSinceGrounded;
  }

  reset(): void {
    this.ticksSinceGrounded = Number.POSITIVE_INFINITY;
    this.jumpSpent = false;
  }
}
