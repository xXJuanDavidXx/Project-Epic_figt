import * as THREE from 'three';
import type { PhysicsWorld } from '@/physics/world';
import { physicsConfig } from '@/config/physics';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';

/**
 * Wireframe de los colliders usando el debug render pipeline de Rapier.
 * Se activa/desactiva con `physicsConfig.debugWireframe` desde lil-gui.
 * En M2 este mismo visor mostrara hitboxes y hurtboxes.
 */
export class PhysicsDebugView implements RenderUpdateSystem {
  private readonly lines: THREE.LineSegments;
  private readonly geometry: THREE.BufferGeometry;

  constructor(
    private readonly physics: PhysicsWorld,
    scene: THREE.Scene,
  ) {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 4));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false });
    this.lines = new THREE.LineSegments(this.geometry, material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 999;
    this.lines.visible = false;
    scene.add(this.lines);
  }

  renderUpdate(_ctx: FrameContext): void {
    this.lines.visible = physicsConfig.debugWireframe;
    if (!physicsConfig.debugWireframe) return;

    const buffers = this.physics.world.debugRender();
    this.setAttribute('position', buffers.vertices, 3);
    this.setAttribute('color', buffers.colors, 4);
  }

  private setAttribute(name: string, data: Float32Array, itemSize: number): void {
    const existing = this.geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (existing && existing.array.length === data.length) {
      (existing.array as Float32Array).set(data);
      existing.needsUpdate = true;
      return;
    }
    this.geometry.setAttribute(name, new THREE.BufferAttribute(data, itemSize));
  }

  dispose(): void {
    this.lines.removeFromParent();
    this.geometry.dispose();
  }
}
