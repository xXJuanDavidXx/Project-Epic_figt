import { PLAYER_ATTACKS } from '@/combat/attackData';
import { combatConfig } from '@/config/combat';
import { playerConfig } from '@/config/player';
import type { Clip, Pose } from '@/animation/types';
import { attackClip, clip, key, pose, vary } from '@/animation/poseKit';

/**
 * Clips del jugador (ronin, katana a una mano, estilo agresivo y bajo).
 * Espacio cuerpo: pies en el origen, adelante -Z, derecha +X.
 */

// ------------------------------------------------------------------ piernas
const STANCE_LEGS = {
  thigh_l: [0.35, 0.05, -0.04],
  shin_l: [-0.55, 0, 0],
  foot_l: [0.2, 0, 0],
  thigh_r: [-0.15, -0.1, 0.06],
  shin_r: [-0.25, 0, 0],
  foot_r: [0.4, 0, 0],
} as const;

const DEEP_LEGS = {
  thigh_l: [0.55, 0.05, -0.06],
  shin_l: [-0.85, 0, 0],
  foot_l: [0.3, 0, 0],
  thigh_r: [-0.25, -0.1, 0.08],
  shin_r: [-0.45, 0, 0],
  foot_r: [0.7, 0, 0],
} as const;

// ------------------------------------------------------------------ poses base
export const IDLE: Pose = pose({
  root: [0, -0.04, 0],
  joints: {
    ...STANCE_LEGS,
    hips: [0, 0.18, 0],
    spine: [-0.08, -0.06, 0],
    chest: [-0.05, -0.12, 0],
    head: [0.1, 0, 0],
    upperarm_l: [0.25, 0, -0.18],
    forearm_l: [0.55, 0, 0],
  },
  sword: {
    hand: [0.24, 0.98, -0.2],
    blade: [-0.2, -0.35, -1],
    spine: [0, 1, 0],
    pole: [0.7, -0.4, 0.6],
  },
});

const IDLE_BREATH = vary(IDLE, {
  root: [0, -0.05, 0],
  joints: { chest: [-0.02, -0.12, 0], head: [0.08, 0, 0] },
  sword: { hand: [0.24, 0.97, -0.2] },
});

/** Guardia: la hoja cruza delante del pecho, punta arriba a la izquierda. */
export const GUARD: Pose = pose({
  root: [0, -0.07, 0],
  joints: {
    ...DEEP_LEGS,
    hips: [0, 0.22, 0],
    spine: [-0.1, -0.05, 0],
    chest: [-0.06, -0.12, 0],
    head: [0.14, 0.05, 0],
    upperarm_l: [0.55, 0, -0.25],
    forearm_l: [1.25, 0, 0],
    hand_l: [0, 0, 0.3],
  },
  sword: {
    hand: [0.1, 1.28, -0.32],
    blade: [-0.75, 0.6, -0.2],
    spine: [0.15, 0.2, 1],
    pole: [0.85, -0.45, 0.3],
  },
});

// ------------------------------------------------------------------ deflects
/**
 * La primera clave de cada deflect es el CONTACTO: la hoja cruzada contra el golpe.
 * Se entra con corte seco (fade 0) y el hitstop congela esa pose mientras saltan las chispas.
 * Luego un rebote rapido (el acero empuja) y vuelta a guardia.
 */
function deflectClip(name: string, contact: Pose, rebound: Pose): Clip {
  const recover = combatConfig.deflectRecoverTicks;
  return clip(name, recover + 12, false, [
    key(0, contact),
    key(4, rebound, 'snap'),
    key(recover + 12, GUARD, 'inOut'),
  ]);
}

/** Golpe que llega por la izquierda del jugador (tajo desde la derecha del enemigo). */
const DEFLECT_LEFT_CONTACT = vary(GUARD, {
  joints: { chest: [-0.06, 0.18, 0.05], spine: [-0.12, 0.08, 0], head: [0.12, -0.15, 0] },
  sword: {
    hand: [-0.02, 1.27, -0.4],
    blade: [-0.5, 0.85, -0.18],
    spine: [0.75, 0.15, 0.65],
    pole: [0.8, -0.5, 0.2],
  },
});
const DEFLECT_LEFT_REBOUND = vary(DEFLECT_LEFT_CONTACT, {
  joints: { chest: [-0.02, 0.05, 0], spine: [-0.08, 0, 0] },
  sword: { hand: [0.08, 1.33, -0.3], blade: [-0.65, 0.75, 0.05] },
});

