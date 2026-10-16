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

// ------------------------------------------------------------------ piernas de combate
/** Estocada: pierna izquierda adelante y hundida, la derecha estirada detras. */
const LUNGE_LEGS = {
  thigh_l: [0.75, 0.05, -0.05],
  shin_l: [-0.95, 0, 0],
  foot_l: [0.2, 0, 0],
  thigh_r: [-0.45, -0.1, 0.06],
  shin_r: [-0.2, 0, 0],
  foot_r: [0.65, 0, 0],
} as const;

/** Peso atras, listo para soltar el golpe. */
const COIL_LEGS = {
  thigh_l: [0.25, 0.05, -0.05],
  shin_l: [-0.35, 0, 0],
  foot_l: [0.1, 0, 0],
  thigh_r: [0.1, -0.1, 0.06],
  shin_r: [-0.55, 0, 0],
  foot_r: [0.45, 0, 0],
} as const;

/** Encajando un impacto: rodillas cargadas, el pie de atras resbala. */
const BRACED_LEGS = {
  thigh_l: [0.5, 0.05, -0.06],
  shin_l: [-0.95, 0, 0],
  foot_l: [0.45, 0, 0],
  thigh_r: [-0.05, -0.1, 0.08],
  shin_r: [-0.75, 0, 0],
  foot_r: [0.8, 0, 0],
} as const;

// ------------------------------------------------------------------ deflects
/**
 * Coreografia de un deflect (estilo cortado, sin suavizar):
 *   t0  CONTACTO: la hoja sale AL ENCUENTRO del golpe, el cuerpo empuja hacia el. Se entra con
 *       corte seco y el hitstop congela esta pose mientras saltan las chispas.
 *   t3  RETROCESO: el acero empuja de vuelta; la mano retrocede, el torso se echa atras, las
 *       rodillas cargan y el pie resbala. Snap: el impacto se lee en el cuerpo.
 *   t7  se sostiene el retroceso (frame de impacto).
 *   t10 vuelta seca a la guardia, lista para el siguiente golpe del combo.
 */
function deflectClip(name: string, contact: Pose, recoil: Pose): Clip {
  const total = combatConfig.deflectRecoverTicks + 10;
  return clip(name, total, false, [
    key(0, contact),
    key(3, recoil, 'snap'),
    key(7, recoil, 'hold'),
    key(11, GUARD, 'out'),
    key(total, GUARD, 'linear'),
  ]);
}

/** Desplaza la mano y el cuerpo hacia atras: la fuerza del golpe recibido. */
function recoilOf(contact: Pose, push: [number, number, number], lean: number): Pose {
  const h = contact.sword.hand;
  const chest = contact.joints.chest ?? [0, 0, 0];
  const spine = contact.joints.spine ?? [0, 0, 0];
  return vary(contact, {
    root: [contact.root[0], contact.root[1] - 0.05, contact.root[2] + 0.07],
    joints: {
      ...BRACED_LEGS,
      chest: [chest[0] + lean, chest[1] * 0.6, chest[2]],
      spine: [spine[0] + lean * 0.6, spine[1] * 0.6, spine[2]],
      head: [0.02, 0, 0],
    },
    sword: { hand: [h[0] + push[0], h[1] + push[1], h[2] + push[2]] },
  });
}

/** Golpe por la izquierda (tajo desde la derecha del enemigo): hoja vertical a la izquierda. */
const DEFLECT_LEFT_CONTACT = vary(GUARD, {
  root: [0, -0.1, -0.04],
  joints: {
    ...DEEP_LEGS,
    chest: [-0.14, 0.32, 0.05],
    spine: [-0.18, 0.12, 0],
    head: [0.16, -0.25, 0],
    upperarm_l: [0.8, 0, -0.1],
    forearm_l: [1.1, 0, 0],
  },
  sword: {
    hand: [-0.08, 1.3, -0.5],
    blade: [-0.45, 0.88, -0.15],
    spine: [0.8, 0.12, 0.6],
    pole: [0.8, -0.5, 0.1],
  },
});
const DEFLECT_LEFT_RECOIL = recoilOf(DEFLECT_LEFT_CONTACT, [0.16, 0.06, 0.18], 0.2);

