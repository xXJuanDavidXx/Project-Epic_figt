import * as THREE from 'three';

/**
 * Chispas como trazos de linea (cabeza brillante, cola en la direccion contraria a la
 * velocidad). Aditivas y en HDR: con el bloom parecen acero al rojo. Pool fijo, sin
 * allocations por frame.
 */
export class SparkSystem {
  readonly object: THREE.LineSegments;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vz: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly cr: Float32Array;
  private readonly cg: Float32Array;
  private readonly cb: Float32Array;
  private next = 0;

  constructor(private readonly capacity = 600) {
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 6);
    this.colors = new Float32Array(capacity * 6);
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.object = new THREE.LineSegments(geometry, material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 10;

    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.cr = new Float32Array(capacity);
    this.cg = new Float32Array(capacity);
    this.cb = new Float32Array(capacity);
  }

  /**
   * Rafaga de chispas.
   * @param normal direccion principal de salida (se abre en un cono amplio alrededor).
   */
  burst(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    count: number,
    speed: [number, number],
    life: [number, number],
    color: [number, number, number],
  ): void {
    for (let n = 0; n < count; n += 1) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      // Direccion: normal + ruido esferico; una parte sale hacia el lado contrario (simetria del choque).
      let dx = normal.x + (Math.random() * 2 - 1) * 0.9;
      const dy = normal.y + (Math.random() * 2 - 1) * 0.9 + 0.35;
      let dz = normal.z + (Math.random() * 2 - 1) * 0.9;
      if (Math.random() < 0.35) {
        dx = -dx;
        dz = -dz;
      }
      const length = Math.hypot(dx, dy, dz) || 1;
      const s = speed[0] + Math.random() * (speed[1] - speed[0]);
      this.px[i] = origin.x;
      this.py[i] = origin.y;
      this.pz[i] = origin.z;
      this.vx[i] = (dx / length) * s;
      this.vy[i] = (dy / length) * s;
      this.vz[i] = (dz / length) * s;
      const l = life[0] + Math.random() * (life[1] - life[0]);
      this.life[i] = l;
      this.maxLife[i] = l;
      // Variacion de temperatura: unas mas blancas, otras mas naranjas.
      const heat = 0.7 + Math.random() * 0.6;
      this.cr[i] = color[0] * heat;
      this.cg[i] = color[1] * heat * (0.8 + Math.random() * 0.3);
      this.cb[i] = color[2] * heat * Math.random();
    }
  }

  update(dt: number): void {
    const gravity = 13;
    const drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < this.capacity; i += 1) {
      const o = i * 6;
      if (this.life[i]! <= 0) {
        this.colors[o] = this.colors[o + 1] = this.colors[o + 2] = 0;
        this.colors[o + 3] = this.colors[o + 4] = this.colors[o + 5] = 0;
        continue;
      }
      this.life[i]! -= dt;
      this.vx[i]! *= drag;
      this.vy[i] = this.vy[i]! * drag - gravity * dt;
      this.vz[i]! *= drag;
      this.px[i]! += this.vx[i]! * dt;
      this.py[i]! += this.vy[i]! * dt;
      this.pz[i]! += this.vz[i]! * dt;

      const t = Math.max(this.life[i]! / this.maxLife[i]!, 0);
      const streak = 0.03;
      this.positions[o] = this.px[i]!;
      this.positions[o + 1] = this.py[i]!;
      this.positions[o + 2] = this.pz[i]!;
      this.positions[o + 3] = this.px[i]! - this.vx[i]! * streak;
      this.positions[o + 4] = this.py[i]! - this.vy[i]! * streak;
      this.positions[o + 5] = this.pz[i]! - this.vz[i]! * streak;
      const fade = t * t;
      this.colors[o] = this.cr[i]! * fade;
      this.colors[o + 1] = this.cg[i]! * fade;
      this.colors[o + 2] = this.cb[i]! * fade;
      this.colors[o + 3] = this.cr[i]! * fade * 0.25;
      this.colors[o + 4] = this.cg[i]! * fade * 0.12;
      this.colors[o + 5] = 0;
    }
    const geometry = this.object.geometry;
    (geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Salpicaduras (tinta o sangre) como puntos con gravedad. */
export class SplatterSystem {
  readonly object: THREE.Points;
  private readonly positions: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private next = 0;

  constructor(
    texture: THREE.Texture,
    private readonly capacity = 300,
  ) {
    this.positions = new Float32Array(capacity * 3).fill(-9999);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const material = new THREE.PointsMaterial({
      size: 0.07,
      map: texture,
      transparent: true,
      depthWrite: false,
      color: 0x2a0606,
      sizeAttenuation: true,
    });
    this.object = new THREE.Points(geometry, material);
    this.object.frustumCulled = false;
  }

  setColor(color: number): void {
    (this.object.material as THREE.PointsMaterial).color.setHex(color);
  }

  burst(origin: THREE.Vector3, direction: { x: number; z: number }, count: number): void {
    for (let n = 0; n < count; n += 1) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      const o = i * 3;
      this.positions[o] = origin.x;
      this.positions[o + 1] = origin.y;
      this.positions[o + 2] = origin.z;
      const s = 1.5 + Math.random() * 3.5;
      this.vel[o] = direction.x * s + (Math.random() - 0.5) * 2.5;
      this.vel[o + 1] = 0.8 + Math.random() * 2.8;
      this.vel[o + 2] = direction.z * s + (Math.random() - 0.5) * 2.5;
      this.life[i] = 0.4 + Math.random() * 0.5;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i += 1) {
      const o = i * 3;
      if (this.life[i]! <= 0) {
        this.positions[o + 1] = -9999;
        continue;
      }
      this.life[i]! -= dt;
      this.vel[o + 1]! -= 14 * dt;
      this.positions[o]! += this.vel[o]! * dt;
      this.positions[o + 1]! += this.vel[o + 1]! * dt;
      this.positions[o + 2]! += this.vel[o + 2]! * dt;
      if (this.positions[o + 1]! < 0.02) {
        // Se queda pegada al suelo un instante antes de desaparecer.
        this.positions[o + 1] = 0.02;
        this.vel[o] = this.vel[o + 1] = this.vel[o + 2] = 0;
      }
    }
    (this.object.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
