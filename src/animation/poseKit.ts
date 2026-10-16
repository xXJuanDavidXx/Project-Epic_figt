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

export interface AttackClipOptions {
  /**
   * Ticks que se SOSTIENE la pose de impacto tras el ultimo tick activo. Es el "frame de
   * impacto" de la animacion de lucha: el ojo necesita ver el extremo quieto para sentir el
   * golpe. Encaja con el estilo cortado (staccato) del juego.
   */
  holdTicks?: number;
  /** Proporcion del startup en que se alcanza el wind-up (el resto es tension en el coil). */
  windupAt?: number;
}

/**
 * Construye un clip de ataque A PARTIR DEL AttackDef: las claves caen en los ticks exactos
 * de startup/active/recovery, asi que la hoja visible y la hitbox no pueden desincronizarse.
 *
 * Estructura (estilo cortado, sin suavizar):
 *   ready -snap-> windup -lento-> coil -SNAP-> strikeStart -> strikeMid -> strikeEnd
 *   -hold-> (impacto sostenido) -out-> followThrough -out-> recover
 */
export function attackClip(
  name: string,
  def: AttackDef,
  poses: AttackPoses,
  options: AttackClipOptions = {},
): Clip {
  const s = def.startupTicks;
  const a = def.activeTicks;
  const total = s + a + def.recoveryTicks;
  const hold = Math.min(options.holdTicks ?? 3, Math.max(def.recoveryTicks - 8, 0));
  const windupAt = Math.max(2, Math.round(s * (options.windupAt ?? 0.4)));
  const holdEnd = s + a + hold;
  const follow = Math.min(holdEnd + 5, total - 3);
  return clip(name, total, false, [
    key(0, poses.ready),
    key(windupAt, poses.windup, 'snap'),
    key(s - 1, poses.coil, 'linear'),
    key(s, poses.strikeStart, 'snap'),
    key(s + Math.floor(a / 2), poses.strikeMid, 'linear'),
    key(s + a, poses.strikeEnd, 'linear'),
    key(holdEnd, poses.strikeEnd, 'hold'),
    key(follow, poses.followThrough, 'out'),
    key(total, poses.recover, 'out'),
  ]);
}
