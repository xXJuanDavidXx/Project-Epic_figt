export interface CameraConfig {
  /** Distancia deseada del pivote a la camara, en metros. */
  distance: number;
  /** Altura del pivote sobre los pies del jugador. */
  pivotHeight: number;
  /** Desplazamiento lateral del encuadre (hombro). */
  shoulderOffset: number;
  /** Sensibilidad del raton, radianes por pixel. */
  mouseSensitivity: number;
  /** Velocidad de giro del stick derecho, radianes por segundo a fondo. */
  stickSensitivity: number;
  invertY: boolean;
  pitchMinDeg: number;
  pitchMaxDeg: number;
  /** Radio de la esfera que se lanza del pivote a la camara para no atravesar muros. */
  collisionRadius: number;
  /** Suelo duro de distancia: por debajo, la camara se pega al jugador. */
  minDistance: number;
  /** Suavizado al alejarse tras una colision (fraccion por segundo). */
  distanceSmoothing: number;
  /** Suavizado del seguimiento del pivote (fraccion por segundo). */
  followSmoothing: number;
}

export const cameraConfig: CameraConfig = {
  distance: 5,
  pivotHeight: 1.45,
  shoulderOffset: 0.5,
  mouseSensitivity: 0.0024,
  stickSensitivity: 3.2,
  invertY: false,
  pitchMinDeg: -38,
  pitchMaxDeg: 62,
  collisionRadius: 0.25,
  minDistance: 0.2,
  distanceSmoothing: 6,
  followSmoothing: 22,
};