/** Golpe que llega por la derecha (ascendente desde la izquierda del enemigo). */
const DEFLECT_RIGHT_CONTACT = vary(GUARD, {
  joints: { chest: [-0.05, -0.35, -0.05], spine: [-0.1, -0.12, 0], head: [0.12, 0.2, 0] },
  sword: {
    hand: [0.3, 1.12, -0.4],
    blade: [0.35, 0.9, -0.25],
    spine: [-0.8, 0.1, 0.6],
    pole: [0.9, -0.2, 0.3],
  },
});
const DEFLECT_RIGHT_REBOUND = vary(DEFLECT_RIGHT_CONTACT, {
  joints: { chest: [-0.03, -0.2, 0] },
  sword: { hand: [0.26, 1.2, -0.3], blade: [0.15, 0.95, 0.1] },
});

/** Golpe vertical: hoja horizontal por encima de la cabeza, filo hacia arriba. */
const DEFLECT_HIGH_CONTACT = vary(GUARD, {
  root: [0, -0.11, 0],
  joints: {
    ...DEEP_LEGS,
    hips: [0, 0.18, 0],
    spine: [-0.04, -0.05, 0],
    chest: [0.04, -0.1, 0],
    head: [0.3, 0.05, 0],
    upperarm_l: [1.6, 0, -0.35],
    forearm_l: [1.0, 0, 0],
  },
  sword: {
    hand: [0.22, 1.66, -0.3],
    blade: [-0.95, 0.12, -0.2],
    spine: [0, -1, 0.15],
    pole: [0.9, -0.15, 0.35],
  },
});
const DEFLECT_HIGH_REBOUND = vary(DEFLECT_HIGH_CONTACT, {
  root: [0, -0.14, 0],
  sword: { hand: [0.24, 1.55, -0.22], blade: [-0.9, 0.3, 0.05] },
});

/** Estocada: la hoja barre en vertical delante del centro. */
const DEFLECT_THRUST_CONTACT = vary(GUARD, {
  joints: { chest: [-0.08, 0.05, 0] },
  sword: {
    hand: [0.06, 1.2, -0.45],
    blade: [-0.35, 0.88, -0.3],
    spine: [0.9, 0.05, 0.4],
    pole: [0.85, -0.45, 0.2],
  },
});
const DEFLECT_THRUST_REBOUND = vary(DEFLECT_THRUST_CONTACT, {
  sword: { hand: [0.14, 1.26, -0.34], blade: [-0.55, 0.75, 0.1] },
});

// ------------------------------------------------------------------ reacciones
const BLOCK_PUSHED = vary(GUARD, {
  root: [0, -0.1, 0.05],
  joints: { spine: [0.05, -0.05, 0], chest: [0.1, -0.12, 0], head: [0.05, 0.05, 0] },
  sword: { hand: [0.12, 1.3, -0.2] },
});

const HIT_REACT = pose({
  root: [0, -0.08, 0.06],
  joints: {
    ...STANCE_LEGS,
    spine: [0.22, 0.15, 0.05],
    chest: [0.18, 0.2, 0.08],
    head: [-0.2, 0.25, 0],
    upperarm_l: [0.2, 0, -0.6],
    forearm_l: [0.4, 0, 0],
  },
  sword: {
    hand: [0.42, 1.05, 0.05],
    blade: [0.6, -0.5, 0.3],
    spine: [0, 1, 0],
    pole: [0.6, -0.6, 0.6],
  },
});

const GUARD_BROKEN = pose({
  root: [0, -0.22, 0.12],
  joints: {
    ...DEEP_LEGS,
    spine: [0.35, 0.1, 0],
    chest: [0.3, 0.15, 0.1],
    head: [-0.35, 0.1, 0],
    upperarm_l: [0.1, 0, -0.95],
    forearm_l: [0.3, 0, 0],
  },
  sword: {
    hand: [0.55, 1.15, 0.1],
    blade: [0.8, 0.4, 0.3],
    spine: [0, 1, 0],
    pole: [0.6, -0.6, 0.6],
  },
});