/** Golpe por la derecha (ascendente desde la izquierda del enemigo). */
const DEFLECT_RIGHT_CONTACT = vary(GUARD, {
  root: [0, -0.1, -0.04],
  joints: {
    ...DEEP_LEGS,
    chest: [-0.12, -0.48, -0.06],
    spine: [-0.16, -0.18, 0],
    head: [0.15, 0.3, 0],
  },
  sword: {
    hand: [0.34, 1.12, -0.48],
    blade: [0.3, 0.92, -0.22],
    spine: [-0.85, 0.1, 0.5],
    pole: [0.9, -0.25, 0.25],
  },
});
const DEFLECT_RIGHT_RECOIL = recoilOf(DEFLECT_RIGHT_CONTACT, [0.04, 0.12, 0.2], 0.18);

/** Golpe vertical: hoja horizontal sobre la cabeza, filo arriba, rodillas hundidas. */
const DEFLECT_HIGH_CONTACT = vary(GUARD, {
  root: [0, -0.16, -0.03],
  joints: {
    ...DEEP_LEGS,
    hips: [0, 0.18, 0],
    spine: [-0.06, -0.05, 0],
    chest: [0.02, -0.1, 0],
    head: [0.32, 0.05, 0],
    upperarm_l: [1.9, 0, -0.35],
    forearm_l: [1.1, 0, 0],
  },
  sword: {
    hand: [0.24, 1.66, -0.36],
    blade: [-0.95, 0.1, -0.22],
    spine: [0, -1, 0.15],
    pole: [0.9, -0.15, 0.35],
  },
});
const DEFLECT_HIGH_RECOIL = vary(recoilOf(DEFLECT_HIGH_CONTACT, [0.02, -0.16, 0.12], 0.08), {
  root: [0, -0.26, 0.06],
});

/** Estocada: barrido vertical delante del centro. */
const DEFLECT_THRUST_CONTACT = vary(GUARD, {
  root: [0, -0.1, -0.04],
  joints: { ...DEEP_LEGS, chest: [-0.12, 0.1, 0], spine: [-0.14, 0.04, 0] },
  sword: {
    hand: [0.04, 1.2, -0.52],
    blade: [-0.35, 0.88, -0.3],
    spine: [0.9, 0.05, 0.4],
    pole: [0.85, -0.45, 0.2],
  },
});
const DEFLECT_THRUST_RECOIL = recoilOf(DEFLECT_THRUST_CONTACT, [0.1, 0.05, 0.2], 0.18);

// ------------------------------------------------------------------ reacciones
const BLOCK_PUSHED = vary(GUARD, {
  root: [0, -0.15, 0.1],
  joints: {
    ...BRACED_LEGS,
    spine: [0.12, -0.05, 0],
    chest: [0.16, -0.12, 0],
    head: [0.02, 0.05, 0],
  },
  sword: { hand: [0.14, 1.34, -0.16] },
});

/** Golpe recibido: el cuerpo se dobla hacia atras y gira, la cabeza da el latigazo. */
const HIT_REACT = pose({
  root: [0, -0.1, 0.1],
  joints: {
    ...BRACED_LEGS,
    spine: [0.3, 0.22, 0.08],
    chest: [0.28, 0.3, 0.12],
    head: [-0.35, 0.35, 0.1],
    upperarm_l: [0.3, 0, -0.85],
    forearm_l: [0.3, 0, 0],
  },
  sword: {
    hand: [0.48, 1.08, 0.1],
    blade: [0.7, -0.45, 0.4],
    spine: [0, 1, 0],
    pole: [0.6, -0.6, 0.6],
  },
});
const HIT_HUNCH = vary(HIT_REACT, {
  root: [0, -0.14, 0.12],
  joints: { spine: [-0.2, 0.1, 0], chest: [-0.15, 0.12, 0], head: [0.25, 0.1, 0] },
  sword: { hand: [0.36, 0.95, -0.05], blade: [0.4, -0.7, -0.3] },
});

const GUARD_BROKEN = pose({
  root: [0, -0.2, 0.14],
  joints: {
    ...BRACED_LEGS,
    spine: [0.42, 0.1, 0],
    chest: [0.35, 0.15, 0.1],
    head: [-0.45, 0.1, 0],
    upperarm_l: [0.3, 0, -1.2],
    forearm_l: [0.3, 0, 0],
  },
  sword: {
    hand: [0.58, 1.28, 0.12],
    blade: [0.75, 0.55, 0.35],
    spine: [0, 1, 0],
    pole: [0.6, -0.6, 0.6],
  },
});

