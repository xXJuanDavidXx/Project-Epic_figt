import type { HumanoidRig } from '@/render/character/humanoid';

/**
 * Animacion secundaria procedural (solo visual): la bufanda o el faldon se van hacia
 * atras con la velocidad y ondulan. Barato y da mucha vida a un personaje de primitivas.
 */
export function updateTrail(
  rig: HumanoidRig,
  velocity: { x: number; y: number; z: number },
  time: number,
  yaw: number,
): void {
  // Velocidad en espacio local del personaje (adelante = -Z).
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const forwardSpeed = -(velocity.x * sin + velocity.z * cos);
  const lateral = velocity.x * cos - velocity.z * sin;
  const speed = Math.min(Math.hypot(velocity.x, velocity.z) / 8, 1);
  const lift = Math.min(Math.max(-velocity.y / 12, -0.4), 0.6);

  for (let i = 0; i < rig.trail.length; i += 1) {
    const joint = rig.trail[i];
    if (!joint) continue;
    const phase = time * (4 + speed * 6) - i * 0.9;
    const wave = Math.sin(phase) * (0.08 + speed * 0.18);
    const back = 0.15 + speed * (0.45 + i * 0.12) + lift * 0.4;
    // Rotacion X negativa = la pieza colgante se va hacia atras (+Z), lejos del cuerpo.
    const drag =
      i === 0 ? 0.25 + back * Math.max(Math.sign(forwardSpeed), 0.3) : back * 0.35 + wave;
    joint.rotation.x = -drag;
    joint.rotation.z = Math.sin(phase * 0.7) * 0.08 - lateral * 0.03;
  }
}
