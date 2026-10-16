import { cameraConfig } from '@/config/camera';
import type { InputState } from '@/core/input';
import type { FixedUpdateSystem, TickContext } from '@/core/loop';

/**
 * Estado de orientacion de la camara (yaw/pitch). Se actualiza en la simulacion
 * porque el jugador se mueve relativo a este yaw: debe ser determinista.
 *
 * La posicion final de la camara la calcula `ThirdPersonCamera` en el render.
 * En M3, el lock-on escribira aqui el yaw objetivo en vez del input del raton.
 */
export class CameraRig implements FixedUpdateSystem {
  yaw = 0;
  pitch = 0.12;
  /** Yaw/pitch del tick anterior, para interpolar el render. */
  prevYaw = 0;
  prevPitch = 0.12;

  constructor(private readonly input: InputState) {}

  fixedUpdate(ctx: TickContext): void {
    this.prevYaw = this.yaw;
    this.prevPitch = this.pitch;

    const invert = cameraConfig.invertY ? -1 : 1;
    const mouseYaw = -this.input.lookDeltaX * cameraConfig.mouseSensitivity;
    const mousePitch = -this.input.lookDeltaY * cameraConfig.mouseSensitivity * invert;
    const stickYaw = -this.input.lookStickX * cameraConfig.stickSensitivity * ctx.dt;
    const stickPitch = -this.input.lookStickY * cameraConfig.stickSensitivity * ctx.dt * invert;

    this.yaw = wrapAngle(this.yaw + mouseYaw + stickYaw);
    this.pitch = clamp(
      this.pitch + mousePitch + stickPitch,
      degToRad(cameraConfig.pitchMinDeg),
      degToRad(cameraConfig.pitchMaxDeg),
    );
  }
}

function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a > Math.PI) a -= twoPi;
  if (a <= -Math.PI) a += twoPi;
  return a;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
