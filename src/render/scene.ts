import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { renderConfig } from '@/config/render';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';

/**
 * Vista de render: renderer, escena, camara y post-proceso. No contiene reglas de juego.
 * Se registra como sistema de render y dibuja al final de cada frame.
 */
export class SceneView implements RenderUpdateSystem {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly onResize: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(renderConfig.clearColor);
    this.renderer.shadowMap.enabled = renderConfig.shadows;
    // PCFSoftShadowMap fue eliminado en three >= 0.186.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = renderConfig.exposure;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(renderConfig.clearColor);
    this.scene.fog = new THREE.Fog(
      renderConfig.fogColor,
      renderConfig.fogNear,
      renderConfig.fogFar,
    );

    // Entorno neutro para los reflejos: sin el, el metal se ve negro.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = renderConfig.environmentIntensity;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      renderConfig.fov,
      1,
      renderConfig.near,
      renderConfig.far,
    );
    this.camera.position.set(6, 5, 9);
    this.camera.lookAt(0, 1, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(256, 256),
      renderConfig.bloomStrength,
      renderConfig.bloomRadius,
      renderConfig.bloomThreshold,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.onResize = () => {
      this.resize();
    };
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, renderConfig.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  renderUpdate(_ctx: FrameContext): void {
    this.renderer.toneMappingExposure = renderConfig.exposure;
    this.scene.environmentIntensity = renderConfig.environmentIntensity;
    if (renderConfig.bloom) {
      this.bloomPass.strength = renderConfig.bloomStrength;
      this.bloomPass.radius = renderConfig.bloomRadius;
      this.bloomPass.threshold = renderConfig.bloomThreshold;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.composer.dispose();
    this.renderer.dispose();
  }
}

/** Iluminacion: luz principal calida + contraluz frio que recorta las siluetas. */
export function addGreyboxLighting(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0x8696b0, 0x1d1a18, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe2c4, 2.4);
  sun.position.set(12, 20, 8);
  sun.castShadow = renderConfig.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Contraluz: separa a los personajes del fondo oscuro, clave para leer las poses.
  const rim = new THREE.DirectionalLight(0x9fb8ff, 1.3);
  rim.position.set(-10, 8, -14);
  scene.add(rim);
}
