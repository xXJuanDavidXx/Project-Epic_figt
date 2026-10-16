import * as THREE from 'three';

/** Texturas de efectos generadas en un canvas: sin assets externos. */

let flashTexture: THREE.Texture | null = null;
let starTexture: THREE.Texture | null = null;
let dotTexture: THREE.Texture | null = null;

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible para generar texturas de VFX.');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Destello radial: nucleo blanco y halo que se apaga rapido. */
export function getFlashTexture(): THREE.Texture {
  flashTexture ??= canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, 'rgba(255,240,210,0.95)');
    g.addColorStop(0.35, 'rgba(255,170,80,0.35)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  return flashTexture;
}

/** Estrella de cuatro puntas: el brillo de aviso en la hoja enemiga. */
export function getStarTexture(): THREE.Texture {
  starTexture ??= canvasTexture(128, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(c - dx * c, c - dy * c);
      ctx.lineTo(c + dy * 4, c + dx * 4);
      ctx.lineTo(c + dx * c, c + dy * c);
      ctx.lineTo(c - dy * 4, c - dx * 4);
      ctx.closePath();
      ctx.fill();
    }
  });
  return starTexture;
}

/** Punto suave para particulas. */
export function getDotTexture(): THREE.Texture {
  dotTexture ??= canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  return dotTexture;
}

let slashTexture: THREE.Texture | null = null;

/** Tajo: linea horizontal fina con extremos que se desvanecen (marca de corte). */
export function getSlashTexture(): THREE.Texture {
  slashTexture ??= canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    const h = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, s / 2);
    ctx.quadraticCurveTo(s / 2, s / 2 - h, s, s / 2);
    ctx.quadraticCurveTo(s / 2, s / 2 + h, 0, s / 2);
    ctx.fill();
  });
  return slashTexture;
}
