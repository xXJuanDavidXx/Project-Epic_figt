import { Quaternion } from 'three';
import type * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { FixedUpdateSystem, FrameContext, RenderUpdateSystem } from '@/core/loop';

/**
 * Liga un rigidbody de Rapier a un Object3D interpolando entre el tick anterior y el
 * actual. Sin esto, el render a 144 Hz de una simulacion a 60 Hz se ve escalonado.
 *
 * La simulacion solo guarda poses; el render solo lee y hace lerp/slerp.
 */
export class InterpolatedBody implements FixedUpdateSystem, RenderUpdateSystem {
  private readonly prev = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  private readonly curr = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
  /** Scratch reutilizado: nada de allocations por frame. */
  private readonly scratchFrom = new Quaternion();
  private readonly scratchTo = new Quaternion();

  constructor(
    private readonly body: RAPIER.RigidBody,
    private readonly object: THREE.Object3D,
  ) {
    this.capture(this.curr);
    this.copy(this.curr, this.prev);
    this.apply(1);
  }

  fixedUpdate(): void {
    this.copy(this.curr, this.prev);
    this.capture(this.curr);
  }

  renderUpdate(ctx: FrameContext): void {
    this.apply(ctx.alpha);
  }

  private capture(target: typeof this.curr): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    target.x = t.x;
    target.y = t.y;
    target.z = t.z;
    target.qx = r.x;
    target.qy = r.y;
    target.qz = r.z;
    target.qw = r.w;
  }

  private copy(from: typeof this.curr, to: typeof this.curr): void {
    to.x = from.x;
    to.y = from.y;
    to.z = from.z;
    to.qx = from.qx;
    to.qy = from.qy;
    to.qz = from.qz;
    to.qw = from.qw;
  }

  private apply(alpha: number): void {
    const a = Math.min(Math.max(alpha, 0), 1);
    this.object.position.set(
      this.prev.x + (this.curr.x - this.prev.x) * a,
      this.prev.y + (this.curr.y - this.prev.y) * a,
      this.prev.z + (this.curr.z - this.prev.z) * a,
    );
    this.scratchFrom.set(this.prev.qx, this.prev.qy, this.prev.qz, this.prev.qw);
    this.scratchTo.set(this.curr.qx, this.curr.qy, this.curr.qz, this.curr.qw);
    this.object.quaternion.copy(this.scratchFrom).slerp(this.scratchTo, a);
  }
}
