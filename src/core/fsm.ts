/**
 * Maquina de estados explicita y PURA (sin Three.js ni Rapier). La usan el jugador
 * y los enemigos: cada estado define enter/update/exit y sus transiciones.
 *
 * Contrato (CLAUDE.md seccion 4):
 * - Las transiciones se evaluan en orden; la primera que se cumple gana.
 * - Un estado puede pedir una transicion desde su update con `machine.requestTransition`.
 * - Se permite encadenar transiciones en el mismo tick hasta `MAX_CHAINED_TRANSITIONS`,
 *   para evitar bucles infinitos por reglas mal escritas.
 */
export const MAX_CHAINED_TRANSITIONS = 4;

export interface Transition<TContext, TId extends string> {
  readonly to: TId;
  /** Condicion evaluada al inicio del tick. */
  when(context: TContext): boolean;
  /** Prioridad informativa: el orden del array es lo que manda. */
  readonly label?: string;
}

export interface State<TContext, TId extends string> {
  readonly id: TId;
  enter?(context: TContext, from: TId | null): void;
  update?(context: TContext): void;
  exit?(context: TContext, to: TId): void;
  readonly transitions?: readonly Transition<TContext, TId>[];
}

export interface StateChange<TId extends string> {
  readonly from: TId | null;
  readonly to: TId;
  readonly tick: number;
}

export class StateMachine<TContext, TId extends string> {
  private readonly states = new Map<TId, State<TContext, TId>>();
  private active: State<TContext, TId>;
  private ticks = 0;
  private pending: TId | null = null;
  private readonly history: StateChange<TId>[] = [];

  constructor(
    states: readonly State<TContext, TId>[],
    initial: TId,
    private readonly context: TContext,
  ) {
    for (const state of states) {
      if (this.states.has(state.id)) {
        throw new Error(`Estado duplicado: ${state.id}`);
      }
      this.states.set(state.id, state);
    }
    const first = this.states.get(initial);
    if (!first) throw new Error(`Estado inicial desconocido: ${initial}`);
    this.active = first;
    this.active.enter?.(this.context, null);
  }

  get current(): TId {
    return this.active.id;
  }

  /** Ticks que lleva el estado actual activo. 0 en el tick en que se entro. */
  get ticksInState(): number {
    return this.ticks;
  }

  /** Ultimos cambios de estado (para el overlay de debug). */
  get lastChanges(): readonly StateChange<TId>[] {
    return this.history;
  }

  is(...ids: readonly TId[]): boolean {
    return ids.includes(this.active.id);
  }

  /** Pide una transicion; se aplica al terminar el update del tick actual. */
  requestTransition(to: TId): void {
    this.pending = to;
  }

  /** Avanza un tick: evalua transiciones, ejecuta el update del estado resultante. */
  update(tick: number): void {
    this.resolveTransitions(tick);
    this.active.update?.(this.context);
    if (this.pending !== null) {
      const to = this.pending;
      this.pending = null;
      this.changeTo(to, tick);
    }
    this.ticks += 1;
  }

  /** Cambia de estado de inmediato, ignorando las condiciones (muerte, reinicio). */
  force(to: TId, tick: number): void {
    this.pending = null;
    this.changeTo(to, tick);
  }

  private resolveTransitions(tick: number): void {
    for (let i = 0; i < MAX_CHAINED_TRANSITIONS; i += 1) {
      const transitions = this.active.transitions;
      if (!transitions) return;
      const match = transitions.find((transition) => transition.when(this.context));
      if (!match || match.to === this.active.id) return;
      this.changeTo(match.to, tick);
    }
  }

  private changeTo(to: TId, tick: number): void {
    const next = this.states.get(to);
    if (!next) throw new Error(`Transicion a un estado desconocido: ${to}`);
    if (next.id === this.active.id) return;
    const from = this.active.id;
    this.active.exit?.(this.context, to);
    this.active = next;
    this.ticks = 0;
    this.history.push({ from, to, tick });
    if (this.history.length > 16) this.history.shift();
    next.enter?.(this.context, from);
  }
}
