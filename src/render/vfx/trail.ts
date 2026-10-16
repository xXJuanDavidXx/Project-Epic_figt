import * as THREE from 'three';
import type { HumanoidRig } from '@/render/character/humanoid';

/**
 * Estela de la hoja: una cinta entre las ultimas posiciones de la base y la punta.
 * Solo existe durante los ticks activos de un golpe (y se apaga en un instante): marca el
 * arco del tajo sin suavizar la animacion, que sigue siendo cortada.
 */
export class BladeTrail {
  readonly mesh: THREE.Mesh;
  private readonly samples = 10;
  private readonly base: THREE.Vector3[] = [];
  private readonly tip: THREE.Vector3[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private count = 0;
  private energy = 0;
  private active = false;
  private readonly scratchBase = new THREE.Vector3();
  private readonly scratchTip = new THREE.Vector3();

  constructor(
    private readonly rig: HumanoidRig,
    private readonly color: THREE.Color,
  ) {
    this.positions = new Float32Array(this.samples * 2 * 3);
    this.colors = new Float32Array(this.samples * 2 * 3);
    const indices: number[] = [];
    for (let i = 0; i < this.samples - 1; i += 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setIndex(indices);
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    for (let i = 0; i < this.samples; i += 1) {
      this.base.push(new THREE.Vector3());
      this.tip.push(new THREE.Vector3());
    }
  }

  setActive(active: boolean): void {
    if (active && !this.active) {
      this.count = 0;
      this.energy = 1;
    }
    this.active = active;
  }

  update(dt: number): void {
    if (this.active) {
      // Nueva muestra delante; se desplazan las viejas.
      const lastBase = this.base.pop();
      const lastTip = this.tip.pop();
      if (lastBase && lastTip) {
        this.scratchBase.copy(this.rig.sword.bladeBase);
        this.scratchTip.copy(this.rig.sword.bladeTip);
        this.rig.joints.weapon_r.localToWorld(this.scratchBase);
        this.rig.joints.weapon_r.localToWorld(this.scratchTip);
        // La cinta empieza a un tercio de la hoja: la estela es de la punta, no del mango.
        lastBase.lerpVectors(this.scratchBase, this.scratchTip, 0.35);
        lastTip.copy(this.scratchTip);
        this.base.unshift(lastBase);
        this.tip.unshift(lastTip);
      }
      this.count = Math.min(this.count + 1, this.samples);
    } else {
      this.energy = Math.max(0, this.energy - dt * 9);
    }

    const visible = this.count > 1 && this.energy > 0.01;
    this.mesh.visible = visible;
    if (!visible) return;

    for (let i = 0; i < this.samples; i += 1) {
      const j = Math.min(i, this.count - 1);
      const b = this.base[j];
      const t = this.tip[j];
      if (!b || !t) continue;
      const o = i * 6;
      this.positions.set([b.x, b.y, b.z, t.x, t.y, t.z], o);
      const fade = (1 - i / (this.samples - 1)) ** 1.6 * this.energy;
      this.colors.set(
        [
          this.color.r * fade * 0.25,
          this.color.g * fade * 0.25,
          this.color.b * fade * 0.25,
          this.color.r * fade,
          this.color.g * fade,
          this.color.b * fade,
        ],
        o,
      );
    }
    const geometry = this.mesh.geometry;
    (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}
