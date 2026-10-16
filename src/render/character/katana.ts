import * as THREE from 'three';
import type { SwordGeometry } from '@/animation/rig';
import { cloth, steel } from '@/render/character/materials';
import type { CharacterPalette } from '@/render/character/materials';

/**
 * Katana procedural en el espacio de `weapon_r`: la hoja apunta a -Z, el lomo a +Y,
 * el filo a -Y. Perfil extruido con curvatura (sori) y punta (kissaki) reales.
 */
export interface SwordMesh {
  group: THREE.Group;
  bladeMaterial: THREE.MeshStandardMaterial;
  /** Extremos de la hoja en espacio `weapon_r` (para chispas y trails). */
  bladeBase: THREE.Vector3;
  bladeTip: THREE.Vector3;
}

export function buildSword(
  geometry: SwordGeometry,
  palette: CharacterPalette,
  style: 'katana' | 'long',
): SwordMesh {
  const group = new THREE.Group();
  const bladeMaterial = steel(palette.blade);

  const length = geometry.bladeLength;
  const height = style === 'long' ? 0.036 : 0.03;
  const sori = style === 'long' ? 0.035 : 0.022;
  const kissaki = length * 0.09;

  // Perfil en el plano XY: x = a lo largo de la hoja, y = alto (lomo arriba).
  const shape = new THREE.Shape();
  const curve = (u: number): number => sori * (u / length) * (u / length);
  const steps = 10;
  shape.moveTo(0, -height / 2);
  for (let i = 1; i <= steps; i += 1) {
    const u = ((length - kissaki) * i) / steps;
    shape.lineTo(u, -height / 2 + curve(u));
  }
  // Punta: el filo sube en curva hasta encontrarse con el lomo.
  shape.quadraticCurveTo(
    length - kissaki * 0.2,
    -height / 2 + curve(length),
    length,
    curve(length) + height * 0.35,
  );
  for (let i = steps; i >= 0; i -= 1) {
    const u = ((length - kissaki * 0.6) * i) / steps;
    shape.lineTo(u, height / 2 + curve(u));
  }
  shape.closePath();

  const thickness = 0.007;
  const bladeGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
  });
  bladeGeometry.translate(0, 0, -thickness / 2);
  // x (a lo largo) -> -Z ; profundidad -> X.
  bladeGeometry.rotateY(Math.PI / 2);
  const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade.position.z = -geometry.guard - 0.004;
  blade.castShadow = true;
  group.add(blade);

  // Habaki (collar de la hoja).
  const habaki = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, height * 1.25, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.8, roughness: 0.35 }),
  );
  habaki.position.z = -geometry.guard - 0.018;
  group.add(habaki);

  // Tsuba (guarda).
  const tsubaGeometry =
    style === 'long'
      ? new THREE.BoxGeometry(0.075, 0.075, 0.008)
      : new THREE.CylinderGeometry(0.042, 0.042, 0.008, 10);
  if (style !== 'long') tsubaGeometry.rotateX(Math.PI / 2);
  const tsuba = new THREE.Mesh(
    tsubaGeometry,
    new THREE.MeshStandardMaterial({
      color: palette.guard,
      metalness: 0.6,
      roughness: 0.45,
      flatShading: true,
    }),
  );
  tsuba.position.z = -geometry.guard;
  tsuba.castShadow = true;
  group.add(tsuba);

  // Tsuka (mango) con envoltura: segmentos alternos para leer el trenzado.
  const handleLength = geometry.handleBack + geometry.guard - 0.008;
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.024, 0.032, handleLength),
    cloth(palette.handle),
  );
  handle.position.z = (geometry.handleBack - geometry.guard) / 2 + 0.004;
  handle.castShadow = true;
  group.add(handle);
  const wrapMaterial = cloth(palette.wrap);
  const wraps = Math.max(3, Math.round(handleLength / 0.04));
  for (let i = 0; i < wraps; i += 1) {
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.035, 0.008), wrapMaterial);
    wrap.position.z = -geometry.guard + 0.02 + (i * (handleLength - 0.03)) / wraps;
    wrap.rotation.z = i % 2 === 0 ? 0.5 : -0.5;
    group.add(wrap);
  }
  const kashira = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.036, 0.014),
    new THREE.MeshStandardMaterial({ color: palette.guard, metalness: 0.6, roughness: 0.45 }),
  );
  kashira.position.z = geometry.handleBack;
  group.add(kashira);

  return {
    group,
    bladeMaterial,
    bladeBase: new THREE.Vector3(0, 0, -geometry.guard - 0.03),
    bladeTip: new THREE.Vector3(0, curve(length), -geometry.guard - length),
  };
}