const GUARD_BROKEN_SLUMP = vary(GUARD_BROKEN, {
  root: [0, -0.3, 0.05],
  joints: { spine: [-0.25, 0, 0], chest: [-0.2, 0.05, 0], head: [0.35, 0, 0] },
  sword: { hand: [0.35, 0.75, -0.15], blade: [0.3, -0.8, -0.4] },
});

// ------------------------------------------------------------------ locomocion
const RUN_SWORD = {
  hand: [0.3, 1.0, 0.05],
  blade: [0.18, -0.3, 1],
  spine: [0, 1, 0],
  pole: [0.7, -0.5, 0.5],
} as const;

function runPose(
  phase: 'contact_l' | 'pass_l' | 'contact_r' | 'pass_r',
  lean: number,
  stride: number,
): Pose {
  const s = stride;
  // [muslo, espinilla, pie] de cada pierna segun la fase.
  type Leg = [number, number, number];
  const phases: Record<typeof phase, { l: Leg; r: Leg }> = {
    contact_l: { l: [0.65 * s, -0.2, 0.1], r: [-0.55 * s, -0.9 * s, 0.4] },
    pass_l: { l: [0.0, -0.3, 0.2], r: [0.35 * s, -1.5 * s, 0.5] },
    contact_r: { r: [0.65 * s, -0.2, 0.1], l: [-0.55 * s, -0.9 * s, 0.4] },
    pass_r: { r: [0.0, -0.3, 0.2], l: [0.35 * s, -1.5 * s, 0.5] },
  };
  const { l, r } = phases[phase];
  const legs: Pose['joints'] = {
    thigh_l: [l[0], 0, 0],
    shin_l: [l[1], 0, 0],
    foot_l: [l[2], 0, 0],
    thigh_r: [r[0], 0, 0],
    shin_r: [r[1], 0, 0],
    foot_r: [r[2], 0, 0],
  };
  const leftForward = phase === 'contact_l' || phase === 'pass_r';
  const armSwing = leftForward ? -0.45 : 0.55;
  const contact = phase === 'contact_l' || phase === 'contact_r';
  return pose({
    root: [0, contact ? -0.06 : 0.01, 0],
    joints: {
      ...legs,
      hips: [0, leftForward ? 0.12 : -0.12, 0],
      spine: [-lean, leftForward ? -0.08 : 0.08, 0],
      chest: [-lean * 0.4, leftForward ? -0.1 : 0.1, 0],
      head: [lean * 1.1, 0, 0],
      upperarm_l: [armSwing * s, 0, -0.12],
      forearm_l: [0.9, 0, 0],
    },
    sword: { ...RUN_SWORD },
  });
}

function runClip(name: string, ticks: number, lean: number, stride: number): Clip {
  const q = ticks / 4;
  return clip(name, ticks, true, [
    key(0, runPose('contact_l', lean, stride), 'inOut'),
    key(q, runPose('pass_l', lean, stride), 'inOut'),
    key(q * 2, runPose('contact_r', lean, stride), 'inOut'),
    key(q * 3, runPose('pass_r', lean, stride), 'inOut'),
  ]);
}

const JUMP_RISE = pose({
  root: [0, 0.02, 0],
  joints: {
    thigh_l: [1.0, 0, 0],
    shin_l: [-1.4, 0, 0],
    foot_l: [0.3, 0, 0],
    thigh_r: [0.2, 0, 0],
    shin_r: [-0.6, 0, 0],
    foot_r: [0.3, 0, 0],
    spine: [-0.15, 0, 0],
    head: [0.15, 0, 0],
    upperarm_l: [0.9, 0, -0.4],
    forearm_l: [0.7, 0, 0],
  },
  sword: {
    hand: [0.38, 1.18, 0.05],
    blade: [0.3, -0.2, 1],
    spine: [0, 1, 0],
    pole: [0.7, -0.4, 0.5],
  },
});

