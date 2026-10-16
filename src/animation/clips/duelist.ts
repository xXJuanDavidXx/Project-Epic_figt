import { DUMMY_ATTACKS } from '@/combat/attackData';
import { combatConfig } from '@/config/combat';
import type { Clip, Pose } from '@/animation/types';
import { attackClip, clip, key, pose, vary } from '@/animation/poseKit';
import type { AttackPoses } from '@/animation/poseKit';

/**
 * Clips del duelista enmascarado: hoja larga a DOS manos (la izquierda agarra el mango por IK).
 * Movimientos mas amplios y lentos que los del jugador: se leen desde lejos.
 */

const TWO_HANDS = { weight: 1, grip: true, pole: [-0.7, -0.6, 0.2] } as const;

const STANCE = {
  thigh_l: [0.4, 0.05, -0.05],
  shin_l: [-0.6, 0, 0],
  foot_l: [0.2, 0, 0],
  thigh_r: [-0.2, -0.08, 0.08],
  shin_r: [-0.3, 0, 0],
  foot_r: [0.5, 0, 0],
} as const;

export const E_IDLE: Pose = pose({
  root: [0, -0.05, 0],
  joints: {
    ...STANCE,
    hips: [0, 0.15, 0],
    spine: [-0.06, -0.05, 0],
    chest: [-0.04, -0.1, 0],
    head: [0.08, 0, 0],
  },
  sword: {
    hand: [0.08, 1.12, -0.36],
    blade: [-0.08, 0.5, -0.86],
    spine: [0, 0.86, 0.5],
    pole: [0.8, -0.5, 0.2],
  },
  offHand: TWO_HANDS,
});

const E_IDLE_BREATH = vary(E_IDLE, {
  root: [0, -0.065, 0],
  joints: { chest: [-0.01, -0.1, 0] },
  sword: { hand: [0.08, 1.1, -0.36] },
});

function walkPose(leftForward: boolean): Pose {
  const front = { thigh: 0.45, shin: -0.35, foot: 0.0 };
  const back = { thigh: -0.25, shin: -0.45, foot: 0.6 };
  const l = leftForward ? front : back;
  const r = leftForward ? back : front;
  return vary(E_IDLE, {
    root: [0, -0.03, 0],
    joints: {
      thigh_l: [l.thigh, 0.05, -0.05],
      shin_l: [l.shin, 0, 0],
      foot_l: [l.foot, 0, 0],
      thigh_r: [r.thigh, -0.08, 0.08],
      shin_r: [r.shin, 0, 0],
      foot_r: [r.foot, 0, 0],
      hips: [0, leftForward ? 0.2 : 0.08, 0],
    },
  });
}

// ------------------------------------------------------------------ ataques
const SLASH: AttackPoses = {
  ready: E_IDLE,
  windup: vary(E_IDLE, {
    joints: { chest: [-0.02, -0.6, 0], spine: [-0.04, -0.25, 0], hips: [0, -0.05, 0] },
    sword: {
      hand: [0.4, 1.5, 0.05],
      blade: [0.7, 0.6, 0.35],
      spine: [-0.3, 0.2, 0.9],
      pole: [0.7, -0.5, 0.4],
    },
  }),
  coil: vary(E_IDLE, {
    joints: { chest: [-0.02, -0.72, 0], spine: [-0.04, -0.3, 0], hips: [0, -0.1, 0] },
    sword: {
      hand: [0.44, 1.52, 0.1],
      blade: [0.72, 0.55, 0.42],
      spine: [-0.3, 0.2, 0.9],
      pole: [0.7, -0.5, 0.4],
    },
  }),
  strikeStart: vary(E_IDLE, {
    joints: { chest: [-0.08, -0.3, 0], spine: [-0.08, -0.1, 0] },
    sword: {
      hand: [0.36, 1.4, -0.32],
      blade: [0.75, 0.12, -0.65],
      spine: [0.65, 0.1, 0.75],
      pole: [0.7, -0.6, 0.3],
    },
  }),
  strikeMid: vary(E_IDLE, {
    joints: { chest: [-0.12, 0.15, 0], spine: [-0.1, 0.05, 0] },
    sword: {
      hand: [0.02, 1.33, -0.52],
      blade: [0, 0.04, -1],
      spine: [1, 0.05, 0],
      pole: [0.8, -0.5, 0.1],
    },
  }),
  strikeEnd: vary(E_IDLE, {
    joints: { chest: [-0.12, 0.55, 0.05], spine: [-0.1, 0.22, 0] },
    sword: {
      hand: [-0.36, 1.22, -0.34],
      blade: [-0.9, -0.12, -0.35],
      spine: [0.35, 0.05, -0.95],
      pole: [0.8, -0.3, -0.2],
    },
  }),
  followThrough: vary(E_IDLE, {
    joints: { chest: [-0.1, 0.62, 0.05], spine: [-0.1, 0.26, 0] },
    sword: {
      hand: [-0.42, 1.1, -0.1],
      blade: [-0.7, -0.45, 0.55],
      spine: [0, 1, 0],
      pole: [0.7, -0.3, -0.3],
    },
  }),
  recover: E_IDLE,
};

