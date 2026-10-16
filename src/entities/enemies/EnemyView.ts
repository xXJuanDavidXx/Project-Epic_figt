import type * as THREE from 'three';
import { AnimationController } from '@/animation/AnimationController';
import type { Clip } from '@/animation/types';
import { DUELIST_CLIPS } from '@/animation/clips/duelist';
import type { DuelistClipId } from '@/animation/clips/duelist';
import { enemyConfig } from '@/config/enemy';
import type { FixedUpdateSystem, FrameContext, RenderUpdateSystem } from '@/core/loop';
import type { StrikeDirection } from '@/combat/types';
import type { EnemyDuelist } from '@/entities/enemies/EnemyDuelist';
import type { DuelistStateId } from '@/entities/enemies/duelistStates';
import { buildHumanoid } from '@/render/character/humanoid';
import type { HumanoidRig } from '@/render/character/humanoid';
import { updateTrail } from '@/render/character/secondary';

/**
 * Presentacion del duelista: solo lee el estado del controller.
 *
 * Reglas de corte (estilo staccato): las reacciones entran con corte seco (fade 0); solo
 * los enlaces entre golpes de un combo llevan un crossfade de 2-4 ticks.
 */
export class EnemyView implements FixedUpdateSystem, RenderUpdateSystem {
  readonly rig: HumanoidRig;
  readonly animation: AnimationController;

  private lastState: DuelistStateId | null = null;
  private lastSwingId = -1;
  private showingBounce = false;
  private time = 0;
  private readonly still = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly enemy: EnemyDuelist,
    parent: THREE.Object3D,
  ) {
    this.rig = buildHumanoid('duelist');
    this.rig.root.position.y = -(enemyConfig.capsuleHalfHeight + enemyConfig.capsuleRadius);
    parent.add(this.rig.root);
    this.animation = new AnimationController(this.rig, DUELIST_CLIPS.idle);
  }

  fixedUpdate(): void {
    if (this.enemy.frozen) {
      this.animation.setTremble(0.009);
      return;
    }
    this.animation.setTremble(0);

    const state = this.enemy.stateId;
    const context = this.enemy.context;
    const changed = state !== this.lastState;

    if (state === 'attack' && context.attack) {
      this.updateAttack(changed);
    } else if (state === 'broken' && !changed && this.animation.clip === DUELIST_CLIPS.break_jolt) {
      if (this.animation.finished) this.animation.play(DUELIST_CLIPS.broken, { fadeTicks: 0 });
    } else if (changed) {
      this.showingBounce = false;
      this.animation.play(this.clipFor(state), {
        fadeTicks: this.fadeFor(state),
        restart: state !== 'idle' && state !== 'approach' && state !== 'dead',
      });
    }

    this.lastState = state;
    this.lastSwingId = context.swingId;
    this.animation.tick();
  }

  /**
   * Durante un ataque: si viene de un deflect (attackTicks < 0) se ve el REBOTE del arma;
   * cuando el rebote termina, el clip del golpe arranca sincronizado con `attackTicks`.
   */
  private updateAttack(stateChanged: boolean): void {
    const context = this.enemy.context;
    const attack = context.attack;
    if (!attack) return;
    const newSwing = context.swingId !== this.lastSwingId;

    if (context.attackTicks < 0) {
      if (!this.showingBounce || newSwing) {
        this.showingBounce = true;
        this.animation.play(this.bounceClip(context.lastDeflectedStrike), {
          fadeTicks: 0,
          restart: true,
        });
      }
      return;
    }

    const clip = DUELIST_CLIPS[attack.id as DuelistClipId];
    if (this.showingBounce || newSwing || stateChanged || this.animation.clip !== clip) {
      const fromBounce = this.showingBounce;
      this.showingBounce = false;
      this.animation.play(clip, {
        fadeTicks: fromBounce ? 2 : 4,
        restart: true,
        startAt: context.attackTicks,
      });
    }
  }

  renderUpdate(ctx: FrameContext): void {
    this.animation.apply(this.enemy.frozen ? 0 : ctx.alpha);
    this.time += ctx.frameDelta;
    const velocity = this.enemy.alive ? this.enemy.context.velocity3 : this.still;
    updateTrail(this.rig, velocity, this.time, this.enemy.facingYaw);
    this.rig.root.visible = this.enemy.stateId !== 'dead' || this.enemy.machine.ticksInState < 120;
  }

  private bounceClip(strike: StrikeDirection): Clip {
    switch (strike) {
      case 'from_left':
        return DUELIST_CLIPS.bounce_from_left;
      case 'overhead':
        return DUELIST_CLIPS.bounce_overhead;
      default:
        return DUELIST_CLIPS.bounce_from_right;
    }
  }

  private fadeFor(state: DuelistStateId): number {
    switch (state) {
      case 'recoil':
      case 'blockstun':
      case 'hitstun':
      case 'broken':
      case 'dying':
        return 0;
      default:
        return 6;
    }
  }

  private clipFor(state: DuelistStateId): Clip {
    switch (state) {
      case 'idle':
        return DUELIST_CLIPS.idle;
      case 'approach':
        return DUELIST_CLIPS.walk;
      case 'attack':
        return DUELIST_CLIPS.e_slash;
      case 'recoil':
        return DUELIST_CLIPS.recoil;
      case 'blockstun':
        return DUELIST_CLIPS.block_hit;
      case 'hitstun':
        return DUELIST_CLIPS.hit_react;
      case 'broken':
        return DUELIST_CLIPS.break_jolt;
      case 'dying':
      case 'dead':
        return DUELIST_CLIPS.deathblowed;
    }
  }
}
