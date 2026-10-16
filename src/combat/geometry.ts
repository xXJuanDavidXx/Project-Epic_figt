import type { Vec3 } from '@/combat/types';

/** Geometria de hitboxes. Pura: la usa la simulacion para decidir golpes, sin Rapier. */

export interface Capsule {
  a: Vec3;
  b: Vec3;
  radius: number;
}

export interface Sphere {
  center: Vec3;
  radius: number;
}

/** Punto de un espacio local (adelante = -Z) al mundo, girado por `yaw` sobre Y. */
export function localToWorld(local: Vec3, origin: Vec3, yaw: number): Vec3 {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: origin.x + local.x * cos + local.z * sin,
    y: origin.y + local.y,
    z: origin.z - local.x * sin + local.z * cos,
  };
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function closestPointOnSegment(point: Vec3, a: Vec3, b: Vec3): Vec3 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  if (lengthSq < 1e-12) return { ...a };
  let t = ((point.x - a.x) * abx + (point.y - a.y) * aby + (point.z - a.z) * abz) / lengthSq;
  t = Math.min(Math.max(t, 0), 1);
  return { x: a.x + abx * t, y: a.y + aby * t, z: a.z + abz * t };
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function sphereIntersectsCapsule(sphere: Sphere, capsule: Capsule): boolean {
  const closest = closestPointOnSegment(sphere.center, capsule.a, capsule.b);
  return distance(closest, sphere.center) <= sphere.radius + capsule.radius;
}

/** Capsula vertical de un personaje cuyo centro esta en `center`. */
export function verticalCapsule(center: Vec3, halfHeight: number, radius: number): Capsule {
  return {
    a: { x: center.x, y: center.y - halfHeight, z: center.z },
    b: { x: center.x, y: center.y + halfHeight, z: center.z },
    radius,
  };
}