const RISING: AttackPoses = {
  ready: SLASH.followThrough,
  windup: vary(SLASH.followThrough, {
    sword: { hand: [-0.34, 0.98, -0.14], blade: [-0.72, -0.55, 0.4], spine: [0.3, -0.3, 0.9] },
  }),
  coil: vary(SLASH.followThrough, {
    joints: { chest: [-0.12, 0.7, 0.05] },
    sword: { hand: [-0.36, 0.95, -0.1], blade: [-0.65, -0.62, 0.42], spine: [0.3, -0.3, 0.9] },
  }),
  strikeStart: vary(E_IDLE, {
    joints: { chest: [-0.1, 0.32, 0], spine: [-0.1, 0.12, 0] },
    sword: {
      hand: [-0.22, 1.05, -0.44],
      blade: [-0.65, -0.35, -0.67],
      spine: [-0.5, -0.8, 0.3],
      pole: [0.7, -0.6, 0],
    },
  }),
  strikeMid: vary(E_IDLE, {
    joints: { chest: [-0.08, -0.08, 0], spine: [-0.08, -0.04, 0] },
    sword: {
      hand: [0.06, 1.25, -0.56],
      blade: [0.05, 0.3, -1],
      spine: [-0.8, -0.55, 0.1],
      pole: [0.8, -0.5, 0.2],
    },
  }),
  strikeEnd: vary(E_IDLE, {
    joints: { chest: [-0.04, -0.45, 0], spine: [-0.06, -0.2, 0] },
    sword: {
      hand: [0.38, 1.58, -0.32],
      blade: [0.68, 0.7, -0.2],
      spine: [-0.7, 0.6, 0.3],
      pole: [0.8, -0.3, 0.5],
    },
  }),
  followThrough: vary(E_IDLE, {
    joints: { chest: [0, -0.5, 0], spine: [-0.04, -0.22, 0] },
    sword: {
      hand: [0.4, 1.62, -0.1],
      blade: [0.55, 0.7, 0.45],
      spine: [-0.6, 0.4, -0.6],
      pole: [0.8, -0.2, 0.6],
    },
  }),
  recover: E_IDLE,
};

