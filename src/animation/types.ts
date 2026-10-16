/**
 * Tipos del sistema de animacion. Modulo PURO (sin Three.js): poses y clips son datos.
 *
 * Convenciones del espacio "cuerpo" (el del nodo raiz del personaje):
 * origen en los pies, adelante = -Z, derecha = +X, arriba = +Y. Metros.
 */

export type Vec3Tuple = readonly [number, number, number];

/** Rotacion local de una articulacion en radianes (orden XYZ de Three). */
export type JointRotation = Vec3Tuple;

/**
 * Brazo de la espada resuelto por IK: se describe DONDE esta la mano y HACIA DONDE apunta
 * la hoja, no los angulos del hombro y el codo. Asi se pueden colocar choques de hojas exactos.
 */
export interface SwordIK {
  /** Posicion de la mano en espacio cuerpo. */
  hand: Vec3Tuple;
  /** Direccion de la punta de la hoja (se normaliza). */
  blade: Vec3Tuple;
  /** Hacia donde mira el lomo de la hoja; el filo queda opuesto. Se ortogonaliza. */
  spine: Vec3Tuple;
  /** Hacia donde apunta el codo (vector desde el hombro). */
  pole: Vec3Tuple;
}

/** Mano libre por IK. `grip` = agarrar el mango de la espada (dos manos). */
export interface OffHandIK {
  /** Peso de la IK frente a la pose FK, 0..1. */
  weight: number;
  /** Posicion de la mano en espacio cuerpo; ignorada si `grip` es true. */
  hand: Vec3Tuple;
  grip: boolean;
  pole: Vec3Tuple;
}

export type JointName =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'upperarm_l'
  | 'forearm_l'
  | 'hand_l'
  | 'upperarm_r'
  | 'forearm_r'
  | 'hand_r'
  | 'thigh_l'
  | 'shin_l'
  | 'foot_l'
  | 'thigh_r'
  | 'shin_r'
  | 'foot_r';

export interface Pose {
  /** Rotaciones FK. Las que faltan valen 0 (pose de reposo). */
  joints: Partial<Record<JointName, JointRotation>>;
  /** Desplazamiento del cuerpo (agacharse, balanceo), en espacio cuerpo. */
  root: Vec3Tuple;
  sword: SwordIK;
  offHand: OffHandIK;
}

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'snap' | 'hold';

export interface Keyframe {
  /** Tick dentro del clip. */
  t: number;
  pose: Pose;
  /** Curva del tramo que LLEGA a esta clave. */
  ease?: Ease;
}

export interface Clip {
  name: string;
  durationTicks: number;
  loop: boolean;
  keys: readonly Keyframe[];
}
