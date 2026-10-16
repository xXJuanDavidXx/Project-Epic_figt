import * as THREE from 'three';
import { renderConfig } from '@/config/render';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';

/**
 * Vista de render: renderer, escena y camara. No contiene reglas de juego.
 * Se registra como sistema de render y dibuja al final de cada frame.
 */
export class SceneView implements RenderUpdateSystem {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly resizeObserver: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(renderConfig.clearColor);
    this.renderer.shadowMap.enabled = renderConfig.shadows;
    // PCFSoftShadowMap fue eliminado en three >= 0.186.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      renderConfig.fogColor,
      renderConfig.fogNear,
      renderConfig.fogFar,
    );

    this.camera = new THREE.PerspectiveCamera(
      renderConfig.fov,
      1,
      renderConfig.near,
      renderConfig.far,
    );
    this.camera.position.set(6, 5, 9);
    this.camera.lookAt(0, 1, 0);

    this.resizeObserver = () => {
      this.resize();
    };
    window.addEventListener('resize', this.resizeObserver);
    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, renderConfig.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  renderUpdate(_ctx: FrameContext): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeObserver);
    this.renderer.dispose();
  }
}

/** Iluminacion greybox: hemisferica suave + direccional con sombras. */
export function addGreyboxLighting(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0x8fa6c4, 0x1a1f26, 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0dd, 2.2);
  sun.position.set(12, 20, 8);
  sun.castShadow = renderConfig.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
}

/** Suelo greybox con rejilla, para leer la escala y el movimiento. */
export function addGreyboxGround(scene: THREE.Scene, size: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size, 0.5, size);
  const material = new THREE.MeshStandardMaterial({ color: 0x2b313b, roughness: 0.95 });
  const ground = new THREE.Mesh(geometry, material);
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(size, size, 0x3f4855, 0x323944);
  grid.position.y = 0.002;
  scene.add(grid);

  return ground;
}