const OVERHEAD: AttackPoses = {
  ready: E_IDLE,
  windup: vary(E_IDLE, {
    joints: { chest: [0.15, -0.05, 0], spine: [0.06, 0, 0], head: [0.02, 0, 0] },
    sword: {
      hand: [0.12, 1.86, 0.08],
      blade: [0, 0.6, 0.8],
      spine: [0, -0.8, 0.6],
      pole: [0.8, -0.1, 0.4],
    },
  }),
  coil: vary(E_IDLE, {
    joints: { chest: [0.2, -0.05, 0], spine: [0.1, 0, 0], head: [-0.02, 0, 0] },
    sword: {
      hand: [0.12, 1.9, 0.14],
      blade: [0, 0.38, 0.92],
      spine: [0, -0.92, 0.38],
      pole: [0.8, -0.1, 0.4],
    },
  }),
  strikeStart: vary(E_IDLE, {
    joints: { chest: [-0.05, -0.04, 0], spine: [-0.04, 0, 0] },
    sword: {
      hand: [0.08, 1.8, -0.35],
      blade: [0, 0.85, -0.5],
      spine: [0, 0.5, 0.85],
      pole: [0.85, -0.2, 0.3],
    },
  }),
  strikeMid: vary(E_IDLE, {
    root: [0, -0.1, 0],
    joints: { chest: [-0.25, 0, 0], spine: [-0.2, 0, 0] },
    sword: {
      hand: [0.05, 1.42, -0.6],
      blade: [0, 0.1, -1],
      spine: [0, 1, 0.1],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  strikeEnd: vary(E_IDLE, {
    root: [0, -0.16, 0],
    joints: { chest: [-0.38, 0, 0], spine: [-0.3, 0, 0] },
    sword: {
      hand: [0.05, 1.0, -0.55],
      blade: [0, -0.65, -0.75],
      spine: [0, 0.75, -0.65],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  followThrough: vary(E_IDLE, {
    root: [0, -0.18, 0],
    joints: { chest: [-0.38, 0, 0], spine: [-0.3, 0, 0] },
    sword: {
      hand: [0.06, 0.88, -0.45],
      blade: [0.05, -0.85, -0.5],
      spine: [0, 0.5, -0.85],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  recover: E_IDLE,
};

// ------------------------------------------------------------------ reacciones
/** Rebote al ser desviado: la hoja sale despedida hacia arriba y atras. */
const RECOIL = vary(E_IDLE, {
  root: [0, -0.04, 0.1],
  joints: { spine: [0.22, 0.1, 0], chest: [0.2, 0.15, 0.05], head: [-0.12, 0.1, 0] },
  sword: {
    hand: [0.22, 1.66, -0.08],
    blade: [0.35, 0.88, 0.3],
    spine: [-0.6, 0.0, 0.8],
    pole: [0.8, -0.3, 0.4],
  },
  offHand: { weight: 0.35 },
});

const BLOCK = vary(E_IDLE, {
  joints: { chest: [-0.05, 0.15, 0] },
  sword: {
    hand: [0.05, 1.3, -0.4],
    blade: [-0.4, 0.88, -0.25],
    spine: [0.85, 0.15, 0.5],
    pole: [0.8, -0.5, 0.2],
  },
});

const BLOCK_PUSHED = vary(BLOCK, {
  root: [0, -0.08, 0.06],
  joints: { spine: [0.08, 0, 0], chest: [0.1, 0.15, 0] },
  sword: { hand: [0.08, 1.32, -0.28] },
});

const HIT = vary(E_IDLE, {
  root: [0, -0.06, 0.08],
  joints: { spine: [0.25, 0.2, 0.05], chest: [0.22, 0.25, 0.1], head: [-0.25, 0.2, 0] },
  sword: {
    hand: [0.38, 1.1, 0.05],
    blade: [0.7, -0.4, 0.4],
    spine: [0, 1, 0],
    pole: [0.7, -0.5, 0.5],
  },
  offHand: { weight: 0 },
});

/** Postura rota: rodilla en tierra, la punta de la hoja toca el suelo. */
const BROKEN = pose({
  root: [0, -0.36, 0.05],
  joints: {
    thigh_l: [1.35, 0.05, -0.08],
    shin_l: [-1.85, 0, 0],
    foot_l: [0.5, 0, 0],
    thigh_r: [-0.1, -0.08, 0.1],
    shin_r: [-1.6, 0, 0],
    foot_r: [1.2, 0, 0],
    spine: [-0.38, 0.05, 0],
    chest: [-0.25, 0.08, 0],
    head: [0.45, 0, 0],
    upperarm_l: [0.25, 0, -0.25],
    forearm_l: [0.4, 0, 0],
  },
  sword: {
    hand: [0.34, 0.55, -0.25],
    blade: [0.35, -0.85, -0.38],
    spine: [0, 0.4, -0.9],
    pole: [0.6, -0.4, 0.6],
  },
});
const BROKEN_SWAY = vary(BROKEN, {
  root: [0.02, -0.38, 0.05],
  joints: { chest: [-0.3, 0.12, 0.04], head: [0.5, 0.05, 0] },
});

/** Muerte: se desploma hacia delante. */
const DEAD = pose({
  root: [0, -0.86, -0.25],
  joints: {
    hips: [-1.45, 0.1, 0],
    spine: [-0.1, 0, 0],
    head: [0.3, 0.6, 0],
    thigh_l: [0.3, 0, -0.1],
    shin_l: [-0.6, 0, 0],
    thigh_r: [0.1, 0, 0.15],
    shin_r: [-0.3, 0, 0],
    upperarm_l: [2.6, 0, -0.4],
    forearm_l: [0.3, 0, 0],
  },
  sword: {
    hand: [0.55, 0.08, -0.5],
    blade: [0.8, -0.05, -0.6],
    spine: [0, 1, 0],
    pole: [0.5, 0.5, 0.6],
  },
});

const D = DUMMY_ATTACKS;
const recoilTicks = combatConfig.attackerRecoilTicks;

export const DUELIST_CLIPS = {
  idle: clip('idle', 100, true, [key(0, E_IDLE), key(50, E_IDLE_BREATH, 'inOut')]),
  walk: clip('walk', 36, true, [key(0, walkPose(true)), key(18, walkPose(false), 'inOut')]),
  e_slash: attackClip('e_slash', D.e_slash, SLASH),
  e_rising: attackClip('e_rising', D.e_rising, RISING),
  e_overhead: attackClip('e_overhead', D.e_overhead, OVERHEAD),
  e_overhead_delayed: attackClip('e_overhead_delayed', D.e_overhead_delayed, OVERHEAD),
  recoil: clip('recoil', recoilTicks, false, [
    key(0, SLASH.strikeMid),
    key(5, RECOIL, 'snap'),
    key(recoilTicks - 6, RECOIL, 'linear'),
    key(recoilTicks, E_IDLE, 'inOut'),
  ]),
  block: clip('guard_idle', 1, false, [key(0, BLOCK)]),
  block_hit: clip('block_hit', 14, false, [key(0, BLOCK_PUSHED), key(14, BLOCK, 'inOut')]),
  hit_react: clip('hit_react', 18, false, [
    key(0, E_IDLE),
    key(3, HIT, 'snap'),
    key(18, E_IDLE, 'inOut'),
  ]),
  broken: clip('guard_break', 60, true, [key(0, BROKEN), key(30, BROKEN_SWAY, 'inOut')]),
  stagger: clip('stagger', 14, false, [key(0, RECOIL), key(14, BROKEN, 'out')]),
  death: clip('death', 40, false, [
    key(0, BROKEN),
    key(10, BROKEN_SWAY, 'out'),
    key(40, DEAD, 'in'),
  ]),
} satisfies Record<string, Clip>;

export type DuelistClipId = keyof typeof DUELIST_CLIPS;
