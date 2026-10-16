import * as THREE from 'three';
import { feedbackConfig } from '@/config/feedback';
import type { ImpactFeel } from '@/config/feedback';
import type { EventBus } from '@/core/events';
import type { CombatHitPayload, GameEventMap } from '@/core/eventMap';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';
import type { HumanoidRig } from '@/render/character/humanoid';
import type { ThirdPersonCamera } from '@/camera/ThirdPersonCamera';
import { SparkSystem, SplatterSystem } from '@/render/vfx/sparks';
import {
  getDotTexture,
  getFlashTexture,
  getSlashTexture,
  getStarTexture,
} from '@/render/vfx/textures';
import { BladeTrail } from '@/render/vfx/trail';
import type { Combatant } from '@/combat/Combatant';
import { timeDirector } from '@/core/timeDirector';
import { combatConfig } from '@/config/combat';
import { PLAYER_ATTACKS } from '@/combat/attackData';
import { DEATHBLOW_PULL_TICK } from '@/animation/clips/ronin';
import type { SfxSynth } from '@/audio/sfx';

interface Flash {
  sprite: THREE.Sprite;
  age: number;
  duration: number;
  size: number;
}

interface Ring {
  mesh: THREE.Mesh;
  age: number;
  duration: number;
}

interface Mark {
  sprite: THREE.Sprite;
  age: number;
  duration: number;
  width: number;
  height: number;
}

interface Glint {
  rig: HumanoidRig;
  sprite: THREE.Sprite;
  age: number;
  duration: number;
}

/**
 * Feedback visual del combate (CLAUDE.md 5.7). Escucha eventos de la simulacion y los
 * convierte en chispas, destellos, luz, sacudida de camara y brillos de aviso.
 *
 * Se ejecuta en el render DESPUES de posar a los personajes: asi puede calcular el punto
 * exacto donde se cruzan las dos hojas y hacer salir las chispas de ahi.
 */
export class CombatFeedback implements RenderUpdateSystem {
  private readonly rigs = new Map<string, HumanoidRig>();
  private readonly trails = new Map<string, { trail: BladeTrail; owner: Combatant }>();
  private readonly stars: Mark[] = [];
  private readonly slashes: Mark[] = [];
  /** Tirones de remate pendientes: tick global en que ocurren y a quien. */
  private readonly pendingPulls: { atTick: number; victimId: string; attackerId: string }[] = [];
  /** Sonido del tiron (opcional: la presentacion funciona sin audio). */
  sfx: SfxSynth | null = null;
  private readonly pending: CombatHitPayload[] = [];
  private readonly pendingBreaks: { entityId: string }[] = [];
  private readonly pendingDeathblows: {
    victimId: string;
    direction: { x: number; z: number };
    attackerId: string;
    tick: number;
  }[] = [];
  private readonly pendingGlints: string[] = [];

  private readonly sparks = new SparkSystem(700);
  private readonly splatter: SplatterSystem;
  private readonly flashes: Flash[] = [];
  private readonly rings: Ring[] = [];
  private readonly glints: Glint[] = [];
  private readonly light: THREE.PointLight;
  private lightEnergy = 0;
  private readonly bladeFlash = new Map<THREE.MeshStandardMaterial, number>();
  private readonly bodyFlash = new Map<HumanoidRig, number>();

