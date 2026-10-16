import type {
  Clip,
  Ease,
  JointName,
  JointRotation,
  Keyframe,
  OffHandIK,
  Pose,
  SwordIK,
  Vec3Tuple,
} from '@/animation/types';
import type { AttackDef } from '@/combat/types';

/** Utilidades para escribir poses y clips a mano de forma legible. Puro. */

export interface PoseSpec {
  joints?: Partial<Record<JointName, JointRotation>>;
  root?: Vec3Tuple;
  sword: SwordIK;
  offHand?: Partial<OffHandIK>;
}

const DEFAULT_OFFHAND: OffHandIK = {
  weight: 0,
  hand: [-0.25, 1.0, -0.15],
  grip: false,
  pole: [-0.6, -0.5, 0.5],
};

export function pose(spec: PoseSpec): Pose {
  return {
    joints: spec.joints ?? {},
    root: spec.root ?? [0, 0, 0],
    sword: spec.sword,
    offHand: { ...DEFAULT_OFFHAND, ...spec.offHand },
  };
}

/** Variante de una pose: sobrescribe articulaciones sueltas y campos de IK. */
export function vary(
  base: Pose,
  changes: {
    joints?: Partial<Record<JointName, JointRotation>>;
    root?: Vec3Tuple;
    sword?: Partial<SwordIK>;
    offHand?: Partial<OffHandIK>;
  },
): Pose {
  return {
    joints: { ...base.joints, ...changes.joints },
    root: changes.root ?? base.root,
    sword: { ...base.sword, ...changes.sword },
    offHand: { ...base.offHand, ...changes.offHand },
  };
}

export function key(t: number, p: Pose, ease?: Ease): Keyframe {
  return ease ? { t, pose: p, ease } : { t, pose: p };
}

export function clip(name: string, durationTicks: number, loop: boolean, keys: Keyframe[]): Clip {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  return { name, durationTicks, loop, keys: sorted };
}

/** Poses que necesita un clip de ataque. */
export interface AttackPoses {
  ready: Pose;
  windup: Pose;
  /** Pose un pelo mas cargada justo antes de soltar: la anticipacion que se "lee". */
  coil: Pose;
  strikeStart: Pose;
  strikeMid: Pose;
  strikeEnd: Pose;
  followThrough: Pose;
  recover: Pose;
}

/**
 * Construye un clip de ataque A PARTIR DEL AttackDef: las claves caen en los ticks exactos
 * de startup/active/recovery, asi que la hoja visible y la hitbox no pueden desincronizarse.
 */
export function attackClip(name: string, def: AttackDef, poses: AttackPoses): Clip {
  const s = def.startupTicks;
  const a = def.activeTicks;
  const total = s + a + def.recoveryTicks;
  const follow = Math.min(s + a + 6, total - 2);
  return clip(name, total, false, [
    key(0, poses.ready),
    key(Math.max(2, Math.round(s * 0.55)), poses.windup, 'out'),
    key(s - 1, poses.coil, 'inOut'),
    key(s, poses.strikeStart, 'snap'),
    key(s + Math.floor(a / 2), poses.strikeMid, 'linear'),
    key(s + a, poses.strikeEnd, 'linear'),
    key(follow, poses.followThrough, 'out'),
    key(total, poses.recover, 'inOut'),
  ]);
}