const FALL = vary(JUMP_RISE, {
  joints: {
    thigh_l: [0.6, 0, -0.05],
    shin_l: [-0.9, 0, 0],
    thigh_r: [0.3, 0, 0.08],
    shin_r: [-0.7, 0, 0],
    upperarm_l: [0.6, 0, -0.9],
    forearm_l: [0.4, 0, 0],
    spine: [-0.05, 0, 0],
  },
});

const DODGE_LOW = pose({
  root: [0, -0.28, 0],
  joints: {
    thigh_l: [1.2, 0, -0.1],
    shin_l: [-1.6, 0, 0],
    foot_l: [0.4, 0, 0],
    thigh_r: [-0.4, 0, 0.1],
    shin_r: [-1.1, 0, 0],
    foot_r: [0.9, 0, 0],
    spine: [-0.5, 0, 0],
    chest: [-0.2, 0, 0],
    head: [0.5, 0, 0],
    upperarm_l: [0.5, 0, -0.5],
    forearm_l: [0.8, 0, 0],
  },
  sword: {
    hand: [0.32, 0.85, 0.12],
    blade: [0.25, -0.25, 1],
    spine: [0, 1, 0],
    pole: [0.7, -0.4, 0.5],
  },
});

// ------------------------------------------------------------------ ataques
const ATK1 = {
  ready: GUARD,
  windup: vary(GUARD, {
    joints: { chest: [-0.05, -0.65, 0], spine: [-0.08, -0.25, 0], hips: [0, 0.05, 0] },
    sword: {
      hand: [0.42, 1.38, 0.05],
      blade: [0.85, 0.35, 0.4],
      spine: [0, 0.3, 1],
      pole: [0.6, -0.6, 0.4],
    },
  }),
  coil: vary(GUARD, {
    joints: { chest: [-0.05, -0.75, 0], spine: [-0.08, -0.3, 0], hips: [0, 0.0, 0] },
    sword: {
      hand: [0.46, 1.4, 0.1],
      blade: [0.8, 0.4, 0.45],
      spine: [0, 0.3, 1],
      pole: [0.6, -0.6, 0.4],
    },
  }),
  strikeStart: vary(GUARD, {
    joints: { chest: [-0.08, -0.3, 0], spine: [-0.1, -0.1, 0] },
    sword: {
      hand: [0.4, 1.32, -0.3],
      blade: [0.7, 0.05, -0.7],
      spine: [0, 0.15, -1],
      pole: [0.6, -0.6, 0.3],
    },
  }),
  strikeMid: vary(GUARD, {
    joints: { chest: [-0.1, 0.15, 0], spine: [-0.12, 0.05, 0] },
    sword: {
      hand: [0.1, 1.28, -0.5],
      blade: [0, -0.02, -1],
      spine: [1, 0.1, 0],
      pole: [0.8, -0.5, 0.2],
    },
  }),
  strikeEnd: vary(GUARD, {
    joints: { chest: [-0.1, 0.5, 0.05], spine: [-0.12, 0.2, 0] },
    sword: {
      hand: [-0.22, 1.2, -0.38],
      blade: [-0.85, -0.12, -0.4],
      spine: [0.3, 0.1, -1],
      pole: [0.8, -0.3, 0],
    },
  }),
  followThrough: vary(GUARD, {
    joints: { chest: [-0.08, 0.6, 0.05], spine: [-0.1, 0.25, 0] },
    sword: {
      hand: [-0.3, 1.1, -0.15],
      blade: [-0.75, -0.4, 0.5],
      spine: [0, 1, 0],
      pole: [0.7, -0.4, -0.2],
    },
  }),
  recover: GUARD,
};

