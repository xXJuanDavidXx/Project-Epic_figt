import type * as THREE from 'three';
import { feedbackConfig } from '@/config/feedback';
import { FIXED_DELTA } from '@/config/sim';
import type { EventBus } from '@/core/events';
import type { GameEventMap } from '@/core/eventMap';
import type { SfxSynth } from '@/audio/sfx';

/**
 * Traduce eventos de combate a sonido. Paneo estereo segun la posicion respecto a la camara:
 * un golpe que llega por la izquierda se oye a la izquierda.
 */
export class CombatAudio {
  constructor(
    private readonly sfx: SfxSynth,
    private readonly camera: THREE.PerspectiveCamera,
    bus: EventBus<GameEventMap>,
  ) {
    bus.on('combat:resolved', (e) => {
      this.sfx.volume = feedbackConfig.masterVolume;
      const pan = this.panFor(e.contact);
      switch (e.outcome) {
        case 'deflect_perfect':
          this.sfx.deflect(true, pan);
          break;
        case 'deflect':
          this.sfx.deflect(false, pan);
          break;
        case 'block':
          this.sfx.block(pan);
          break;
        case 'guard_break':
          this.sfx.guardBreak(pan);
          break;
        case 'hit':
          this.sfx.hit(pan);
          break;
        case 'evaded':
          break;
      }
    });
    bus.on('combat:postureBreak', (e) => this.sfx.postureBreak(this.panFor(e.position)));
    bus.on('combat:deathblow', (e) => this.sfx.deathblow(this.panFor(e.position)));
    bus.on('combat:telegraph', () => this.sfx.telegraph(0));
    bus.on('combat:swingStart', (e) => {
      // El silbido se programa para sonar justo en los ticks activos del golpe.
      const delay = Math.max(e.attack.startupTicks - 4, 0) * FIXED_DELTA;
      this.sfx.swing(e.attack.postureDmg >= 25, delay, 0);
    });
  }

  private panFor(position: { x: number; z: number }): number {
    // Vector "derecha" de la camara: primera columna de su matriz de mundo.
    const e = this.camera.matrixWorld.elements;
    const right = { x: e[0] ?? 1, z: e[2] ?? 0 };
    const dx = position.x - this.camera.position.x;
    const dz = position.z - this.camera.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    return ((dx * right.x + dz * right.z) / distance) * 0.7;
  }
}
