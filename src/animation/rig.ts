import type { JointName, Vec3Tuple } from '@/animation/types';

/**
 * Esqueleto del humanoide procedural. Nombres compatibles con la convencion de huesos de
 * CLAUDE.md seccion 9, para que en M5 un .glb de Blender pueda sustituirlo.
 *
 * Reposo: de pie, brazos colgando, mirando a -Z. Medidas para ~1.80 m.
 */
export interface JointDef {
  name: JointName | 'root' | 'weapon_r';
  parent: JointDef['name'] | null;
  /** Posicion respecto al padre, en metros. */
  offset: Vec3Tuple;
}

export interface RigProportions {
  hipHeight: number;
  upperArm: number;
  forearm: number;
  hand: number;
  thigh: number;
  shin: number;
  shoulderWidth: number;
  hipWidth: number;
}

export const DEFAULT_PROPORTIONS: RigProportions = {
  hipHeight: 0.98,
  upperArm: 0.29,
  forearm: 0.26,
  hand: 0.07,
  thigh: 0.44,
  shin: 0.43,
  shoulderWidth: 0.19,
  hipWidth: 0.1,
};

export function buildJointDefs(p: RigProportions = DEFAULT_PROPORTIONS): JointDef[] {
  return [
    { name: 'root', parent: null, offset: [0, 0, 0] },
    { name: 'hips', parent: 'root', offset: [0, p.hipHeight, 0] },
    { name: 'spine', parent: 'hips', offset: [0, 0.1, 0] },
    { name: 'chest', parent: 'spine', offset: [0, 0.18, 0] },
    { name: 'neck', parent: 'chest', offset: [0, 0.24, 0] },
    { name: 'head', parent: 'neck', offset: [0, 0.07, 0] },
    { name: 'upperarm_l', parent: 'chest', offset: [-p.shoulderWidth, 0.17, 0] },
    { name: 'forearm_l', parent: 'upperarm_l', offset: [0, -p.upperArm, 0] },
    { name: 'hand_l', parent: 'forearm_l', offset: [0, -p.forearm, 0] },
    { name: 'upperarm_r', parent: 'chest', offset: [p.shoulderWidth, 0.17, 0] },
    { name: 'forearm_r', parent: 'upperarm_r', offset: [0, -p.upperArm, 0] },
    { name: 'hand_r', parent: 'forearm_r', offset: [0, -p.forearm, 0] },
    { name: 'weapon_r', parent: 'hand_r', offset: [0, -p.hand * 0.5, 0] },
    { name: 'thigh_l', parent: 'hips', offset: [-p.hipWidth, -0.04, 0] },
    { name: 'shin_l', parent: 'thigh_l', offset: [0, -p.thigh, 0] },
    { name: 'foot_l', parent: 'shin_l', offset: [0, -p.shin, 0] },
    { name: 'thigh_r', parent: 'hips', offset: [p.hipWidth, -0.04, 0] },
    { name: 'shin_r', parent: 'thigh_r', offset: [0, -p.thigh, 0] },
    { name: 'foot_r', parent: 'shin_r', offset: [0, -p.shin, 0] },
  ];
}

export const FK_JOINTS: readonly JointName[] = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'upperarm_l',
  'forearm_l',
  'hand_l',
  'upperarm_r',
  'forearm_r',
  'hand_r',
  'thigh_l',
  'shin_l',
  'foot_l',
  'thigh_r',
  'shin_r',
  'foot_r',
];

/** Geometria de la espada en el espacio de `weapon_r`: la hoja apunta a -Z. */
export interface SwordGeometry {
  /** Distancia de la mano al final del mango (detras de la mano, +Z). */
  handleBack: number;
  /** Donde esta la guarda (tsuba), delante de la mano. */
  guard: number;
  /** Longitud de la hoja desde la guarda. */
  bladeLength: number;
  /** Donde agarra la segunda mano, detras de la principal. */
  offHandGrip: number;
}

export const KATANA: SwordGeometry = {
  handleBack: 0.2,
  guard: 0.05,
  bladeLength: 0.74,
  offHandGrip: 0.11,
};

export const LONG_BLADE: SwordGeometry = {
  handleBack: 0.3,
  guard: 0.06,
  bladeLength: 0.98,
  offHandGrip: 0.17,
};
