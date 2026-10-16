import type * as THREE from 'three';
import { AnimationController } from '@/animation/AnimationController';
import type { Clip } from '@/animation/types';
import { DUELIST_CLIPS } from '@/animation/clips/duelist';
import type { DuelistClipId } from '@/animation/clips/duelist';
import { enemyConfig } from '@/config/enemy';
import type { FixedUpdateSystem, FrameContext, RenderUpdateSystem } from '@/core/loop';
import type { EnemyDuelist } from '@/entities/enemies/EnemyDuelist';
import type { DuelistStateId } from '@/entities/enemies/duelistStates';
import { buildHumanoid } from '@/render/character/humanoid';
import type { HumanoidRig } from '@/render/character/humanoid';
import { updateTrail } from '@/render/character/secondary';

/** Presentacion del duelista: solo lee el estado del controller. */
export class EnemyView implements FixedUpdateSystem, RenderUpdateSystem {
  readonly rig: HumanoidRig;
  readonly animation: AnimationController;

  private lastState: DuelistStateId | null = null;
  private lastSwingId = -1;
  private lastDeflected = 0;
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
      this.animation.setTremble(0.008);
      return;
    }
    this.animation.setTremble(0);

    const state = this.enemy.stateId;
    const context = this.enemy.context;
    const changed = state !== this.lastState;

    if (state === 'attack' && context.swingId !== this.lastSwingId && context.attack) {
      const id = context.attack.id as DuelistClipId;
      // Tras un deflect el siguiente golpe del combo arranca casi en seco desde el rebote.
      const fade = context.deflectedCount !== this.lastDeflected ? 3 : 5;
      this.animation.play(DUELIST_CLIPS[id], { fadeTicks: fade, restart: true });
    } else if (changed) {
      this.animation.play(this.clipFor(state), {
        fadeTicks: this.fadeFor(state),
        restart: state !== 'idle' && state !== 'approach',
      });
    }
    this.lastState = state;
    this.lastSwingId = context.swingId;
    this.lastDeflected = context.deflectedCount;
    this.animation.tick();
  }

  renderUpdate(ctx: FrameContext): void {
    this.animation.apply(this.enemy.frozen ? 0 : ctx.alpha);
    this.time += ctx.frameDelta;
    updateTrail(
      this.rig,
      this.enemy.alive ? this.enemy.context.velocity3 : this.still,
      this.time,
      this.enemy.facingYaw,
    );
    this.rig.root.visible = this.enemy.stateId !== 'dead' || this.enemy.machine.ticksInState < 120;
  }

  private fadeFor(state: DuelistStateId): number {
    switch (state) {
      case 'recoil':
      case 'blockstun':
        return 0;
      case 'hitstun':
      case 'broken':
        return 2;
      default:
        return 8;
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
        return DUELIST_CLIPS.broken;
      case 'dying':
      case 'dead':
        return DUELIST_CLIPS.death;
    }
  }
}