const GUARD_BROKEN_SLUMP = vary(GUARD_BROKEN, {
  root: [0, -0.32, 0.05],
  joints: { spine: [-0.32, 0, 0], chest: [-0.25, 0.05, 0], head: [0.45, 0, 0] },
  sword: { hand: [0.35, 0.72, -0.15], blade: [0.3, -0.85, -0.4] },
});

/** Rebote propio cuando el enemigo BLOQUEA nuestro golpe: la hoja sale despedida. */
const ATTACK_BOUNCED = vary(GUARD, {
  root: [0, -0.1, 0.06],
  joints: { ...BRACED_LEGS, chest: [0.12, -0.25, 0], spine: [0.06, -0.1, 0], head: [0.05, 0.1, 0] },
  sword: {
    hand: [0.32, 1.45, -0.18],
    blade: [0.5, 0.82, 0.25],
    spine: [-0.6, 0.1, 0.8],
    pole: [0.8, -0.3, 0.4],
  },
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
/** Tajo horizontal de derecha a izquierda: la hoja amartillada sobre el hombro derecho. */
const ATK1 = {
  ready: GUARD,
  windup: vary(GUARD, {
    root: [0, -0.04, 0.02],
    joints: {
      ...COIL_LEGS,
      chest: [-0.02, -0.85, 0],
      spine: [-0.05, -0.35, 0],
      hips: [0, -0.1, 0],
      head: [0.1, 0.5, 0],
    },
    sword: {
      hand: [0.38, 1.5, 0.12],
      blade: [0.7, 0.55, 0.45],
      spine: [-0.3, 0.2, 0.9],
      pole: [0.6, -0.4, 0.5],
    },
  }),
  coil: vary(GUARD, {
    root: [0, -0.05, 0.03],
    joints: {
      ...COIL_LEGS,
      chest: [-0.02, -0.95, 0],
      spine: [-0.05, -0.4, 0],
      hips: [0, -0.15, 0],
      head: [0.1, 0.6, 0],
    },
    sword: {
      hand: [0.4, 1.52, 0.16],
      blade: [0.66, 0.55, 0.5],
      spine: [-0.3, 0.2, 0.9],
      pole: [0.6, -0.4, 0.5],
    },
  }),
  strikeStart: vary(GUARD, {
    root: [0, -0.1, -0.03],
    joints: {
      ...LUNGE_LEGS,
      chest: [-0.1, -0.35, 0],
      spine: [-0.1, -0.12, 0],
      head: [0.12, 0.2, 0],
    },
    sword: {
      hand: [0.42, 1.34, -0.3],
      blade: [0.72, 0.08, -0.68],
      spine: [0.66, 0.1, 0.74],
      pole: [0.6, -0.6, 0.3],
    },
  }),
  strikeMid: vary(GUARD, {
    root: [0, -0.13, -0.06],
    joints: {
      ...LUNGE_LEGS,
      chest: [-0.14, 0.2, 0],
      spine: [-0.14, 0.08, 0],
      head: [0.14, -0.1, 0],
    },
    sword: {
      hand: [0.1, 1.28, -0.55],
      blade: [0, -0.02, -1],
      spine: [1, 0.08, 0],
      pole: [0.8, -0.5, 0.1],
    },
  }),
  strikeEnd: vary(GUARD, {
    root: [0, -0.14, -0.07],
    joints: {
      ...LUNGE_LEGS,
      chest: [-0.14, 0.62, 0.06],
      spine: [-0.14, 0.26, 0],
      head: [0.14, -0.4, 0],
    },
    sword: {
      hand: [-0.26, 1.18, -0.38],
      blade: [-0.9, -0.15, -0.38],
      spine: [0.38, 0.05, -0.92],
      pole: [0.8, -0.3, -0.2],
    },
  }),
  followThrough: vary(GUARD, {
    root: [0, -0.12, -0.05],
    joints: { ...LUNGE_LEGS, chest: [-0.1, 0.55, 0.05], spine: [-0.12, 0.24, 0] },
    sword: {
      hand: [-0.3, 1.08, -0.18],
      blade: [-0.75, -0.42, 0.5],
      spine: [0, 1, 0],
      pole: [0.7, -0.4, -0.2],
    },
  }),
  recover: GUARD,
};

/** Ascendente de abajo-izquierda a arriba-derecha: sale del final del primer tajo. */
const ATK2 = {
  ready: ATK1.followThrough,
  windup: vary(ATK1.followThrough, {
    root: [0, -0.16, -0.02],
    joints: { chest: [-0.2, 0.75, 0.05], spine: [-0.18, 0.3, 0] },
    sword: { hand: [-0.3, 0.92, -0.14], blade: [-0.68, -0.62, 0.4], spine: [0.3, -0.3, 0.9] },
  }),
  coil: vary(ATK1.followThrough, {
    root: [0, -0.18, -0.02],
    joints: { chest: [-0.22, 0.82, 0.05], spine: [-0.2, 0.32, 0] },
    sword: { hand: [-0.32, 0.88, -0.1], blade: [-0.62, -0.66, 0.42], spine: [0.3, -0.3, 0.9] },
  }),
  strikeStart: vary(GUARD, {
    root: [0, -0.14, -0.05],
    joints: { ...LUNGE_LEGS, chest: [-0.16, 0.35, 0], spine: [-0.14, 0.12, 0] },
    sword: {
      hand: [-0.16, 1.02, -0.46],
      blade: [-0.62, -0.42, -0.66],
      spine: [-0.5, -0.8, 0.3],
      pole: [0.7, -0.5, 0],
    },
  }),
  strikeMid: vary(GUARD, {
    root: [0, -0.1, -0.06],
    joints: { ...LUNGE_LEGS, chest: [-0.1, -0.1, 0], spine: [-0.1, -0.04, 0] },
    sword: {
      hand: [0.12, 1.24, -0.56],
      blade: [0.08, 0.35, -0.94],
      spine: [-0.8, -0.55, 0.1],
      pole: [0.8, -0.5, 0.2],
    },
  }),
  strikeEnd: vary(GUARD, {
    root: [0, -0.04, -0.06],
    joints: {
      ...LUNGE_LEGS,
      chest: [0.02, -0.55, 0],
      spine: [-0.02, -0.24, 0],
      head: [0.05, 0.3, 0],
    },
    sword: {
      hand: [0.4, 1.6, -0.3],
      blade: [0.66, 0.72, -0.2],
      spine: [-0.7, 0.6, 0.3],
      pole: [0.8, -0.2, 0.5],
    },
  }),
  followThrough: vary(GUARD, {
    root: [0, -0.04, -0.04],
    joints: { ...LUNGE_LEGS, chest: [0.04, -0.6, 0], spine: [-0.02, -0.26, 0] },
    sword: {
      hand: [0.42, 1.66, -0.08],
      blade: [0.5, 0.72, 0.48],
      spine: [-0.6, 0.4, -0.6],
      pole: [0.8, -0.15, 0.6],
    },
  }),
  recover: GUARD,
};

/** Remate del combo: la hoja sube por detras de la cabeza y cae con todo el peso. */
const ATK3 = {
  ready: ATK2.followThrough,
  windup: vary(GUARD, {
    root: [0, 0.02, 0.04],
    joints: {
      ...COIL_LEGS,
      chest: [0.2, -0.12, 0],
      spine: [0.1, 0, 0],
      head: [0.0, 0, 0],
      upperarm_l: [2.4, 0, -0.3],
      forearm_l: [1.4, 0, 0],
    },
    sword: {
      hand: [0.16, 1.84, 0.08],
      blade: [-0.1, 0.4, 0.9],
      spine: [0, -0.9, 0.4],
      pole: [0.8, -0.05, 0.5],
    },
  }),
  coil: vary(GUARD, {
    root: [0, 0.03, 0.06],
    joints: {
      ...COIL_LEGS,
      chest: [0.28, -0.12, 0],
      spine: [0.14, 0, 0],
      head: [-0.05, 0, 0],
      upperarm_l: [2.5, 0, -0.3],
      forearm_l: [1.4, 0, 0],
    },
    sword: {
      hand: [0.14, 1.88, 0.14],
      blade: [-0.1, 0.22, 0.97],
      spine: [0, -0.97, 0.22],
      pole: [0.8, -0.05, 0.5],
    },
  }),
  strikeStart: vary(GUARD, {
    root: [0, -0.06, -0.04],
    joints: { ...LUNGE_LEGS, chest: [-0.06, -0.05, 0], spine: [-0.06, 0, 0] },
    sword: {
      hand: [0.1, 1.78, -0.36],
      blade: [-0.04, 0.85, -0.52],
      spine: [0, 0.52, 0.85],
      pole: [0.85, -0.15, 0.3],
    },
  }),
  strikeMid: vary(GUARD, {
    root: [0, -0.16, -0.08],
    joints: { ...LUNGE_LEGS, chest: [-0.3, 0, 0], spine: [-0.24, 0, 0] },
    sword: {
      hand: [0.08, 1.32, -0.58],
      blade: [0, 0.08, -1],
      spine: [0, 1, 0.1],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  strikeEnd: vary(GUARD, {
    root: [0, -0.24, -0.1],
    joints: { ...LUNGE_LEGS, chest: [-0.45, 0, 0], spine: [-0.36, 0, 0], head: [0.4, 0, 0] },
    sword: {
      hand: [0.06, 0.88, -0.52],
      blade: [0, -0.72, -0.7],
      spine: [0, 0.7, -0.72],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  followThrough: vary(GUARD, {
    root: [0, -0.24, -0.08],
    joints: { ...LUNGE_LEGS, chest: [-0.42, 0, 0], spine: [-0.34, 0, 0], head: [0.35, 0, 0] },
    sword: {
      hand: [0.1, 0.76, -0.4],
      blade: [0.1, -0.92, -0.36],
      spine: [0, 0.36, -0.92],
      pole: [0.85, -0.4, 0.2],
    },
  }),
  recover: GUARD,
};

// ------------------------------------------------------------------ remate
/**
 * Remate (57 ticks): agazaparse con la punta apuntando -> estocada profunda -> se SOSTIENE
 * dentro (camara lenta en el render) -> arrancar la hoja con un giro -> chiburi (sacudir la
 * hoja) -> guardia. Los ticks se derivan del AttackDef `deathblow`.
 */
const DB = PLAYER_ATTACKS.deathblow;
const DB_TOTAL = DB.startupTicks + DB.activeTicks + DB.recoveryTicks;
/** Tick (dentro del clip) en que se arranca la hoja: lo usan los efectos y el enemigo. */
export const DEATHBLOW_PULL_TICK = DB.startupTicks + DB.activeTicks + 14;

const DB_CROUCH = vary(GUARD, {
  root: [0, -0.2, 0.08],
  joints: {
    ...COIL_LEGS,
    thigh_r: [0.3, -0.1, 0.06],
    shin_r: [-1.1, 0, 0],
    foot_r: [0.8, 0, 0],
    chest: [-0.15, -0.55, 0],
    spine: [-0.2, -0.2, 0],
    head: [0.3, 0.45, 0],
    upperarm_l: [1.5, 0, -0.1],
    forearm_l: [0.2, 0, 0],
  },
  sword: {
    hand: [0.3, 1.1, 0.22],
    blade: [-0.08, 0.05, -1],
    spine: [0, 1, 0],
    pole: [0.7, -0.6, 0.4],
  },
});
const DB_STAB = vary(GUARD, {
  root: [0, -0.22, -0.14],
  joints: {
    ...LUNGE_LEGS,
    thigh_l: [0.95, 0.05, -0.05],
    shin_l: [-1.2, 0, 0],
    chest: [-0.25, 0.3, 0],
    spine: [-0.28, 0.1, 0],
    head: [0.3, -0.2, 0],
    upperarm_l: [0.4, 0, -0.5],
    forearm_l: [0.6, 0, 0],
  },
  sword: {
    hand: [0.04, 1.2, -0.66],
    blade: [-0.02, -0.04, -1],
    spine: [0, 1, 0],
    pole: [0.85, -0.4, 0.1],
  },
});
const DB_TWIST = vary(DB_STAB, {
  joints: { chest: [-0.22, 0.42, 0.05] },
  sword: { hand: [0.06, 1.2, -0.62], spine: [-0.7, 0.7, 0] },
});
const DB_RIP = vary(GUARD, {
  root: [0, -0.16, -0.06],
  joints: { ...LUNGE_LEGS, chest: [-0.1, -0.6, 0], spine: [-0.12, -0.25, 0], head: [0.15, 0.4, 0] },
  sword: {
    hand: [0.5, 1.3, -0.12],
    blade: [0.82, 0.2, 0.52],
    spine: [0, 1, 0],
    pole: [0.6, -0.4, 0.6],
  },
});
const DB_CHIBURI = vary(GUARD, {
  root: [0, -0.12, 0],
  joints: { ...DEEP_LEGS, chest: [-0.08, -0.4, 0], spine: [-0.1, -0.18, 0], head: [0.2, 0.2, 0] },
  sword: {
    hand: [0.42, 0.98, -0.32],
    blade: [0.55, -0.62, -0.55],
    spine: [0, 0.6, -0.8],
    pole: [0.7, -0.5, 0.4],
  },
});

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
  deflect_left: deflectClip('deflect_1', DEFLECT_LEFT_CONTACT, DEFLECT_LEFT_RECOIL),
  deflect_right: deflectClip('deflect_2', DEFLECT_RIGHT_CONTACT, DEFLECT_RIGHT_RECOIL),
  deflect_high: deflectClip('deflect_high', DEFLECT_HIGH_CONTACT, DEFLECT_HIGH_RECOIL),
  deflect_thrust: deflectClip('deflect_thrust', DEFLECT_THRUST_CONTACT, DEFLECT_THRUST_RECOIL),
  block_hit: clip('block_hit', combatConfig.blockStunTicks + 6, false, [
    key(0, BLOCK_PUSHED),
    key(6, BLOCK_PUSHED, 'hold'),
    key(combatConfig.blockStunTicks + 6, GUARD, 'out'),
  ]),
  hit_react: clip('hit_react', combatConfig.hitStunTicks, false, [
    key(0, HIT_REACT),
    key(5, HIT_REACT, 'hold'),
    key(11, HIT_HUNCH, 'snap'),
    key(combatConfig.hitStunTicks, IDLE, 'out'),
  ]),
  guard_break: clip('guard_break', combatConfig.guardBreakTicks, false, [
    key(0, GUARD_BROKEN),
    key(8, GUARD_BROKEN, 'hold'),
    key(16, GUARD_BROKEN_SLUMP, 'snap'),
    key(combatConfig.guardBreakTicks - 12, GUARD_BROKEN_SLUMP, 'linear'),
    key(combatConfig.guardBreakTicks, GUARD, 'out'),
  ]),
  /** Rebote de la hoja propia contra la guardia enemiga (visual, no corta el combo). */
  attack_bounced: clip('attack_bounced', 8, false, [
    key(0, ATTACK_BOUNCED),
    key(8, ATTACK_BOUNCED, 'hold'),
  ]),
  atk_1: attackClip('atk_1', PLAYER_ATTACKS.atk_1, ATK1, { holdTicks: 3 }),
  atk_2: attackClip('atk_2', PLAYER_ATTACKS.atk_2, ATK2, { holdTicks: 3 }),
  atk_3: attackClip('atk_3', PLAYER_ATTACKS.atk_3, ATK3, { holdTicks: 6, windupAt: 0.35 }),
  deathblow: clip('deathblow', DB_TOTAL, false, [
    key(0, GUARD),
    key(4, DB_CROUCH, 'snap'),
    key(DB.startupTicks - 1, DB_CROUCH, 'linear'),
    key(DB.startupTicks + 1, DB_STAB, 'snap'),
    key(DEATHBLOW_PULL_TICK - 4, DB_STAB, 'hold'),
    key(DEATHBLOW_PULL_TICK - 1, DB_TWIST, 'snap'),
    key(DEATHBLOW_PULL_TICK + 2, DB_RIP, 'snap'),
    key(DEATHBLOW_PULL_TICK + 7, DB_RIP, 'hold'),
    key(DEATHBLOW_PULL_TICK + 10, DB_CHIBURI, 'snap'),
    key(DEATHBLOW_PULL_TICK + 18, DB_CHIBURI, 'hold'),
    key(DB_TOTAL, GUARD, 'out'),
  ]),
} satisfies Record<string, Clip>;

export type RoninClipId = keyof typeof RONIN_CLIPS;
