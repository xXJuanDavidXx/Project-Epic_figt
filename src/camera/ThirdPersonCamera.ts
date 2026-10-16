import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { cameraConfig } from '@/config/camera';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';
import type { CameraRig } from '@/camera/CameraRig';
import type { PhysicsWorld } from '@/physics/world';
import { RAPIER as Rapier } from '@/physics/world';

/**
 * Camara en tercera persona con colision: lanza una esfera del pivote hacia la posicion
 * deseada y se queda delante del primer obstaculo, de modo que nunca atraviesa un muro
 * (CLAUDE.md seccion 6). Se ejecuta en el render, despues de interpolar al jugador.
 */
export class ThirdPersonCamera implements RenderUpdateSystem {
  private readonly pivot = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly castShape: RAPIER.Ball;
  private currentDistance = cameraConfig.distance;
  private smoothedPivotY: number | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly rig: CameraRig,
    private readonly target: THREE.Object3D,
    private readonly physics: PhysicsWorld,
    private readonly ignoreCollider: RAPIER.Collider | null = null,
  ) {
    this.castShape = new Rapier.Ball(cameraConfig.collisionRadius);
  }

  renderUpdate(ctx: FrameContext): void {
    const yaw = lerpAngle(this.rig.prevYaw, this.rig.yaw, ctx.alpha);
    const pitch = this.rig.prevPitch + (this.rig.pitch - this.rig.prevPitch) * ctx.alpha;

    // El pivote sigue al jugador ya interpolado. La altura se suaviza aparte: al subir
    // escalones el jugador salta de golpe en Y y sin esto la camara da tirones.
    const targetPivotY = this.target.position.y + cameraConfig.pivotHeight;
    if (this.smoothedPivotY === null || Math.abs(targetPivotY - this.smoothedPivotY) > 2.5) {
      this.smoothedPivotY = targetPivotY;
    } else {
      const follow = 1 - Math.exp(-cameraConfig.followSmoothing * ctx.frameDelta);
      this.smoothedPivotY += (targetPivotY - this.smoothedPivotY) * follow;
    }
    this.pivot.set(this.target.position.x, this.smoothedPivotY, this.target.position.z);

    // Direccion desde el pivote hacia atras de la camara.
    const cosPitch = Math.cos(pitch);
    this.offset.set(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);

    const maxDistance = cameraConfig.distance;
    let distance = maxDistance;

    const hit = this.physics.world.castShape(
      this.pivot,
      IDENTITY_ROTATION,
      this.offset,
      this.castShape,
      0,
      maxDistance,
      true,
      undefined,
      undefined,
      this.ignoreCollider ?? undefined,
    );
    if (hit) {
      // Nunca pasar del punto de impacto: si el obstaculo esta mas cerca que la distancia
      // minima, la camara se pega al jugador antes que atravesar la pared.
      distance = Math.max(Math.min(distance, hit.time_of_impact), cameraConfig.minDistance);
    }

    // Acercarse al chocar es inmediato; alejarse al despejar es suave (evita tirones).
    if (distance < this.currentDistance) {
      this.currentDistance = distance;
    } else {
      const smoothing = 1 - Math.exp(-cameraConfig.distanceSmoothing * ctx.frameDelta);
      this.currentDistance += (distance - this.currentDistance) * smoothing;
    }

    this.desired.copy(this.offset).multiplyScalar(this.currentDistance).add(this.pivot);

    // Desplazamiento de hombro, perpendicular a la vista.
    const shoulder = cameraConfig.shoulderOffset * (this.currentDistance / maxDistance);
    this.desired.x += Math.cos(yaw) * shoulder;
    this.desired.z += -Math.sin(yaw) * shoulder;

    this.camera.position.copy(this.desired);
    this.camera.lookAt(
      this.pivot.x + Math.cos(yaw) * shoulder,
      this.pivot.y,
      this.pivot.z - Math.sin(yaw) * shoulder,
    );
  }
}

const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

function lerpAngle(from: number, to: number, alpha: number): number {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta <= -Math.PI) delta += twoPi;
  return from + delta * alpha;
}
