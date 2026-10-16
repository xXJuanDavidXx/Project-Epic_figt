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
}

export const renderConfig: RenderConfig = {
  fov: 55,
  near: 0.1,
  far: 400,
  maxPixelRatio: 2,
  shadows: true,
  clearColor: 0x0b0d10,
  fogColor: 0x0b0d10,
  fogNear: 40,
  fogFar: 160,
};