  // Scratch.
  private readonly a0 = new THREE.Vector3();
  private readonly a1 = new THREE.Vector3();
  private readonly b0 = new THREE.Vector3();
  private readonly b1 = new THREE.Vector3();
  private readonly contact = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly cameraRig: ThirdPersonCamera,
    bus: EventBus<GameEventMap>,
  ) {
    scene.add(this.sparks.object);
    this.splatter = new SplatterSystem(getDotTexture());
    scene.add(this.splatter.object);

    this.light = new THREE.PointLight(0xffb36b, 0, 3.2, 2);
    scene.add(this.light);

    for (let i = 0; i < 6; i += 1) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: getFlashTexture(),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      sprite.visible = false;
      sprite.renderOrder = 11;
      scene.add(sprite);
      this.flashes.push({ sprite, age: 1, duration: 1, size: 1 });
    }

    for (let i = 0; i < 4; i += 1) {
      this.stars.push(this.makeMark(getStarTexture()));
      this.slashes.push(this.makeMark(getSlashTexture()));
    }

    for (let i = 0; i < 3; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1, 48),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(2.4, 0.5, 0.2),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, age: 1, duration: 1 });
    }

    bus.on('combat:resolved', (e) => this.pending.push(e));
    bus.on('combat:postureBreak', (e) => this.pendingBreaks.push({ entityId: e.entityId }));
    bus.on('combat:deathblow', (e) => {
      const attacker = this.rigs.get(e.attackerId);
      const dir = { x: 0, z: -1 };
      if (attacker) {
        // getWorldDirection devuelve +Z local; el personaje mira a -Z.
        attacker.root.getWorldDirection(this.tmp);
        dir.x = -this.tmp.x;
        dir.z = -this.tmp.z;
      }
      this.pendingDeathblows.push({
        victimId: e.victimId,
        direction: dir,
        attackerId: e.attackerId,
        tick: e.tick,
      });
    });
    bus.on('combat:telegraph', (e) => this.pendingGlints.push(e.attackerId));
  }

  /** Registra el rig de un combatiente: sus hojas emiten chispas, estela y brillos. */
  register(
    id: string,
    rig: HumanoidRig,
    owner?: Combatant,
    trailColor = new THREE.Color(0.75, 0.72, 0.68),
  ): void {
    this.rigs.set(id, rig);
    if (owner) {
      const trail = new BladeTrail(rig, trailColor);
      this.scene.add(trail.mesh);
      this.trails.set(id, { trail, owner });
    }
  }

  private makeMark(texture: THREE.Texture): Mark {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        transparent: true,
      }),
    );
    sprite.visible = false;
    sprite.renderOrder = 13;
    this.scene.add(sprite);
    return { sprite, age: 1, duration: 1, width: 1, height: 1 };
  }

  private showMark(
    pool: Mark[],
    position: THREE.Vector3,
    width: number,
    height: number,
    duration: number,
    rotation: number,
    color: THREE.Color,
  ): void {
    const mark = pool.find((m) => m.age >= m.duration) ?? pool[0];
    if (!mark) return;
    mark.age = 0;
    mark.duration = duration;
    mark.width = width;
    mark.height = height;
    mark.sprite.position.copy(position);
    mark.sprite.material.rotation = rotation;
    mark.sprite.material.color.copy(color);
    mark.sprite.visible = true;
  }

  private updateMarks(pool: Mark[], dt: number, grow: number): void {
    for (const mark of pool) {
      if (mark.age >= mark.duration) {
        mark.sprite.visible = false;
        continue;
      }
      mark.age += dt;
      const t = Math.min(mark.age / mark.duration, 1);
      // Aparece entero de golpe (frame de impacto) y se estrecha al apagarse.
      mark.sprite.scale.set(mark.width * (1 + t * grow), mark.height * (1 - t * 0.85), 1);
      mark.sprite.material.opacity = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
    }
  }

  renderUpdate(ctx: FrameContext): void {
    // Tiempo del frame ya escalado: el hitstop no frena las chispas (el mundo se congela, el
    // acero no), pero la pausa de debug (timeScale 0) si las congela para poder examinarlas.
    const dt = ctx.frameDelta;

    for (const event of this.pending.splice(0)) this.spawnImpact(event);
    for (const event of this.pendingBreaks.splice(0)) this.spawnPostureBreak(event.entityId);
    for (const event of this.pendingDeathblows.splice(0)) {
      this.spawnDeathblow(event.victimId, event.direction, event.attackerId, event.tick);
    }
    for (const id of this.pendingGlints.splice(0)) this.spawnGlint(id);
    for (let i = this.pendingPulls.length - 1; i >= 0; i -= 1) {
      const pull = this.pendingPulls[i];
      if (pull && ctx.tick >= pull.atTick) {
        this.pendingPulls.splice(i, 1);
        this.spawnDeathblowPull(pull.victimId, pull.attackerId);
      }
    }

    for (const { trail, owner } of this.trails.values()) {
      trail.setActive(owner.alive && owner.activeSwing() !== null);
      trail.update(dt);
    }
    this.updateMarks(this.stars, dt, 0.6);
    this.updateMarks(this.slashes, dt, 0.35);

    this.sparks.update(dt);
    this.splatter.update(dt);
    this.updateFlashes(dt);
    this.updateRings(dt);
    this.updateGlints(dt);
    this.updateMaterialFlashes(dt);

    this.lightEnergy *= Math.exp(-dt * 30);
    this.light.intensity = this.lightEnergy;
  }

  // ------------------------------------------------------------------ impactos
  private spawnImpact(event: CombatHitPayload): void {
    const feel = this.feelFor(event.outcome);
    if (event.outcome === 'evaded') return;

    if (event.outcome === 'hit') {
      this.spawnHit(event);
      return;
    }
    if (!feel) return;

    const attacker = this.rigs.get(event.attackerId);
    const defender = this.rigs.get(event.defenderId);
    this.resolveContact(event, attacker, defender);

    this.sparks.burst(
      this.contact,
      this.normal,
      feel.sparks,
      feel.sparkSpeed,
      feel.sparkLife,
      feel.sparkColor,
    );
    this.flash(this.contact, feel.flashSize, event.outcome === 'deflect_perfect' ? 0.075 : 0.055);
    this.lightEnergy = Math.max(this.lightEnergy, feel.lightIntensity);
    this.light.position.copy(this.contact);
    if (attacker)
      this.bladeFlash.set(attacker.sword.bladeMaterial, event.outcome === 'block' ? 0.6 : 2.2);
    if (defender)
      this.bladeFlash.set(defender.sword.bladeMaterial, event.outcome === 'block' ? 0.6 : 2.2);

    // Estrella de impacto: un solo frame "dibujado" del choque, como en la animacion de lucha.
    const perfect = event.outcome === 'deflect_perfect';
    if (event.outcome !== 'block') {
      const size = perfect ? 0.95 : 0.7;
      this.showMark(
        this.stars,
        this.contact,
        size,
        size,
        perfect ? 0.09 : 0.07,
        Math.random() * Math.PI,
        STAR_COLOR,
      );
    }

    this.cameraRig.kick(event.direction, feel.shake * 0.12);
    this.cameraRig.shake(feel.shake * 0.6, event.direction);
    if (feel.fovPunch !== 0) this.cameraRig.punchFov(feel.fovPunch);
  }

  private spawnHit(event: CombatHitPayload): void {
    const defender = this.rigs.get(event.defenderId);
    if (defender) {
      defender.joints.chest.getWorldPosition(this.contact);
      this.contact.y += 0.05;
      this.bodyFlash.set(defender, 1);
    } else {
      this.contact.set(event.contact.x, event.contact.y, event.contact.z);
    }
    if (feedbackConfig.hitStyle !== 'none') {
      this.splatter.setColor(feedbackConfig.hitStyle === 'blood' ? 0x5a0a0a : 0x120a0c);
      this.splatter.burst(this.contact, event.direction, feedbackConfig.hitParticles);
    }
    this.flash(this.contact, 0.3, 0.05);
    const angle = SLASH_ANGLE[event.strike] + (Math.random() - 0.5) * 0.3;
    this.showMark(this.slashes, this.contact, 1.25, 0.16, 0.11, angle, CUT_COLOR);
    this.cameraRig.kick(event.direction, 0.045);
    this.cameraRig.shake(feedbackConfig.hitShake, event.direction);
  }

  private spawnPostureBreak(entityId: string): void {
    const rig = this.rigs.get(entityId);
    if (!rig) return;
    rig.joints.chest.getWorldPosition(this.contact);
    const ring = this.rings.find((r) => r.age >= r.duration);
    if (ring) {
      ring.age = 0;
      ring.duration = 0.42;
      ring.mesh.position.copy(this.contact);
      ring.mesh.visible = true;
    }
    this.normal.set(0, 1, 0);
    this.sparks.burst(this.contact, this.normal, 50, [2, 6], [0.2, 0.6], [2.6, 0.7, 0.25]);
    this.flash(this.contact, 0.7, 0.12);
    this.lightEnergy = Math.max(this.lightEnergy, 8);
    this.light.position.copy(this.contact);
    this.cameraRig.shake(feedbackConfig.postureBreakShake);
    this.cameraRig.punchFov(-4);
    timeDirector.slowMotion(0.4, 0.22);
  }

  /**
   * Remate, primer tiempo: la estocada. Camara lenta, acercamiento y un impacto contenido.
   * El estallido grande se guarda para el segundo tiempo (el tiron de la hoja).
   */
  private spawnDeathblow(
    victimId: string,
    direction: { x: number; z: number },
    attackerId: string,
    tick: number,
  ): void {
    const rig = this.rigs.get(victimId);
    if (!rig) return;
    rig.joints.chest.getWorldPosition(this.contact);
    if (feedbackConfig.hitStyle !== 'none') {
      this.splatter.setColor(feedbackConfig.hitStyle === 'blood' ? 0x5a0a0a : 0x120a0c);
      this.splatter.burst(this.contact, direction, feedbackConfig.hitParticles);
    }
    this.bodyFlash.set(rig, 1.2);
    this.flash(this.contact, 0.45, 0.08);
    this.cameraRig.kick(direction, 0.08);
    this.cameraRig.shake(feedbackConfig.deathblowShake * 0.6, direction);
    this.cameraRig.punchFov(-7);
    this.cameraRig.focus(0.62, 1.5);
    timeDirector.slowMotion(0.22, 0.32);

    // El tiron ocurre cuando ambos salen del hitstop y la animacion llega a su clave.
    const delay =
      combatConfig.hitstopDeathblow +
      (DEATHBLOW_PULL_TICK - PLAYER_ATTACKS.deathblow.startupTicks) -
      1;
    this.pendingPulls.push({ atTick: tick + delay, victimId, attackerId });
  }

  /** Remate, segundo tiempo: se arranca la hoja. Aqui va el estallido. */
  private spawnDeathblowPull(victimId: string, attackerId: string): void {
    const rig = this.rigs.get(victimId);
    const attacker = this.rigs.get(attackerId);
    if (!rig) return;
    rig.joints.chest.getWorldPosition(this.contact);
    // La salpicadura sale en la direccion del tiron (hacia la derecha del atacante).
    const dir = { x: 1, z: 0 };
    if (attacker) {
      attacker.root.getWorldDirection(this.tmp);
      dir.x = -this.tmp.z;
      dir.z = this.tmp.x;
    }
    if (feedbackConfig.hitStyle !== 'none') {
      this.splatter.setColor(feedbackConfig.hitStyle === 'blood' ? 0x5a0a0a : 0x120a0c);
      this.splatter.burst(this.contact, dir, feedbackConfig.hitParticles * 4);
    }
    this.showMark(this.slashes, this.contact, 1.8, 0.22, 0.14, 0.15, CUT_COLOR);
    this.bodyFlash.set(rig, 1.6);
    this.cameraRig.kick(dir, 0.1);
    this.cameraRig.shake(feedbackConfig.deathblowShake, dir);
    timeDirector.slowMotion(0.45, 0.16);
    this.sfx?.deathblowPull();
  }

  /** Aviso de lectura: la hoja enemiga brilla y una estrella aparece en la punta. */
  private spawnGlint(attackerId: string): void {
    const rig = this.rigs.get(attackerId);
    if (!rig) return;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getStarTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        color: new THREE.Color(2.5, 2.3, 2),
      }),
    );
    sprite.renderOrder = 12;
    this.scene.add(sprite);
    this.glints.push({ rig, sprite, age: 0, duration: feedbackConfig.telegraphGlint });
    this.bladeFlash.set(rig.sword.bladeMaterial, 1.6);
  }

  // ------------------------------------------------------------------ contacto
  /**
   * Punto de choque real: lo mas cerca que estan las dos hojas. Si no se tocan (el golpe
   * dio en el cuerpo o las poses no coinciden) se usa el punto estimado por la simulacion.
   * La normal de las chispas es perpendicular a ambas hojas, girada hacia la camara.
   */
  private resolveContact(
    event: CombatHitPayload,
    attacker: HumanoidRig | undefined,
    defender: HumanoidRig | undefined,
  ): void {
    this.contact.set(event.contact.x, event.contact.y, event.contact.z);
    this.normal.set(-event.direction.x, 0.4, -event.direction.z).normalize();
    if (!attacker || !defender) return;

    bladeSegment(attacker, this.a0, this.a1);
    bladeSegment(defender, this.b0, this.b1);
    const distance = closestPointsBetweenSegments(
      this.a0,
      this.a1,
      this.b0,
      this.b1,
      this.tmp,
      this.contact,
    );
    // Si las hojas se cruzan, el choque esta entre ambas; si no, en la hoja del defensor
    // (que ya es `contact`): es la que el jugador mira al desviar.
    if (distance <= 0.45) this.contact.lerp(this.tmp, 0.5);

    const da = this.a1.sub(this.a0).normalize();
    const db = this.b1.sub(this.b0).normalize();
    this.normal.crossVectors(da, db);
    if (this.normal.lengthSq() < 1e-4) this.normal.set(0, 1, 0);
    this.normal.normalize();
    this.tmp.subVectors(this.camera.position, this.contact);
    if (this.normal.dot(this.tmp) < 0) this.normal.negate();
  }

  // ------------------------------------------------------------------ pools
  private flash(position: THREE.Vector3, size: number, duration: number): void {
    const flash = this.flashes.find((f) => f.age >= f.duration) ?? this.flashes[0];
    if (!flash) return;
    flash.age = 0;
    flash.duration = duration;
    flash.size = size;
    flash.sprite.position.copy(position);
    flash.sprite.visible = true;
  }

  private updateFlashes(dt: number): void {
    for (const flash of this.flashes) {
      if (flash.age >= flash.duration) {
        flash.sprite.visible = false;
        continue;
      }
      flash.age += dt;
      const t = Math.min(flash.age / flash.duration, 1);
      // Aparece de golpe y se encoge: el ojo lo lee como impacto, no como explosion.
      const scale = flash.size * (0.55 + 0.75 * Math.sqrt(t));
      flash.sprite.scale.setScalar(scale);
      const material = flash.sprite.material;
      material.opacity = 1 - t;
      material.color.setScalar(1.5 * (1 - t) + 0.3);
    }
  }

  private updateRings(dt: number): void {
    for (const ring of this.rings) {
      if (ring.age >= ring.duration) {
        ring.mesh.visible = false;
        continue;
      }
      ring.age += dt;
      const t = Math.min(ring.age / ring.duration, 1);
      ring.mesh.scale.setScalar(0.25 + t * 1.6);
      ring.mesh.quaternion.copy(this.camera.quaternion);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (1 - t);
    }
  }

  private updateGlints(dt: number): void {
    for (let i = this.glints.length - 1; i >= 0; i -= 1) {
      const glint = this.glints[i];
      if (!glint) continue;
      glint.age += dt;
      const t = glint.age / glint.duration;
      if (t >= 1) {
        this.scene.remove(glint.sprite);
        glint.sprite.material.dispose();
        this.glints.splice(i, 1);
        continue;
      }
      glint.rig.joints.weapon_r.localToWorld(this.tmp.copy(glint.rig.sword.bladeTip));
      glint.sprite.position.copy(this.tmp);
      const pop = Math.sin(Math.min(t * 1.4, 1) * Math.PI);
      glint.sprite.scale.setScalar(0.08 + pop * 0.42);
      glint.sprite.material.rotation = t * 1.2;
      glint.sprite.material.opacity = pop;
    }
  }

  private updateMaterialFlashes(dt: number): void {
    for (const [material, energy] of this.bladeFlash) {
      const next = energy * Math.exp(-dt * 9);
      material.emissiveIntensity = next;
      if (next < 0.01) {
        material.emissiveIntensity = 0;
        this.bladeFlash.delete(material);
      } else {
        this.bladeFlash.set(material, next);
      }
    }
    for (const [rig, energy] of this.bodyFlash) {
      const next = energy * Math.exp(-dt * 22);
      for (const material of rig.flashMaterials) {
        if (material === rig.sword.bladeMaterial) continue;
        // Destello breve y contenido: marca el golpe sin teñir al personaje entero.
        material.emissive.setRGB(1, 0.85, 0.75);
        material.emissiveIntensity = Math.min(next, 1) * 0.22;
      }
      if (next < 0.01) {
        for (const material of rig.flashMaterials) {
          if (material !== rig.sword.bladeMaterial) material.emissiveIntensity = 0;
        }
        this.bodyFlash.delete(rig);
      } else {
        this.bodyFlash.set(rig, next);
      }
    }
  }

  private feelFor(outcome: CombatHitPayload['outcome']): ImpactFeel | null {
    switch (outcome) {
      case 'deflect_perfect':
        return feedbackConfig.deflectPerfect;
      case 'deflect':
        return feedbackConfig.deflect;
      case 'block':
        return feedbackConfig.block;
      case 'guard_break':
        return feedbackConfig.guardBreak;
      default:
        return null;
    }
  }
}

