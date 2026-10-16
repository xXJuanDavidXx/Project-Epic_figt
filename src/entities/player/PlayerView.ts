import type * as THREE from 'three';
import { AnimationController } from '@/animation/AnimationController';
import type { Clip } from '@/animation/types';
import { sampleClip } from '@/animation/sampler';
import { RONIN_CLIPS } from '@/animation/clips/ronin';
import type { RoninClipId } from '@/animation/clips/ronin';
import { playerConfig } from '@/config/player';
import type { FixedUpdateSystem, FrameContext, RenderUpdateSystem } from '@/core/loop';
import type { PlayerController } from '@/entities/player/PlayerController';
import type { PlayerStateId } from '@/entities/player/playerStates';
import { buildHumanoid } from '@/render/character/humanoid';
import type { HumanoidRig } from '@/render/character/humanoid';
import { updateTrail } from '@/render/character/secondary';

/**
 * Presentacion del jugador: humanoide + animacion. Solo LEE el estado del controller;
 * nunca decide reglas (CLAUDE.md seccion 11).
 */
export class PlayerView implements FixedUpdateSystem, RenderUpdateSystem {
  readonly rig: HumanoidRig;
  readonly animation: AnimationController;

  /** Debug: fuerza un clip y opcionalmente congela su tiempo. */
  preview: { clip: RoninClipId; time: number | null } | null = null;

  private lastState: PlayerStateId | null = null;
  private lastSwingId = -1;
  private lastDeflectCount = 0;
  private lastBlockedCount = 0;
  /** Ticks que quedan de rebote visual tras un golpe bloqueado. */
  private bounceTicks = 0;
  private trailTime = 0;

  constructor(
    private readonly player: PlayerController,
    parent: THREE.Object3D,
  ) {
    this.rig = buildHumanoid('ronin');
    // El objeto del jugador esta en el centro de la capsula: los pies van media altura abajo.
    this.rig.root.position.y = -(playerConfig.capsuleHalfHeight + playerConfig.capsuleRadius);
    parent.add(this.rig.root);
    this.animation = new AnimationController(this.rig, RONIN_CLIPS.idle);
  }

  fixedUpdate(): void {
    if (this.preview) {
      this.animation.play(RONIN_CLIPS[this.preview.clip], { fadeTicks: 0 });
      if (this.preview.time === null) this.animation.tick();
      return;
    }

    // Hitstop: la pose se congela y las hojas tiemblan por el choque.
    if (this.player.frozen) {
      this.animation.setTremble(0.006);
      return;
    }
    this.animation.setTremble(0);

    const state = this.player.stateId;
    const context = this.player.context;
    const stateChanged = state !== this.lastState;
    const newSwing = context.swingId !== this.lastSwingId;
    const newDeflect = context.deflectCount !== this.lastDeflectCount;

    const blocked = context.attackBlockedCount !== this.lastBlockedCount;
    this.lastBlockedCount = context.attackBlockedCount;

    if (state === 'attack' && blocked && !newSwing) {
      // La hoja rebota en la guardia enemiga; la simulacion del combo sigue intacta.
      this.bounceTicks = 6;
      this.animation.play(RONIN_CLIPS.attack_bounced, { fadeTicks: 0, restart: true });
    } else if (this.bounceTicks > 0 && state === 'attack' && !newSwing) {
      this.bounceTicks -= 1;
      if (this.bounceTicks === 0 && context.attack) {
        const resume = RONIN_CLIPS[context.attack.id as RoninClipId];
        this.animation.play(resume, { fadeTicks: 2, restart: true, startAt: context.attackTicks });
      }
    } else if (state === 'deflect' && (stateChanged || newDeflect)) {
      // Corte seco a la pose de contacto: el golpe de acero ES el cambio de pose.
      this.animation.play(this.deflectClip(), { fadeTicks: 0, restart: true });
    } else if ((state === 'attack' || state === 'deathblow') && newSwing) {
      this.bounceTicks = 0;
      const id = context.attack?.id;
      const clip = id && id in RONIN_CLIPS ? RONIN_CLIPS[id as RoninClipId] : RONIN_CLIPS.atk_1;
      this.animation.play(clip, { fadeTicks: state === 'deathblow' ? 0 : 2, restart: true });
    } else if (stateChanged) {
      this.onStateEnter(state);
    }
    this.lastState = state;
    this.lastSwingId = context.swingId;
    this.lastDeflectCount = context.deflectCount;

    // La carrera avanza al ritmo de la velocidad real: los pies no patinan.
    if (state === 'run' || state === 'sprint') {
      const reference = state === 'run' ? playerConfig.walkSpeed : playerConfig.sprintSpeed;
      const speed = Math.max(this.player.horizontalSpeed / reference, 0.35);
      this.animation.play(this.clipFor(state), { speed });
    }
    this.animation.tick();
  }

  renderUpdate(ctx: FrameContext): void {
    if (this.preview && this.preview.time !== null) {
      this.animation.applyPose(sampleClip(RONIN_CLIPS[this.preview.clip], this.preview.time));
    } else {
      this.animation.apply(this.player.frozen ? 0 : ctx.alpha);
    }
    this.trailTime += ctx.frameDelta;
    updateTrail(this.rig, this.player.velocity, this.trailTime, this.player.yaw);
  }

  private deflectClip(): Clip {
    switch (this.player.context.lastStrike) {
      case 'overhead':
        return RONIN_CLIPS.deflect_high;
      case 'from_left':
        return RONIN_CLIPS.deflect_right;
      case 'thrust':
        return RONIN_CLIPS.deflect_thrust;
      case 'from_right':
      case 'low':
        return RONIN_CLIPS.deflect_left;
    }
  }

  private onStateEnter(state: PlayerStateId): void {
    const fades: Partial<Record<PlayerStateId, number>> = {
      dodge: 2,
      jump: 3,
      guard: 3,
      blockstun: 0,
      hitstun: 1,
      guardBreak: 0,
    };
    const restart = ['dodge', 'jump', 'blockstun', 'hitstun', 'guardBreak', 'dead'].includes(state);
    this.animation.play(this.clipFor(state), { fadeTicks: fades[state] ?? 7, restart });
  }

  private clipFor(state: PlayerStateId): Clip {
    switch (state) {
      case 'idle':
        return RONIN_CLIPS.idle;
      case 'run':
        return RONIN_CLIPS.run;
      case 'sprint':
        return RONIN_CLIPS.sprint;
      case 'jump':
        return RONIN_CLIPS.jump;
      case 'fall':
        return RONIN_CLIPS.fall;
      case 'dodge':
        return RONIN_CLIPS.dodge;
      case 'guard':
        return RONIN_CLIPS.guard;
      case 'deflect':
        return this.deflectClip();
      case 'blockstun':
        return RONIN_CLIPS.block_hit;
      case 'attack':
        return RONIN_CLIPS.atk_1;
      case 'deathblow':
        return RONIN_CLIPS.deathblow;
      case 'hitstun':
        return RONIN_CLIPS.hit_react;
      case 'guardBreak':
      case 'dead':
        return RONIN_CLIPS.guard_break;
    }
  }
}