const ATK2 = {
  ready: ATK1.followThrough,
  windup: vary(ATK1.followThrough, {
    sword: { hand: [-0.28, 0.98, -0.12], blade: [-0.7, -0.6, 0.3], spine: [0, 0.4, -1] },
  }),
  coil: vary(ATK1.followThrough, {
    joints: { chest: [-0.12, 0.7, 0.05] },
    sword: { hand: [-0.3, 0.95, -0.08], blade: [-0.6, -0.7, 0.35], spine: [0, 0.4, -1] },
  }),
  strikeStart: vary(GUARD, {
    joints: { chest: [-0.1, 0.3, 0], spine: [-0.1, 0.1, 0] },
    sword: {
      hand: [-0.12, 1.05, -0.42],
      blade: [-0.6, -0.4, -0.7],
      spine: [0.5, 0.8, -0.2],
      pole: [0.7, -0.5, 0],
    },
  }),
  strikeMid: vary(GUARD, {
    joints: { chest: [-0.08, -0.1, 0], spine: [-0.1, -0.05, 0] },
    sword: {
      hand: [0.12, 1.22, -0.52],
      blade: [0.1, 0.35, -1],
      spine: [-0.8, 0.5, 0],
      pole: [0.8, -0.5, 0.2],
    },
  }),
  strikeEnd: vary(GUARD, {
    joints: { chest: [-0.05, -0.45, 0], spine: [-0.08, -0.2, 0] },
    sword: {
      hand: [0.38, 1.5, -0.32],
      blade: [0.75, 0.6, -0.2],
      spine: [-0.5, 0.5, -0.6],
      pole: [0.8, -0.3, 0.5],
    },
  }),
  followThrough: vary(GUARD, {
    joints: { chest: [-0.02, -0.55, 0], spine: [-0.05, -0.25, 0] },
    sword: {
      hand: [0.42, 1.55, -0.1],
      blade: [0.6, 0.65, 0.45],
      spine: [-0.4, 0.3, -0.8],
      pole: [0.8, -0.2, 0.6],
    },
  }),
  recover: GUARD,
};