const STAR_COLOR = new THREE.Color(2.4, 2.1, 1.6);
const CUT_COLOR = new THREE.Color(2.2, 1.4, 1.2);
/** Angulo en pantalla de la marca de corte segun por donde llega el golpe. */
const SLASH_ANGLE: Record<CombatHitPayload['strike'], number> = {
  from_right: 0.25,
  from_left: -0.7,
  overhead: 1.35,
  thrust: 0,
  low: -0.1,
};

/** Segmento de la hoja (base -> punta) en el mundo. */
function bladeSegment(rig: HumanoidRig, base: THREE.Vector3, tip: THREE.Vector3): void {
  base.copy(rig.sword.bladeBase);
  tip.copy(rig.sword.bladeTip);
  rig.joints.weapon_r.localToWorld(base);
  rig.joints.weapon_r.localToWorld(tip);
}

/**
 * Puntos mas cercanos entre los segmentos p1-q1 y p2-q2. Escribe c1 (en el primero) y
 * c2 (en el segundo) y devuelve la distancia. (Ericson, Real-Time Collision Detection 5.1.9)
 */
export function closestPointsBetweenSegments(
  p1: THREE.Vector3,
  q1: THREE.Vector3,
  p2: THREE.Vector3,
  q2: THREE.Vector3,
  c1: THREE.Vector3,
  c2: THREE.Vector3,
): number {
  const d1x = q1.x - p1.x,
    d1y = q1.y - p1.y,
    d1z = q1.z - p1.z;
  const d2x = q2.x - p2.x,
    d2y = q2.y - p2.y,
    d2z = q2.z - p2.z;
  const rx = p1.x - p2.x,
    ry = p1.y - p2.y,
    rz = p1.z - p2.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s = 0;
  let t = 0;
  if (a <= 1e-8 && e <= 1e-8) {
    s = 0;
    t = 0;
  } else if (a <= 1e-8) {
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-8) {
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom > 1e-8 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  c1.set(p1.x + d1x * s, p1.y + d1y * s, p1.z + d1z * s);
  c2.set(p2.x + d2x * t, p2.y + d2y * t, p2.z + d2z * t);
  return c1.distanceTo(c2);
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}
