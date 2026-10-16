import { describe, expect, it } from 'vitest';
import { CombatSystem } from '@/combat/CombatSystem';
import type { ActiveSwing, CombatEvent, Combatant } from '@/combat/Combatant';
import { Posture } from '@/combat/posture';
import { Vitality } from '@/combat/vitality';
import { verticalCapsule } from '@/combat/geometry';
import type { Capsule } from '@/combat/geometry';
import { DUMMY_ATTACKS, PLAYER_ATTACKS } from '@/combat/attackData';
import type { AttackDef, DefenseSnapshot, Team, Vec3 } from '@/combat/types';
import { combatConfig } from '@/config/combat';
import { EventBus } from '@/core/events';
import type { GameEventMap } from '@/core/eventMap';

/** Combatiente falso y controlable: el CombatSystem no distingue jugador de enemigo. */
class FakeCombatant implements Combatant {
  readonly posture = new Posture(100);
  readonly vitality = new Vitality(100);
  hitstop = 0;
  facingYaw = 0;
  alive = true;
  swing: ActiveSwing | null = null;
  defenseState: DefenseSnapshot = {
    deflect: null,
    blocking: false,
    invulnerable: false,
    facingAttacker: true,
  };
  received: CombatEvent[] = [];
  resolved: CombatEvent[] = [];
  deathblowed = false;
  broken = false;

  constructor(
    readonly id: string,
    readonly team: Team,
    readonly position: Vec3,
  ) {}

  hurtbox(): Capsule {
    return verticalCapsule(this.position, 0.55, 0.35);
  }
  activeSwing(): ActiveSwing | null {
    return this.swing;
  }
  defense(): DefenseSnapshot {
    return this.defenseState;
  }
  canBeDeathblowed(): boolean {
    return this.broken;
  }
  onHitReceived(event: CombatEvent): void {
    this.received.push(event);
  }
  onAttackResolved(event: CombatEvent): void {
    this.resolved.push(event);
  }
  onDeathblowReceived(): void {
    this.deathblowed = true;
  }

  /** Tajo que alcanza a `target`. */
  swingAt(target: FakeCombatant, attack: AttackDef, swingId = 1): void {
    this.swing = { swingId, attack, hitbox: { center: { ...target.position }, radius: 0.5 } };
  }
}

function setup(): {
  combat: CombatSystem;
  enemy: FakeCombatant;
  player: FakeCombatant;
  bus: EventBus<GameEventMap>;
} {
  const bus = new EventBus<GameEventMap>();
  const combat = new CombatSystem(bus, combatConfig);
  const enemy = new FakeCombatant('enemy', 'enemy', { x: 0, y: 1, z: 0 });
  const player = new FakeCombatant('player', 'player', { x: 0, y: 1, z: 1.5 });
  combat.add(enemy);
  combat.add(player);
  return { combat, enemy, player, bus };
}