const ATK3 = {
  ready: ATK2.followThrough,
  windup: vary(GUARD, {
    joints: { chest: [0.12, -0.1, 0], spine: [0.05, 0, 0], head: [0.05, 0, 0] },
    sword: {
      hand: [0.18, 1.78, 0.02],
      blade: [-0.1, 0.5, 0.85],
      spine: [0, -0.85, 0.5],
      pole: [0.8, -0.1, 0.5],
    },
  }),
  coil: vary(GUARD, {
    joints: { chest: [0.18, -0.1, 0], spine: [0.08, 0, 0], head: [0.0, 0, 0] },
    sword: {
      hand: [0.16, 1.82, 0.08],
      blade: [-0.1, 0.35, 0.95],
      spine: [0, -0.95, 0.35],
      pole: [0.8, -0.1, 0.5],
    },
  }),
  strikeStart: vary(GUARD, {
    joints: { chest: [-0.05, -0.05, 0], spine: [-0.05, 0, 0] },
    sword: {
      hand: [0.12, 1.72, -0.35],
      blade: [-0.05, 0.85, -0.5],
      spine: [0, 0.5, 0.85],
      pole: [0.85, -0.2, 0.3],
    },
  }),
  strikeMid: vary(GUARD, {
    root: [0, -0.12, 0],
    joints: { chest: [-0.25, 0, 0], spine: [-0.2, 0, 0] },
    sword: {
      hand: [0.08, 1.35, -0.55],
      blade: [0, 0.1, -1],
      spine: [0, 1, 0.1],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  strikeEnd: vary(GUARD, {
    root: [0, -0.18, 0],
    joints: { chest: [-0.35, 0, 0], spine: [-0.3, 0, 0] },
    sword: {
      hand: [0.06, 0.95, -0.5],
      blade: [0, -0.7, -0.7],
      spine: [0, 0.7, -0.7],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  followThrough: vary(GUARD, {
    root: [0, -0.2, 0],
    joints: { chest: [-0.35, 0, 0], spine: [-0.3, 0, 0] },
    sword: {
      hand: [0.1, 0.8, -0.38],
      blade: [0.1, -0.9, -0.4],
      spine: [0, 0.4, -0.9],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  recover: GUARD,
};

const THRUST_READY = vary(GUARD, {
  root: [0, -0.12, 0],
  joints: { chest: [-0.05, -0.4, 0], spine: [-0.1, -0.15, 0] },
  sword: {
    hand: [0.3, 1.2, 0.15],
    blade: [-0.05, -0.05, -1],
    spine: [0, 1, 0],
    pole: [0.7, -0.6, 0.3],
  },
});
const THRUST_EXTEND = vary(GUARD, {
  root: [0, -0.18, 0],
  joints: { ...DEEP_LEGS, chest: [-0.2, 0.25, 0], spine: [-0.2, 0.1, 0] },
  sword: {
    hand: [0.06, 1.18, -0.6],
    blade: [-0.03, -0.08, -1],
    spine: [0, 1, 0],
    pole: [0.85, -0.4, 0.1],
  },
});
const DEATHBLOW_DEF = PLAYER_ATTACKS.deathblow;

// ------------------------------------------------------------------ catalogo
export const RONIN_CLIPS = {
  idle: clip('idle', 90, true, [key(0, IDLE), key(45, IDLE_BREATH, 'inOut')]),
  run: runClip('run', 24, 0.22, 1),
  sprint: runClip('sprint', 20, 0.42, 1.2),
  jump: clip('jump_start', 12, false, [key(0, JUMP_RISE)]),
  fall: clip('jump_loop', 20, false, [key(0, JUMP_RISE), key(14, FALL, 'inOut')]),
  dodge: clip('dodge_f', playerConfig.dodgeTicks + 6, false, [
    key(0, DODGE_LOW),
    key(playerConfig.dodgeTicks - 4, DODGE_LOW, 'linear'),
    key(playerConfig.dodgeTicks + 6, IDLE, 'inOut'),
  ]),
  guard: clip('guard_idle', 1, false, [key(0, GUARD)]),
  deflect_left: deflectClip('deflect_1', DEFLECT_LEFT_CONTACT, DEFLECT_LEFT_REBOUND),
  deflect_right: deflectClip('deflect_2', DEFLECT_RIGHT_CONTACT, DEFLECT_RIGHT_REBOUND),
  deflect_high: deflectClip('deflect_high', DEFLECT_HIGH_CONTACT, DEFLECT_HIGH_REBOUND),
  deflect_thrust: deflectClip('deflect_thrust', DEFLECT_THRUST_CONTACT, DEFLECT_THRUST_REBOUND),
  block_hit: clip('block_hit', combatConfig.blockStunTicks + 6, false, [
    key(0, BLOCK_PUSHED),
    key(combatConfig.blockStunTicks + 6, GUARD, 'inOut'),
  ]),
  hit_react: clip('hit_react', combatConfig.hitStunTicks, false, [
    key(0, IDLE),
    key(3, HIT_REACT, 'snap'),
    key(combatConfig.hitStunTicks, IDLE, 'inOut'),
  ]),
  guard_break: clip('guard_break', combatConfig.guardBreakTicks, false, [
    key(0, GUARD),
    key(4, GUARD_BROKEN, 'snap'),
    key(18, GUARD_BROKEN_SLUMP, 'out'),
    key(combatConfig.guardBreakTicks - 15, GUARD_BROKEN_SLUMP, 'linear'),
    key(combatConfig.guardBreakTicks, GUARD, 'inOut'),
  ]),
  atk_1: attackClip('atk_1', PLAYER_ATTACKS.atk_1, ATK1),
  atk_2: attackClip('atk_2', PLAYER_ATTACKS.atk_2, ATK2),
  atk_3: attackClip('atk_3', PLAYER_ATTACKS.atk_3, ATK3),
  deathblow: clip(
    'deathblow',
    DEATHBLOW_DEF.startupTicks + DEATHBLOW_DEF.activeTicks + DEATHBLOW_DEF.recoveryTicks,
    false,
    [
      key(0, GUARD),
      key(DEATHBLOW_DEF.startupTicks - 1, THRUST_READY, 'out'),
      key(DEATHBLOW_DEF.startupTicks + 2, THRUST_EXTEND, 'snap'),
      key(DEATHBLOW_DEF.startupTicks + 22, THRUST_EXTEND, 'linear'),
      key(DEATHBLOW_DEF.startupTicks + 30, THRUST_READY, 'inOut'),
      key(
        DEATHBLOW_DEF.startupTicks + DEATHBLOW_DEF.activeTicks + DEATHBLOW_DEF.recoveryTicks,
        GUARD,
        'inOut',
      ),
    ],
  ),
} satisfies Record<string, Clip>;

export type RoninClipId = keyof typeof RONIN_CLIPS;
