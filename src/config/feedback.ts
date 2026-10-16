/**
 * Tuning del "game feel" (CLAUDE.md 5.7): chispas, destellos, sacudida y sonido.
 * Es presentacion: no afecta a la simulacion, se puede tocar en caliente sin romper nada.
 */
export interface ImpactFeel {
  sparks: number;
  sparkSpeed: [number, number];
  sparkLife: [number, number];
  /** Color de las chispas en HDR (>1 brilla con el bloom). */
  sparkColor: [number, number, number];
  flashSize: number;
  lightIntensity: number;
  shake: number;
  fovPunch: number;
}

export interface FeedbackConfig {
  deflectPerfect: ImpactFeel;
  deflect: ImpactFeel;
  block: ImpactFeel;
  guardBreak: ImpactFeel;
  /** 'ink' = salpicadura estilizada oscura, 'blood' = roja, 'none' = sin particulas. */
  hitStyle: 'ink' | 'blood' | 'none';
  hitParticles: number;
  hitShake: number;
  postureBreakShake: number;
  deathblowShake: number;
  /** Cuanto dura el brillo de aviso en la hoja enemiga, en segundos. */
  telegraphGlint: number;
  masterVolume: number;
}

export const feedbackConfig: FeedbackConfig = {
  deflectPerfect: {
    sparks: 90,
    sparkSpeed: [4, 10],
    sparkLife: [0.16, 0.5],
    sparkColor: [3.2, 2.5, 1.5],
    flashSize: 0.42,
    lightIntensity: 9,
    shake: 0.42,
    fovPunch: -3.5,
  },
  deflect: {
    sparks: 55,
    sparkSpeed: [3, 8],
    sparkLife: [0.14, 0.4],
    sparkColor: [2.8, 1.7, 0.7],
    flashSize: 0.3,
    lightIntensity: 5,
    shake: 0.3,
    fovPunch: -2,
  },
  block: {
    sparks: 14,
    sparkSpeed: [1.5, 4],
    sparkLife: [0.1, 0.25],
    sparkColor: [1.6, 0.8, 0.3],
    flashSize: 0.16,
    lightIntensity: 1.5,
    shake: 0.22,
    fovPunch: 0,
  },
  guardBreak: {
    sparks: 40,
    sparkSpeed: [2, 7],
    sparkLife: [0.15, 0.45],
    sparkColor: [2.2, 1.0, 0.4],
    flashSize: 0.45,
    lightIntensity: 6,
    shake: 0.55,
    fovPunch: 2.5,
  },
  hitStyle: 'ink',
  hitParticles: 26,
  hitShake: 0.3,
  postureBreakShake: 0.5,
  deathblowShake: 0.65,
  telegraphGlint: 0.28,
  masterVolume: 0.7,
};
