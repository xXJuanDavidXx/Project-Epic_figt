import type { FrameContext, GameLoop, RenderUpdateSystem } from '@/core/loop';
import { simConfig } from '@/config/sim';

/**
 * Overlay de diagnostico: FPS, tick de simulacion, pasos por frame, alpha y ticks
 * descartados. El contador de FPS se promedia en una ventana para que sea legible.
 */
export class DebugStats implements RenderUpdateSystem {
  private readonly element: HTMLElement;
  private frames = 0;
  private accumulated = 0;
  private fps = 0;
  private worstFrameMs = 0;

  constructor(
    private readonly loop: GameLoop,
    parent: HTMLElement = document.body,
  ) {
    this.element = document.createElement('div');
    this.element.id = 'debug-overlay';
    parent.appendChild(this.element);
  }

  renderUpdate(ctx: FrameContext): void {
    this.frames += 1;
    this.accumulated += ctx.frameDelta;
    this.worstFrameMs = Math.max(this.worstFrameMs, ctx.frameDelta * 1000);

    if (this.accumulated >= 0.25) {
      this.fps = this.frames / this.accumulated;
      this.frames = 0;
      this.accumulated = 0;
      this.render(ctx);
      this.worstFrameMs = 0;
      return;
    }

    this.render(ctx);
  }

  private render(ctx: FrameContext): void {
    const lines = [
      `FPS      ${this.fps.toFixed(0).padStart(4)}  (peor ${this.worstFrameMs.toFixed(1)} ms)`,
      `tick     ${ctx.tick.toString().padStart(4)}  @ ${simConfig.tickRate} Hz`,
      `pasos/f  ${this.loop.stepsPerFrame.toString().padStart(4)}  alpha ${ctx.alpha.toFixed(2)}`,
      `timeScale ${simConfig.timeScale.toFixed(2)}`,
      `dropped  ${this.loop.clock.droppedTicks.toString().padStart(4)}`,
    ];
    this.element.textContent = lines.join('\n');
  }

  dispose(): void {
    this.element.remove();
  }
}
