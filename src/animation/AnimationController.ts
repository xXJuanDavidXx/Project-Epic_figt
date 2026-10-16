import * as THREE from 'three';
import type { Clip, Pose } from '@/animation/types';
import { FK_JOINTS } from '@/animation/rig';
import { blendPoses, clipFinished, sampleClip } from '@/animation/sampler';
import type { HumanoidRig } from '@/render/character/humanoid';

export interface PlayOptions {
  /** Ticks de crossfade desde la pose actual. 0 = corte seco (deflects, impactos). */
  fadeTicks?: number;
  /** Reiniciar aunque ya se este reproduciendo este clip. */
  restart?: boolean;
  /** Tick inicial dentro del clip. */
  startAt?: number;
  /** Velocidad de reproduccion (1 = un tick de clip por tick de simulacion). */
  speed?: number;
}

/**
 * Reproduce clips sobre un HumanoidRig.
 *
 * - El TIEMPO avanza en la simulacion (`tick()`), una vez por tick y nunca en hitstop: la
 *   animacion queda sincronizada con las ventanas de combate.
 * - La POSE se aplica en el render (`apply(alpha)`), interpolando entre ticks.
 * - El brazo de la espada (y la mano libre) se resuelven por IK de dos huesos.
 *
 * No decide reglas de juego (CLAUDE.md seccion 11): solo dibuja lo que la FSM ya decidio.
 */
export class AnimationController {
  private current: Clip;
  private time = 0;
  private speed = 1;
  private previousPose: Pose | null = null;
  private fadeDuration = 0;
  private fadeElapsed = 0;
  private trembleAmount = 0;
  private trembleSeed = 0;

  // Scratch: cero allocations por frame.
  private readonly shoulder = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly qParent = new THREE.Quaternion();
  private readonly qDesired = new THREE.Quaternion();
  private readonly qRoot = new THREE.Quaternion();
  private readonly qFk = new THREE.Quaternion();
  private readonly basis = new THREE.Matrix4();
  private readonly xAxis = new THREE.Vector3();
  private readonly yAxis = new THREE.Vector3();
  private readonly zAxis = new THREE.Vector3();
  private readonly down = new THREE.Vector3(0, -1, 0);
  /** Posicion de reposo del nodo raiz (p. ej. bajar los pies al suelo de la capsula). */
  private readonly basePosition = new THREE.Vector3();

  constructor(
    readonly rig: HumanoidRig,
    initial: Clip,
  ) {
    this.current = initial;
    this.basePosition.copy(rig.root.position);
  }

  get clip(): Clip {
    return this.current;
  }

  get clipName(): string {
    return this.current.name;
  }

  get clipTime(): number {
    return this.time;
  }

  get finished(): boolean {
    return clipFinished(this.current, this.time);
  }

  play(clip: Clip, options: PlayOptions = {}): void {
    if (clip === this.current && !options.restart) return;
    const fade = options.fadeTicks ?? 6;
    this.previousPose = fade > 0 ? this.samplePose(0) : null;
    this.fadeDuration = fade;
    this.fadeElapsed = 0;
    this.current = clip;
    this.time = options.startAt ?? 0;
    this.speed = options.speed ?? 1;
  }

  /** Un tick de simulacion. No llamar durante el hitstop. */
  tick(): void {
    this.time += this.speed;
    if (this.previousPose && this.fadeElapsed < this.fadeDuration) {
      this.fadeElapsed += 1;
    }
  }

  /** Temblor de las hojas durante el hitstop (choque de acero). 0 = nada. */
  setTremble(amount: number): void {
    this.trembleAmount = amount;
  }

  /** Aplica la pose del instante `time + alpha` al rig. */
  apply(alpha: number): void {
    const pose = this.samplePose(alpha);
    this.applyPose(pose);
  }

  /** Pose que se veria ahora (para crossfades y para el debug). */
  samplePose(alpha: number): Pose {
    const t = this.time + alpha * this.speed;
    const target = sampleClip(this.current, t);
    if (!this.previousPose || this.fadeDuration <= 0) return target;
    const w = Math.min((this.fadeElapsed + alpha) / this.fadeDuration, 1);
    if (w >= 1) {
      this.previousPose = null;
      return target;
    }
    return blendPoses(this.previousPose, target, w);
  }

  applyPose(pose: Pose): void {
    const { joints, root } = this.rig;

    root.position.set(
      this.basePosition.x + pose.root[0],
      this.basePosition.y + pose.root[1],
      this.basePosition.z + pose.root[2],
    );
    for (const name of FK_JOINTS) {
      const r = pose.joints[name];
      if (r) joints[name].rotation.set(r[0], r[1], r[2]);
      else joints[name].rotation.set(0, 0, 0);
    }
    // El padre (el objeto que mueve la simulacion) puede no haber actualizado su matriz.
    root.parent?.updateWorldMatrix(true, false);
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(this.qRoot);

    this.solveSwordArm(pose);
    if (pose.offHand.weight > 0.001) this.solveOffHand(pose);
  }

