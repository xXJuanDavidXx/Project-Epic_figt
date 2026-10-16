import * as THREE from 'three';
import { debugConfig } from '@/config/debug';
import type { Combatant } from '@/combat/Combatant';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';

/** Wireframe de hurtboxes (azul) e hitboxes activas (rojo). Solo dev. */
export class HitboxView implements RenderUpdateSystem {
  private readonly hurtboxes = new Map<Combatant, THREE.LineSegments>();
  private readonly hitboxes = new Map<Combatant, THREE.LineSegments>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly combatants: () => readonly Combatant[],
  ) {}

  renderUpdate(_ctx: FrameContext): void {
    for (const combatant of this.combatants()) {
      const hurt = this.hurtboxFor(combatant);
      const hit = this.hitboxFor(combatant);
      hurt.visible = debugConfig.showHitboxes && combatant.alive;
      const swing = combatant.activeSwing();
      hit.visible = debugConfig.showHitboxes && swing !== null;
      if (!debugConfig.showHitboxes) continue;
      const capsule = combatant.hurtbox();
      hurt.position.set(
        (capsule.a.x + capsule.b.x) / 2,
        (capsule.a.y + capsule.b.y) / 2,
        (capsule.a.z + capsule.b.z) / 2,
      );
      if (swing) {
        hit.position.set(swing.hitbox.center.x, swing.hitbox.center.y, swing.hitbox.center.z);
        hit.scale.setScalar(swing.hitbox.radius);
      }
    }
  }

  private hurtboxFor(combatant: Combatant): THREE.LineSegments {
    let mesh = this.hurtboxes.get(combatant);
    if (!mesh) {
      const capsule = combatant.hurtbox();
      const half = (capsule.b.y - capsule.a.y) / 2;
      mesh = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.CapsuleGeometry(capsule.radius, half * 2, 4, 10)),
        new THREE.LineBasicMaterial({
          color: 0x58b4ff,
          depthTest: false,
          transparent: true,
          opacity: 0.6,
        }),
      );
      mesh.renderOrder = 998;
      this.scene.add(mesh);
      this.hurtboxes.set(combatant, mesh);
    }
    return mesh;
  }

  private hitboxFor(combatant: Combatant): THREE.LineSegments {
    let mesh = this.hitboxes.get(combatant);
    if (!mesh) {
      mesh = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 10, 8)),
        new THREE.LineBasicMaterial({ color: 0xff4a3a, depthTest: false }),
      );
      mesh.renderOrder = 999;
      this.scene.add(mesh);
      this.hitboxes.set(combatant, mesh);
    }
    return mesh;
  }
}