describe('CombatSystem', () => {
  it('un tajo golpea una sola vez al mismo objetivo aunque siga activo', () => {
    const { combat, enemy, player } = setup();
    enemy.swingAt(player, DUMMY_ATTACKS.e_slash);
    combat.fixedUpdate({ tick: 1 });
    combat.fixedUpdate({ tick: 2 });
    combat.fixedUpdate({ tick: 3 });
    expect(player.received).toHaveLength(1);
  });

  it('el hitstop no borra el registro: al descongelarse no vuelve a golpear', () => {
    const { combat, enemy, player } = setup();
    enemy.swingAt(player, DUMMY_ATTACKS.e_slash);
    combat.fixedUpdate({ tick: 1 });
    expect(enemy.hitstop).toBeGreaterThan(0);
    // Simulamos que el hitstop pasa con el tajo aun activo.
    for (let t = 2; t < 2 + combatConfig.hitstopHit; t += 1) {
      combat.fixedUpdate({ tick: t });
      enemy.hitstop = Math.max(0, enemy.hitstop - 1);
    }
    combat.fixedUpdate({ tick: 20 });
    expect(player.received).toHaveLength(1);
  });

  it('un tajo nuevo (otro swingId) si vuelve a golpear', () => {
    const { combat, enemy, player } = setup();
    enemy.swingAt(player, DUMMY_ATTACKS.e_slash, 1);
    combat.fixedUpdate({ tick: 1 });
    enemy.hitstop = 0;
    enemy.swingAt(player, DUMMY_ATTACKS.e_rising, 2);
    combat.fixedUpdate({ tick: 2 });
    expect(player.received).toHaveLength(2);
  });

  it('no golpea a los del mismo equipo', () => {
    const { combat, enemy } = setup();
    const ally = new FakeCombatant('ally', 'enemy', { x: 0, y: 1, z: 1 });
    combat.add(ally);
    enemy.swingAt(ally, DUMMY_ATTACKS.e_slash);
    combat.fixedUpdate({ tick: 1 });
    expect(ally.received).toHaveLength(0);
  });

  it('fuera de alcance no hay golpe', () => {
    const { combat, enemy, player } = setup();
    enemy.swing = {
      swingId: 1,
      attack: DUMMY_ATTACKS.e_slash,
      hitbox: { center: { x: 0, y: 1, z: -5 }, radius: 0.5 },
    };
    combat.fixedUpdate({ tick: 1 });
    expect(player.received).toHaveLength(0);
  });

  it('deflect: el defensor no pierde vida, el atacante gana postura y ambos se congelan', () => {
    const { combat, enemy, player } = setup();
    player.defenseState = { ...player.defenseState, deflect: 'normal' };
    enemy.swingAt(player, DUMMY_ATTACKS.e_slash);
    combat.fixedUpdate({ tick: 1 });
    expect(player.vitality.value).toBe(100);
    expect(enemy.posture.value).toBeGreaterThan(0);
    expect(enemy.hitstop).toBe(combatConfig.hitstopDeflect);
    expect(player.hitstop).toBe(combatConfig.hitstopDeflect);
    expect(player.received[0]?.result.outcome).toBe('deflect');
    expect(enemy.resolved[0]?.result.outcome).toBe('deflect');
  });

  it('el deflect no rompe la postura propia aunque este casi llena', () => {
    const { combat, enemy, player } = setup();
    player.posture.damage(98, 0);
    player.defenseState = { ...player.defenseState, deflect: 'normal' };
    enemy.swingAt(player, DUMMY_ATTACKS.e_overhead);
    combat.fixedUpdate({ tick: 1 });
    expect(player.posture.broken).toBe(false);
  });

  it('desviar suficientes golpes rompe la postura del atacante', () => {
    const { combat, enemy, player } = setup();
    player.defenseState = { ...player.defenseState, deflect: 'perfect' };
    let broke = false;
    for (let i = 1; i <= 10 && !broke; i += 1) {
      enemy.hitstop = 0;
      enemy.swingAt(player, DUMMY_ATTACKS.e_overhead, i);
      combat.fixedUpdate({ tick: i });
      broke = enemy.resolved.at(-1)?.attackerPostureBroken ?? false;
    }
    expect(broke).toBe(true);
    expect(enemy.posture.broken).toBe(true);
  });

  it('emite combat:resolved con el tick y el resultado', () => {
    const { combat, enemy, player, bus } = setup();
    const seen: string[] = [];
    bus.on('combat:resolved', (e) => seen.push(`${e.tick}:${e.outcome}`));
    enemy.swingAt(player, DUMMY_ATTACKS.e_slash);
    combat.fixedUpdate({ tick: 7 });
    expect(seen).toEqual(['7:hit']);
  });

  it('el remate solo funciona sobre un objetivo rompible y lo mata', () => {
    const { combat, enemy, player, bus } = setup();
    const deaths: string[] = [];
    bus.on('combat:deathblow', (e) => deaths.push(e.victimId));
    player.swingAt(enemy, PLAYER_ATTACKS.deathblow, 1);
    combat.fixedUpdate({ tick: 1 });
    expect(enemy.deathblowed).toBe(false);

    enemy.broken = true;
    player.swingAt(enemy, PLAYER_ATTACKS.deathblow, 2);
    combat.fixedUpdate({ tick: 2 });
    expect(enemy.deathblowed).toBe(true);
    expect(enemy.vitality.dead).toBe(true);
    expect(deaths).toEqual(['enemy']);
  });

  it('nearestOpponent ignora aliados y muertos', () => {
    const { combat, enemy, player } = setup();
    expect(combat.nearestOpponent(player, 10)).toBe(enemy);
    enemy.alive = false;
    expect(combat.nearestOpponent(player, 10)).toBeNull();
  });
});
