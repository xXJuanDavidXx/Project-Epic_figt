/**
 * Bus de eventos tipado. Desacopla logica (combat, entities) de presentacion
 * (vfx, audio, ui): la logica emite, la presentacion escucha.
 *
 * El mapa de eventos del juego vive en `src/core/eventMap.ts` y crece por milestone.
 */
export type EventMap = object;

export type Listener<T> = (payload: T) => void;

export type Unsubscribe = () => void;

export class EventBus<TEvents extends EventMap> {
  private readonly listeners = new Map<keyof TEvents, Set<(payload: never) => void>>();

  on<K extends keyof TEvents>(type: K, listener: Listener<TEvents[K]>): Unsubscribe {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => {
      this.off(type, listener);
    };
  }

  once<K extends keyof TEvents>(type: K, listener: Listener<TEvents[K]>): Unsubscribe {
    const unsubscribe = this.on(type, (payload) => {
      unsubscribe();
      listener(payload);
    });
    return unsubscribe;
  }

  off<K extends keyof TEvents>(type: K, listener: Listener<TEvents[K]>): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  emit<K extends keyof TEvents>(type: K, payload: TEvents[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copia defensiva: un listener puede desuscribirse (o suscribir) durante el emit.
    for (const listener of [...set]) {
      (listener as Listener<TEvents[K]>)(payload);
    }
  }

  listenerCount<K extends keyof TEvents>(type: K): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