  private solveSwordArm(pose: Pose): void {
    const { joints, proportions, root } = this.rig;
    const sword = pose.sword;

    // 1. Orientacion de la mano: hoja -> -Z local, lomo -> +Y local.
    this.zAxis.set(-sword.blade[0], -sword.blade[1], -sword.blade[2]).normalize();
    this.yAxis.set(sword.spine[0], sword.spine[1], sword.spine[2]);
    this.yAxis.addScaledVector(this.zAxis, -this.yAxis.dot(this.zAxis)).normalize();
    if (this.yAxis.lengthSq() < 1e-6) this.yAxis.set(0, 1, 0);
    this.xAxis.crossVectors(this.yAxis, this.zAxis).normalize();
    this.basis.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    this.qDesired.setFromRotationMatrix(this.basis).premultiply(this.qRoot);

    // 2. Objetivo del agarre (weapon_r) en el mundo, con temblor opcional.
    this.target.set(sword.hand[0], sword.hand[1], sword.hand[2]);
    if (this.trembleAmount > 0) {
      this.trembleSeed += 1;
      const s = this.trembleSeed;
      this.target.x += Math.sin(s * 12.9898) * this.trembleAmount;
      this.target.y += Math.sin(s * 78.233) * this.trembleAmount;
      this.target.z += Math.sin(s * 37.719) * this.trembleAmount;
    }
    root.localToWorld(this.target);

    // weapon_r cuelga de la mano: la muñeca esta "detras" del agarre.
    this.tmp.copy(joints.weapon_r.position).applyQuaternion(this.qDesired);
    this.target.sub(this.tmp);

    this.pole.set(sword.pole[0], sword.pole[1], sword.pole[2]).applyQuaternion(this.qRoot);
    this.solveTwoBone(
      joints.upperarm_r,
      joints.forearm_r,
      this.target,
      this.pole,
      proportions.upperArm,
      proportions.forearm,
      1,
    );

    // 3. Mano: rotacion local = inversa(padre) * deseada.
    joints.forearm_r.getWorldQuaternion(this.qParent);
    joints.hand_r.quaternion.copy(this.qParent.invert().multiply(this.qDesired));
    joints.hand_r.updateMatrixWorld(true);
  }

  private solveOffHand(pose: Pose): void {
    const { joints, proportions, root, swordGeometry } = this.rig;
    const off = pose.offHand;
    if (off.grip) {
      this.target.set(0, 0, swordGeometry.offHandGrip);
      joints.weapon_r.localToWorld(this.target);
    } else {
      this.target.set(off.hand[0], off.hand[1], off.hand[2]);
      root.localToWorld(this.target);
    }
    this.pole.set(off.pole[0], off.pole[1], off.pole[2]).applyQuaternion(this.qRoot);
    this.solveTwoBone(
      joints.upperarm_l,
      joints.forearm_l,
      this.target,
      this.pole,
      proportions.upperArm,
      proportions.forearm + proportions.hand * 0.5,
      off.weight,
    );
    if (off.grip) {
      // La mano libre adopta la orientacion del arma, girada para envolver el mango.
      joints.weapon_r.getWorldQuaternion(this.qDesired);
      joints.forearm_l.getWorldQuaternion(this.qParent);
      this.qFk.copy(joints.hand_l.quaternion);
      joints.hand_l.quaternion.copy(this.qParent.invert().multiply(this.qDesired));
      joints.hand_l.quaternion.slerp(this.qFk, 1 - off.weight);
      joints.hand_l.updateMatrixWorld(true);
    }
  }

  /**
   * IK analitica de dos huesos. Ambos huesos apuntan a -Y local en reposo.
   * `weight` mezcla con la rotacion FK ya puesta (1 = IK pura).
   */
  private solveTwoBone(
    upper: THREE.Object3D,
    lower: THREE.Object3D,
    target: THREE.Vector3,
    poleDir: THREE.Vector3,
    upperLength: number,
    lowerLength: number,
    weight: number,
  ): void {
    upper.getWorldPosition(this.shoulder);
    this.dir.subVectors(target, this.shoulder);
    const maxReach = (upperLength + lowerLength) * 0.999;
    const minReach = Math.abs(upperLength - lowerLength) + 1e-3;
    const distance = THREE.MathUtils.clamp(this.dir.length(), minReach, maxReach);
    if (this.dir.lengthSq() < 1e-8) this.dir.set(0, -1, 0);
    this.dir.normalize();

    // Plano del codo: componente del polo perpendicular a la direccion hombro -> objetivo.
    this.tmp.copy(poleDir).addScaledVector(this.dir, -poleDir.dot(this.dir));
    if (this.tmp.lengthSq() < 1e-6) this.tmp.set(0, -1, 0).addScaledVector(this.dir, this.dir.y);
    this.tmp.normalize();

    const a =
      (upperLength * upperLength - lowerLength * lowerLength + distance * distance) /
      (2 * distance);
    const h = Math.sqrt(Math.max(upperLength * upperLength - a * a, 0));
    this.elbow.copy(this.shoulder).addScaledVector(this.dir, a).addScaledVector(this.tmp, h);
    const reachTarget = this.tmp2.copy(this.shoulder).addScaledVector(this.dir, distance);

    // Hueso superior.
    this.qFk.copy(upper.quaternion);
    this.aimBone(upper, this.elbow);
    if (weight < 1) upper.quaternion.copy(this.qFk.slerp(upper.quaternion, weight));
    upper.updateMatrixWorld(true);

    // Hueso inferior.
    this.qFk.copy(lower.quaternion);
    lower.getWorldPosition(this.elbow);
    this.aimBone(lower, reachTarget);
    if (weight < 1) lower.quaternion.copy(this.qFk.slerp(lower.quaternion, weight));
    lower.updateMatrixWorld(true);
  }

  /** Gira `bone` (reposo hacia -Y local) para que apunte a `worldPoint`. */
  private aimBone(bone: THREE.Object3D, worldPoint: THREE.Vector3): void {
    const origin = bone.getWorldPosition(this.tmp);
    const direction = this.zAxis.subVectors(worldPoint, origin).normalize();
    const parent = bone.parent;
    if (parent) {
      parent.getWorldQuaternion(this.qParent);
      direction.applyQuaternion(this.qParent.invert());
    }
    bone.quaternion.setFromUnitVectors(this.down, direction);
  }
}
