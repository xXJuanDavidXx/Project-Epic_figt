import * as THREE from 'three';
import type { JointName } from '@/animation/types';
import type { RigProportions, SwordGeometry } from '@/animation/rig';
import { DEFAULT_PROPORTIONS, KATANA, LONG_BLADE, buildJointDefs } from '@/animation/rig';
import { DUELIST_PALETTE, RONIN_PALETTE, cloth, skin } from '@/render/character/materials';
import type { SwordMesh } from '@/render/character/katana';
import { buildSword } from '@/render/character/katana';

/**
 * Humanoide procedural low-poly: jerarquia de articulaciones (rig.ts) + mallas pegadas a
 * cada articulacion. Sustituible en M5 por un .glb con los mismos nombres de hueso.
 */
export interface HumanoidRig {
  /** Nodo raiz en los pies. Hijo del objeto que mueve la simulacion. */
  root: THREE.Object3D;
  joints: Record<JointName | 'weapon_r', THREE.Object3D>;
  proportions: RigProportions;
  swordGeometry: SwordGeometry;
  sword: SwordMesh;
  /** Segmentos de la bufanda/faldon (animacion secundaria). */
  trail: THREE.Object3D[];
  /** Materiales que parpadean al recibir un golpe. */
  flashMaterials: THREE.MeshStandardMaterial[];
}

export type CharacterStyle = 'ronin' | 'duelist';

