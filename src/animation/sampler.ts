import type {
  Clip,
  Ease,
  JointName,
  JointRotation,
  OffHandIK,
  Pose,
  SwordIK,
  Vec3Tuple,
} from '@/animation/types';

/** Muestreo y mezcla de poses. PURO: lo mismo en tests que en el juego. */

export function applyEase(ease: Ease, u: number): number {
  const t = Math.min(Math.max(u, 0), 1);
  switch (ease) {
    case 'linear':
      return t;
    case 'in':
      return t * t;
    case 'out':
      return 1 - (1 - t) * (1 - t) * (1 - t);
    case 'inOut':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'snap':
      // Arranque explosivo: casi todo el recorrido en el primer tercio. Para tajos y deflects.
      return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 'hold':
      return t >= 1 ? 1 : 0;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(a: Vec3Tuple, b: Vec3Tuple, t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Interpolacion de direcciones: lerp + normalizar. Las claves no deben ir a mas de ~120°. */
function nlerp3(a: Vec3Tuple, b: Vec3Tuple, t: number): [number, number, number] {
  const v = lerp3(a, b, t);
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length < 1e-6) return [a[0], a[1], a[2]];
  return [v[0] / length, v[1] / length, v[2] / length];
}

const ZERO: JointRotation = [0, 0, 0];

export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const joints: Partial<Record<JointName, JointRotation>> = {};
  const names = new Set<JointName>([
    ...(Object.keys(a.joints) as JointName[]),
    ...(Object.keys(b.joints) as JointName[]),
  ]);
  for (const name of names) {
    joints[name] = lerp3(a.joints[name] ?? ZERO, b.joints[name] ?? ZERO, t);
  }
  return {
    joints,
    root: lerp3(a.root, b.root, t),
    sword: blendSword(a.sword, b.sword, t),
    offHand: blendOffHand(a.offHand, b.offHand, t),
  };
}

function blendSword(a: SwordIK, b: SwordIK, t: number): SwordIK {
  return {
    hand: lerp3(a.hand, b.hand, t),
    blade: nlerp3(a.blade, b.blade, t),
    spine: nlerp3(a.spine, b.spine, t),
    pole: nlerp3(a.pole, b.pole, t),
  };
}

function blendOffHand(a: OffHandIK, b: OffHandIK, t: number): OffHandIK {
  return {
    weight: lerp(a.weight, b.weight, t),
    hand: lerp3(a.hand, b.hand, t),
    // El agarre al mango es binario: se decide por el lado que pesa mas.
    grip: t < 0.5 ? a.grip : b.grip,
    pole: nlerp3(a.pole, b.pole, t),
  };
}

/**
 * Pose de un clip en el tiempo `t` (en ticks, admite fraccion para el render interpolado).
 * Los clips en bucle envuelven; los demas se quedan en la ultima clave.
 */
export function sampleClip(clip: Clip, t: number): Pose {
  const keys = clip.keys;
  const first = keys[0];
  if (!first) throw new Error(`Clip sin claves: ${clip.name}`);
  if (keys.length === 1) return first.pose;

  let time = t;
  if (clip.loop) {
    time = ((t % clip.durationTicks) + clip.durationTicks) % clip.durationTicks;
  } else if (time <= first.t) {
    return first.pose;
  }

  for (let i = 0; i < keys.length - 1; i += 1) {
    const from = keys[i];
    const to = keys[i + 1];
    if (!from || !to) continue;
    if (time >= from.t && time <= to.t) {
      const span = to.t - from.t;
      const u = span > 0 ? (time - from.t) / span : 1;
      return blendPoses(from.pose, to.pose, applyEase(to.ease ?? 'inOut', u));
    }
  }

  const last = keys[keys.length - 1];
  if (!last) return first.pose;
  if (clip.loop) {
    // Tramo de cierre del bucle: de la ultima clave a la primera.
    const span = clip.durationTicks - last.t;
    const u = span > 0 ? (time - last.t) / span : 1;
    return blendPoses(last.pose, first.pose, applyEase(first.ease ?? 'inOut', u));
  }
  return last.pose;
}

/** ¿Ha terminado un clip de una sola pasada? */
export function clipFinished(clip: Clip, t: number): boolean {
  return !clip.loop && t >= clip.durationTicks;
}
