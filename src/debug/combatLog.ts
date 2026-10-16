import { debugConfig } from '@/config/debug';
import type { EventBus } from '@/core/events';
import type { GameEventMap } from '@/core/eventMap';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';

const OUTCOME_LABEL: Record<string, string> = {
  deflect_perfect: 'DEFLECT PERFECTO',
  deflect: 'deflect',
  block: 'bloqueo',
  guard_break: 'GUARDIA ROTA',
  hit: 'golpe',
  evaded: 'esquivado',
};

/** Log de eventos de combate con su tick exacto (CLAUDE.md seccion 10). */
export class CombatLog implements RenderUpdateSystem {
  private readonly element: HTMLElement;
  private readonly lines: string[] = [];
  private dirty = true;

  constructor(bus: EventBus<GameEventMap>, parent: HTMLElement = document.body) {
    this.element = document.createElement('div');
    this.element.id = 'combat-log';
    Object.assign(this.element.style, {
      position: 'fixed',
      right: '8px',
      bottom: '8px',
      padding: '6px 10px',
      fontSize: '11px',
      lineHeight: '1.5',
      color: '#cfd6e4',
      background: 'rgba(10, 12, 16, 0.6)',
      border: '1px solid rgba(207, 214, 228, 0.15)',
      borderRadius: '4px',
      whiteSpace: 'pre',
      pointerEvents: 'none',
      fontFamily: 'ui-monospace, monospace',
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.element);

    bus.on('combat:resolved', (e) =>
      this.push(
        `${pad(e.tick)}  ${e.attackerId} > ${e.defenderId}  ${e.attackId.padEnd(18)} ${OUTCOME_LABEL[e.outcome] ?? e.outcome}  post ${e.postureDamage.toFixed(1)}${e.vitalityDamage ? `  vida ${e.vitalityDamage}` : ''}`,
      ),
    );
    bus.on('combat:postureBreak', (e) => this.push(`${pad(e.tick)}  POSTURA ROTA  ${e.entityId}`));
    bus.on('combat:deathblow', (e) =>
      this.push(`${pad(e.tick)}  REMATE  ${e.attackerId} > ${e.victimId}`),
    );
    bus.on('combat:respawn', (e) => this.push(`${pad(e.tick)}  reaparece ${e.entityId}`));
  }

  private push(line: string): void {
    this.lines.push(line);
    if (this.lines.length > 9) this.lines.shift();
    this.dirty = true;
  }

  renderUpdate(_ctx: FrameContext): void {
    this.element.style.display = debugConfig.showCombatLog ? 'block' : 'none';
    if (!this.dirty) return;
    this.element.textContent = this.lines.length
      ? this.lines.join('\n')
      : 'log de combate: sin eventos';
    this.dirty = false;
  }
}

function pad(tick: number): string {
  return `t${tick.toString().padStart(6, '0')}`;
}
