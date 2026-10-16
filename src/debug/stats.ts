import type { FrameContext, GameLoop, RenderUpdateSystem } from '@/core/loop';
import { simConfig } from '@/config/sim';
import type { PlayerController } from '@/entities/player/PlayerController';

/**
 * Overlay de diagnostico: rendimiento (FPS, pasos por frame, ticks descartados) y
 * estado del jugador (FSM, velocidad, suelo). El FPS se promedia en una ventana corta.
 */
export class DebugStats implements RenderUpdateSystem {
  private readonly element: HTMLElement;
  private frames = 0;
  private accumulated = 0;
  private fps = 0;
  private worstFrameMs = 0;

  constructor(
    private readonly loop: GameLoop,
    private readonly player: PlayerController | null = null,
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
      `FPS       ${this.fps.toFixed(0).padStart(4)}  (peor ${this.worstFrameMs.toFixed(1)} ms)`,
      `tick      ${ctx.tick.toString().padStart(4)}  @ ${simConfig.tickRate} Hz`,
      `pasos/f   ${this.loop.stepsPerFrame.toString().padStart(4)}  alpha ${ctx.alpha.toFixed(2)}`,
      `timeScale ${simConfig.timeScale.toFixed(2)}  dropped ${this.loop.clock.droppedTicks}`,
    ];

    if (this.player) {
      const p = this.player;
      const pos = p.worldPosition;
      lines.push(
        '',
        `estado    ${p.stateId.padEnd(6)} ${p.machine.ticksInState.toString().padStart(3)}t`,
        `suelo     ${p.grounded ? 'si' : 'NO'}`,
        `vel       ${p.horizontalSpeed.toFixed(2).padStart(5)} m/s   vy ${p.velocity.y.toFixed(1)}`,
        `pos       ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      );
    }

    this.element.textContent = lines.join('\n');
  }

  dispose(): void {
    this.element.remove();
  }
}
