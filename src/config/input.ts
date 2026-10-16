/** Acciones del juego. El mapeo a teclas/botones es configurable. */
export type ActionId =
  'attack' | 'guard' | 'jump' | 'dodge' | 'sprint' | 'lockOn' | 'grapple' | 'interact' | 'crouch';

export const ALL_ACTIONS: readonly ActionId[] = [
  'attack',
  'guard',
  'jump',
  'dodge',
  'sprint',
  'lockOn',
  'grapple',
  'interact',
  'crouch',
];

export interface InputConfig {
  /** Ticks que un input presionado sobrevive esperando poder ejecutarse. */
  bufferTicks: number;
  /** Teclas (KeyboardEvent.code) por accion. */
  keyBindings: Record<ActionId, readonly string[]>;
  /** Botones del raton (MouseEvent.button) por accion. */
  mouseBindings: Record<ActionId, readonly number[]>;
  /** Botones de gamepad (indice del mapeo estandar) por accion. */
  gamepadBindings: Record<ActionId, readonly number[]>;
  /** Ejes del stick izquierdo / derecho en el mapeo estandar. */
  gamepadAxes: { moveX: number; moveY: number; lookX: number; lookY: number };
  /** Zona muerta de los sticks. */
  stickDeadzone: number;
  moveKeys: { forward: string[]; back: string[]; left: string[]; right: string[] };
}

export const inputConfig: InputConfig = {
  bufferTicks: 9,
  keyBindings: {
    attack: [],
    guard: [],
    jump: ['Space'],
    dodge: ['ShiftLeft', 'ShiftRight'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    lockOn: ['KeyQ'],
    grapple: ['KeyE'],
    interact: ['KeyF'],
    crouch: ['ControlLeft', 'ControlRight'],
  },
  mouseBindings: {
    attack: [0],
    guard: [2],
    jump: [],
    dodge: [],
    sprint: [],
    lockOn: [],
    grapple: [],
    interact: [],
    crouch: [],
  },
  // Mapeo estandar: 0=A/X, 1=B/O, 2=X/[], 3=Y/T, 4=LB, 5=RB, 6=LT, 7=RT, 10=L3, 11=R3
  gamepadBindings: {
    attack: [2],
    guard: [7],
    jump: [0],
    dodge: [1],
    sprint: [1],
    lockOn: [10],
    grapple: [3],
    interact: [3],
    crouch: [11],
  },
  gamepadAxes: { moveX: 0, moveY: 1, lookX: 2, lookY: 3 },
  stickDeadzone: 0.18,
  moveKeys: {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  },
};
