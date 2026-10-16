import * as THREE from 'three';

/**
 * Paletas de personaje. Low-poly facetado (flatShading): perdona mucho y tiene caracter.
 * Cuando llegue la direccion de arte del usuario, se cambia aqui, no en las mallas.
 */
export interface CharacterPalette {
  top: number;
  bottom: number;
  skin: number;
  hair: number;
  accent: number;
  wrap: number;
  feet: number;
  blade: number;
  guard: number;
  handle: number;
  mask?: number;
}

export const RONIN_PALETTE: CharacterPalette = {
  top: 0x2a3346,
  bottom: 0x23252b,
  skin: 0xc49a7c,
  hair: 0x141416,
  accent: 0xa8432b,
  wrap: 0xd6cdbb,
  feet: 0x3b3a38,
  blade: 0xd3dae2,
  guard: 0x4b3c29,
  handle: 0x18181b,
};

export const DUELIST_PALETTE: CharacterPalette = {
  top: 0x4e1d1c,
  bottom: 0x2a2421,
  skin: 0xb48d72,
  hair: 0x1a1512,
  accent: 0x8a6a3a,
  wrap: 0x3c3430,
  feet: 0x221d1a,
  blade: 0xc9cfd6,
  guard: 0x2b2b2e,
  handle: 0x3a1f1b,
  mask: 0xe6dfd0,
};

export function cloth(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, flatShading: true });
}

export function skin(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
}

export function steel(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.22,
    metalness: 0.92,
    emissive: 0xffd7a0,
    emissiveIntensity: 0,
    flatShading: true,
  });
}
