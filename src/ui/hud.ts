import * as THREE from 'three';
import './hud.css';
import type { EventBus } from '@/core/events';
import type { GameEventMap } from '@/core/eventMap';
import type { FrameContext, RenderUpdateSystem } from '@/core/loop';
import type { Combatant } from '@/combat/Combatant';

interface BarElements {
  root: HTMLElement;
  fill: HTMLElement;
}

interface VitalityElements extends BarElements {
  lag: number;
}

/**
 * HUD en DOM superpuesto al canvas. Solo LEE el estado (postura, vitalidad, estado roto)
 * y lo dibuja; por frame solo cambia variables CSS y transformaciones.
 */
export class Hud implements RenderUpdateSystem {
  private readonly root: HTMLElement;
  private readonly playerPosture: BarElements;
  private readonly playerVitality: VitalityElements;
  private readonly enemyPanel: HTMLElement;
  private readonly enemyPosture: BarElements;
  private readonly enemyVitality: VitalityElements;
  private readonly deathblow: HTMLElement;
  private readonly projected = new THREE.Vector3();
  private readonly struck = new Map<string, number>();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: Combatant,
    private readonly enemy: Combatant & { canBeDeathblowed(): boolean },
    bus: EventBus<GameEventMap>,
    parent: HTMLElement = document.body,
  ) {
    this.root = el('div', 'hud');
    this.root.setAttribute('aria-hidden', 'true');

    this.playerVitality = { ...vitalityBar('hud-player__vitality'), lag: 1 };
    this.playerPosture = postureBar('hud-player__posture');
    this.root.append(this.playerVitality.root, this.playerPosture.root);

    this.enemyPanel = el('div', 'hud-enemy');
    this.enemyPosture = postureBar('');
    this.enemyVitality = { ...vitalityBar(''), lag: 1 };
    this.enemyPanel.append(this.enemyPosture.root, this.enemyVitality.root);
    this.root.append(this.enemyPanel);

    this.deathblow = el('div', 'deathblow');
    this.deathblow.innerHTML = DEATHBLOW_MARK;
    const label = el('div', 'deathblow__label');
    const key = el('span', 'deathblow__key');
    key.textContent = 'Clic';
    label.append(key, document.createTextNode('Remate'));
    this.deathblow.append(label);
    this.root.append(this.deathblow);

    parent.append(this.root);

    bus.on('combat:resolved', (e) => {
      if (e.postureDamage > 0) this.struck.set(e.defenderId, 0.09);
    });
  }

  renderUpdate(ctx: FrameContext): void {
    const dt = ctx.frameDelta > 0 ? ctx.frameDelta : 1 / 60;
    for (const [id, time] of this.struck) {
      if (time - dt <= 0) this.struck.delete(id);
      else this.struck.set(id, time - dt);
    }

    this.updatePosture(this.playerPosture, this.player);
    this.updateVitality(this.playerVitality, this.player, dt);

    // Enemigo enfocado: barras sobre la cabeza, proyectadas a pantalla.
    const enemyVisible = this.enemy.alive && this.project(this.enemy.position, 1.25);
    this.enemyPanel.style.opacity = enemyVisible ? '1' : '0';
    if (enemyVisible) {
      this.enemyPanel.style.transform = `translate(${this.projected.x}px, ${this.projected.y}px) translate(-50%, -100%)`;
      this.updatePosture(this.enemyPosture, this.enemy);
      // La postura del enemigo solo se muestra cuando tiene algo: menos ruido en pantalla.
      this.enemyPosture.root.style.opacity = this.enemy.posture.value > 0.5 ? '1' : '0';
      this.updateVitality(this.enemyVitality, this.enemy, dt);
    }

    const canFinish = this.enemy.canBeDeathblowed() && this.project(this.enemy.position, 0.35);
    this.deathblow.classList.toggle('deathblow--visible', canFinish);
    if (canFinish) {
      this.deathblow.style.transform = `translate(${this.projected.x}px, ${this.projected.y}px) translate(-50%, -50%)`;
    }
  }

  private updatePosture(bar: BarElements, who: Combatant): void {
    const ratio = who.posture.ratio;
    bar.root.style.setProperty('--fill', ratio.toFixed(4));
    bar.root.style.setProperty('--heat', Math.max(0, (ratio - 0.35) / 0.65).toFixed(3));
    bar.root.classList.toggle('posture--critical', ratio > 0.8 && !who.posture.broken);
    bar.root.classList.toggle('posture--broken', who.posture.broken);
    bar.root.classList.toggle('posture--struck', this.struck.has(who.id));
  }

  private updateVitality(bar: VitalityElements, who: Combatant, dt: number): void {
    const ratio = who.vitality.ratio;
    // El rastro baja despues, con retraso: se lee cuanto quito el ultimo golpe.
    bar.lag = ratio > bar.lag ? ratio : Math.max(ratio, bar.lag - dt * 0.35);
    bar.root.style.setProperty('--fill', ratio.toFixed(4));
    bar.root.style.setProperty('--lag', bar.lag.toFixed(4));
  }

  /** Proyecta un punto (con desplazamiento vertical) a pixeles. false si queda detras. */
  private project(position: { x: number; y: number; z: number }, yOffset: number): boolean {
    this.projected.set(position.x, position.y + yOffset, position.z).project(this.camera);
    if (this.projected.z > 1 || this.projected.z < -1) return false;
    this.projected.x = ((this.projected.x + 1) / 2) * window.innerWidth;
    this.projected.y = ((1 - this.projected.y) / 2) * window.innerHeight;
    return true;
  }

  dispose(): void {
    this.root.remove();
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function postureBar(extraClass: string): BarElements {
  const root = el('div', `posture ${extraClass}`.trim());
  const fill = el('div', 'posture__fill');
  root.append(fill);
  return { root, fill };
}

function vitalityBar(extraClass: string): BarElements {
  const root = el('div', `vitality ${extraClass}`.trim());
  const lag = el('div', 'vitality__lag');
  const fill = el('div', 'vitality__fill');
  root.append(lag, fill);
  return { root, fill };
}

/** Marca de remate original: anillo roto (la guardia quebrada) y chispa de cuatro puntas. */
const DEATHBLOW_MARK = `
<svg viewBox="-32 -32 64 64" aria-hidden="true">
  <path d="M -6.2 -29.4 A 30 30 0 0 0 -29.4 6.2" fill="none" stroke="#e8e1d3" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M 6.2 29.4 A 30 30 0 0 0 29.4 -6.2" fill="none" stroke="#e8e1d3" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M -24 -14 L -28 -20 M 24 14 L 28 20" stroke="#e8893a" stroke-width="2" stroke-linecap="round"/>
  <path d="M 0 -17 L 3.2 -3.2 L 17 0 L 3.2 3.2 L 0 17 L -3.2 3.2 L -17 0 L -3.2 -3.2 Z" fill="#fff2c9"/>
  <circle r="2.6" fill="#e8893a"/>
</svg>`;