export function buildHumanoid(style: CharacterStyle): HumanoidRig {
  const proportions: RigProportions =
    style === 'duelist'
      ? { ...DEFAULT_PROPORTIONS, hipHeight: 1.0, shoulderWidth: 0.21, upperArm: 0.3 }
      : DEFAULT_PROPORTIONS;
  const palette = style === 'duelist' ? DUELIST_PALETTE : RONIN_PALETTE;
  const swordGeometry = style === 'duelist' ? LONG_BLADE : KATANA;

  const nodes = new Map<string, THREE.Object3D>();
  for (const def of buildJointDefs(proportions)) {
    const node = new THREE.Object3D();
    node.name = def.name;
    node.position.set(def.offset[0], def.offset[1], def.offset[2]);
    nodes.set(def.name, node);
    if (def.parent) {
      const parent = nodes.get(def.parent);
      if (!parent) throw new Error(`Padre desconocido en el rig: ${def.parent}`);
      parent.add(node);
    }
  }
  const get = (name: string): THREE.Object3D => {
    const node = nodes.get(name);
    if (!node) throw new Error(`Articulacion desconocida: ${name}`);
    return node;
  };

  const flashMaterials: THREE.MeshStandardMaterial[] = [];
  const mat = {
    top: track(cloth(palette.top)),
    bottom: track(cloth(palette.bottom)),
    skin: track(skin(palette.skin)),
    hair: cloth(palette.hair),
    accent: track(cloth(palette.accent)),
    wrap: cloth(palette.wrap),
    feet: cloth(palette.feet),
  };
  function track(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    flashMaterials.push(material);
    return material;
  }

  const p = proportions;
  const bulk = style === 'duelist' ? 1.12 : 1;

  // --- Torso ---
  attach(get('hips'), taper(0.15 * bulk, 0.17 * bulk, 0.2, mat.bottom, 0.75), [0, 0.02, 0]);
  attach(get('hips'), taper(0.165 * bulk, 0.165 * bulk, 0.07, mat.wrap, 0.75), [0, 0.11, 0]);
  attach(get('spine'), taper(0.15 * bulk, 0.155 * bulk, 0.2, mat.top, 0.72), [0, 0.1, 0]);
  attach(get('chest'), taper(0.2 * bulk, 0.155 * bulk, 0.28, mat.top, 0.7), [0, 0.13, 0]);
  // Cruce del kimono: solapa clara en diagonal.
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), mat.wrap);
  lapel.rotation.z = 0.55;
  attach(get('chest'), lapel, [0.01, 0.12, -0.105 * bulk]);

  // --- Cabeza ---
  attach(get('neck'), taper(0.05, 0.055, 0.1, mat.skin), [0, 0.03, 0]);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 1), mat.skin);
  head.scale.set(0.92, 1.08, 1);
  head.castShadow = true;
  attach(get('head'), head, [0, 0.11, 0]);

  if (style === 'ronin') {
    const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), mat.hair);
    hair.scale.set(0.98, 0.75, 1.05);
    attach(get('head'), hair, [0, 0.17, 0.02]);
    const topknot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.09, 6), mat.hair);
    topknot.rotation.x = 1.1;
    attach(get('head'), topknot, [0, 0.25, 0.07]);
    // Cinta en la frente: el unico toque de color en la cabeza.
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.012, 4, 14), mat.accent);
    band.rotation.x = Math.PI / 2;
    band.scale.set(0.95, 1.05, 1);
    attach(get('head'), band, [0, 0.16, 0.005]);
  } else {
    const hood = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), mat.top);
    hood.scale.set(1, 1.05, 1.08);
    attach(get('head'), hood, [0, 0.13, 0.035]);
    // Mascara de ceramica con una unica rendija horizontal.
    const mask = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.118,
        10,
        8,
        Math.PI * 0.62,
        Math.PI * 0.76,
        Math.PI * 0.22,
        Math.PI * 0.55,
      ),
      new THREE.MeshStandardMaterial({
        color: palette.mask ?? 0xffffff,
        roughness: 0.35,
        metalness: 0.05,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    );
    mask.scale.set(0.95, 1.1, 1.05);
    attach(get('head'), mask, [0, 0.11, -0.012]);
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.012, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a }),
    );
    attach(get('head'), slit, [0, 0.135, -0.118]);
  }

  // --- Brazos ---
  for (const side of ['l', 'r'] as const) {
    const sleeveColor = mat.top;
    attach(get(`upperarm_${side}`), limb(0.075 * bulk, 0.062 * bulk, p.upperArm, sleeveColor), [
      0,
      -p.upperArm / 2,
      0,
    ]);
    attach(get(`forearm_${side}`), limb(0.05, 0.042, p.forearm, mat.wrap), [0, -p.forearm / 2, 0]);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.05), mat.skin);
    hand.castShadow = true;
    attach(get(`hand_${side}`), hand, [0, -0.04, 0]);
  }
  if (style === 'duelist') {
    // Hombreras lacadas: silueta mas ancha y amenazante que la del jugador.
    for (const side of [-1, 1] as const) {
      const pauldron = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 0.12, 6, 1, true, 0, Math.PI),
        new THREE.MeshStandardMaterial({
          color: 0x1d1b1c,
          roughness: 0.4,
          metalness: 0.3,
          flatShading: true,
          side: THREE.DoubleSide,
        }),
      );
      pauldron.rotation.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, side * 0.35);
      attach(get(side > 0 ? 'upperarm_r' : 'upperarm_l'), pauldron, [side * 0.02, -0.02, 0]);
    }
  }

  // --- Piernas (hakama amplio) ---
  for (const side of ['l', 'r'] as const) {
    attach(get(`thigh_${side}`), limb(0.11 * bulk, 0.125 * bulk, p.thigh, mat.bottom), [
      0,
      -p.thigh / 2,
      0,
    ]);
    attach(get(`shin_${side}`), limb(0.125 * bulk, 0.15 * bulk, p.shin * 0.82, mat.bottom), [
      0,
      -p.shin * 0.38,
      0,
    ]);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.24), mat.feet);
    foot.castShadow = true;
    attach(get(`foot_${side}`), foot, [0, 0.0, -0.05]);
  }

  // --- Espada en la mano derecha y vaina en la cadera izquierda ---
  const sword = buildSword(swordGeometry, palette, style === 'duelist' ? 'long' : 'katana');
  get('weapon_r').add(sword.group);
  const saya = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.038, swordGeometry.bladeLength + 0.05),
    cloth(style === 'duelist' ? 0x141212 : 0x111114),
  );
  // La boca de la vaina en la cadera izquierda; la punta hacia atras y abajo.
  saya.rotation.set(0.95, 0.2, 0);
  attach(get('hips'), saya, [-0.2 * bulk, -0.12, 0.24]);

  // --- Animacion secundaria: bufanda (ronin) o faldon del abrigo (duelist) ---
  const trail: THREE.Object3D[] = [];
  const trailParent = style === 'ronin' ? get('neck') : get('hips');
  let parent: THREE.Object3D = trailParent;
  const segments = style === 'ronin' ? 5 : 4;
  for (let i = 0; i < segments; i += 1) {
    const joint = new THREE.Object3D();
    if (i === 0) {
      joint.position.set(
        style === 'ronin' ? 0.05 : 0,
        style === 'ronin' ? 0 : -0.02,
        style === 'ronin' ? 0.1 : 0.16 * bulk,
      );
    } else {
      joint.position.set(0, -0.13, 0);
    }
    const width = style === 'ronin' ? 0.09 - i * 0.008 : 0.3 - i * 0.03;
    const piece = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.14, 0.012),
      style === 'ronin' ? mat.accent : mat.top,
    );
    piece.position.y = -0.065;
    piece.castShadow = true;
    joint.add(piece);
    parent.add(joint);
    trail.push(joint);
    parent = joint;
  }

  const root = get('root');
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  const jointNames: (JointName | 'weapon_r')[] = [
    'hips',
    'spine',
    'chest',
    'neck',
    'head',
    'upperarm_l',
    'forearm_l',
    'hand_l',
    'upperarm_r',
    'forearm_r',
    'hand_r',
    'weapon_r',
    'thigh_l',
    'shin_l',
    'foot_l',
    'thigh_r',
    'shin_r',
    'foot_r',
  ];
  const joints = Object.fromEntries(
    jointNames.map((name) => [name, get(name)]),
  ) as HumanoidRig['joints'];

  return {
    root,
    joints,
    proportions,
    swordGeometry,
    sword,
    trail,
    flashMaterials: [...flashMaterials, sword.bladeMaterial],
  };
}

function attach(
  parent: THREE.Object3D,
  mesh: THREE.Object3D,
  position: [number, number, number],
): void {
  mesh.position.set(position[0], position[1], position[2]);
  parent.add(mesh);
}

/** Tronco de cono facetado, aplanado en Z si se pide. */
function taper(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  material: THREE.Material,
  depthScale = 1,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8),
    material,
  );
  mesh.scale.z = depthScale;
  return mesh;
}

/** Segmento de extremidad: cilindro de 7 lados, base arriba (pegado a la articulacion). */
function limb(
  radiusTop: number,
  radiusBottom: number,
  length: number,
  material: THREE.Material,
): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 7), material);
}
