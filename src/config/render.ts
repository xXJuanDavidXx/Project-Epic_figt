export interface RenderConfig {
  fov: number;
  near: number;
  far: number;
  /** Tope de device pixel ratio: evita matar GPUs integradas en pantallas HiDPI. */
  maxPixelRatio: number;
  shadows: boolean;
  clearColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  /** Exposicion del tone mapping ACES. */
  exposure: number;
  /** Bloom: hace brillar chispas, destellos y el filo. Desactivable en GPUs debiles. */
  bloom: boolean;
  bloomStrength: number;
  bloomRadius: number;
  /** Solo brilla lo que supera este umbral de luminancia (HDR). */
  bloomThreshold: number;
  /** Intensidad del mapa de entorno (reflejos del acero). */
  environmentIntensity: number;
}

export const renderConfig: RenderConfig = {
  fov: 55,
  near: 0.1,
  far: 400,
  maxPixelRatio: 2,
  shadows: true,
  clearColor: 0x14171d,
  fogColor: 0x14171d,
  fogNear: 40,
  fogFar: 160,
  exposure: 1.05,
  bloom: true,
  bloomStrength: 0.55,
  bloomRadius: 0.35,
  bloomThreshold: 0.92,
  environmentIntensity: 0.55,
};
