import type { ActionId, InputConfig } from '@/config/input';
import { ALL_ACTIONS, inputConfig } from '@/config/input';
import type { FixedUpdateSystem, TickContext } from '@/core/loop';

/**
 * Buffer de inputs (CLAUDE.md 5.8): una accion pulsada durante la recuperacion de otra
 * se ejecuta en cuanto el estado lo permite, dentro de una ventana de N ticks.
 *
 * Pieza PURA y testeable: no toca el DOM.
 */
export class InputBuffer {
  private readonly pressedAt = new Map<ActionId, number>();

  constructor(private windowTicks: number = inputConfig.bufferTicks) {}

  setWindow(ticks: number): void {
    this.windowTicks = ticks;
  }

  /** Registra una pulsacion en el tick dado. Una pulsacion nueva pisa a la anterior. */
  press(action: ActionId, tick: number): void {
    this.pressedAt.set(action, tick);
  }

  /** ¿Hay una pulsacion viva? No la consume. */
  peek(action: ActionId, tick: number): boolean {
    const at = this.pressedAt.get(action);
    if (at === undefined) return false;
    if (tick - at > this.windowTicks) {
      this.pressedAt.delete(action);
      return false;
    }
    return true;
  }

  /** ¿Hay una pulsacion viva? La consume (solo se ejecuta una vez). */
  consume(action: ActionId, tick: number): boolean {
    const alive = this.peek(action, tick);
    if (alive) this.pressedAt.delete(action);
    return alive;
  }

  /** Edad en ticks de la pulsacion pendiente, o null si no hay. */
  ageOf(action: ActionId, tick: number): number | null {
    const at = this.pressedAt.get(action);
    if (at === undefined) return null;
    return tick - at;
  }

  clear(action?: ActionId): void {
    if (action) this.pressedAt.delete(action);
    else this.pressedAt.clear();
  }
}

/** Estado del input tal y como lo ve la simulacion en un tick. */
export interface InputState {
  /** Direccion de movimiento en espacio de camara, normalizada. x = lateral, y = adelante. */
  readonly moveX: number;
  readonly moveY: number;
  /** Magnitud del stick (0..1). Con teclado siempre es 0 o 1. */
  readonly moveMagnitude: number;
  /** Delta de raton acumulado desde el tick anterior, en PIXELES (sin sensibilidad). */
  readonly lookDeltaX: number;
  readonly lookDeltaY: number;
  /** Stick derecho, en [-1, 1]. La sensibilidad la aplica la camara. */
  readonly lookStickX: number;
  readonly lookStickY: number;
  /** Acciones mantenidas en este tick. */
  held(action: ActionId): boolean;
  /** Ticks que lleva mantenida la accion (0 si no esta mantenida). */
  heldTicks(action: ActionId): number;
  /** Pulsada exactamente en este tick. */
  pressed(action: ActionId): boolean;
  /** Soltada exactamente en este tick. */
  released(action: ActionId): boolean;
  readonly buffer: InputBuffer;
}

/**
 * Recoge teclado, raton y gamepad y los convierte en un `InputState` por tick.
 * Los eventos del DOM solo acumulan; la simulacion lee una foto estable en cada tick.
 */
export class InputManager implements FixedUpdateSystem, InputState {
  readonly buffer: InputBuffer;

  moveX = 0;
  moveY = 0;
  moveMagnitude = 0;
  lookDeltaX = 0;
  lookDeltaY = 0;
  lookStickX = 0;
  lookStickY = 0;

  private readonly heldNow = new Set<ActionId>();
  private readonly heldPrev = new Set<ActionId>();
  private readonly heldSince = new Map<ActionId, number>();
  private readonly keysDown = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private pendingLookX = 0;
  private pendingLookY = 0;
  private pointerLocked = false;
  private gamepadIndex: number | null = null;
  private readonly listeners: (() => void)[] = [];

  constructor(
    private readonly element: HTMLElement,
    private readonly config: InputConfig = inputConfig,
  ) {
    this.buffer = new InputBuffer(config.bufferTicks);
    this.bindDom();
  }

  held(action: ActionId): boolean {
    return this.heldNow.has(action);
  }

  heldTicks(action: ActionId): number {
    const since = this.heldSince.get(action);
    return since === undefined ? 0 : since;
  }

  pressed(action: ActionId): boolean {
    return this.heldNow.has(action) && !this.heldPrev.has(action);
  }

  released(action: ActionId): boolean {
    return !this.heldNow.has(action) && this.heldPrev.has(action);
  }

  get hasPointerLock(): boolean {
    return this.pointerLocked;
  }

  fixedUpdate(ctx: TickContext): void {
    this.heldPrev.clear();
    for (const action of this.heldNow) this.heldPrev.add(action);
    this.heldNow.clear();

    const pad = this.pollGamepad();
    this.collectHeldActions(pad);
    this.collectMovement(pad);
    this.collectLook(pad);

    for (const action of ALL_ACTIONS) {
      if (!this.heldNow.has(action)) {
        this.heldSince.delete(action);
        continue;
      }
      if (this.heldPrev.has(action)) {
        this.heldSince.set(action, (this.heldSince.get(action) ?? 0) + 1);
      } else {
        this.heldSince.set(action, 0);
        this.buffer.press(action, ctx.tick);
      }
    }

    this.buffer.setWindow(this.config.bufferTicks);
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }

  private collectHeldActions(pad: Gamepad | null): void {
    for (const action of ALL_ACTIONS) {
      const byKey = this.config.keyBindings[action].some((code) => this.keysDown.has(code));
      const byMouse = this.config.mouseBindings[action].some((button) =>
        this.mouseDown.has(button),
      );
      const byPad =
        pad !== null &&
        this.config.gamepadBindings[action].some((index) => pad.buttons[index]?.pressed === true);
      if (byKey || byMouse || byPad) this.heldNow.add(action);
    }
  }

  private collectMovement(pad: Gamepad | null): void {
    const keys = this.config.moveKeys;
    let x = 0;
    let y = 0;
    if (keys.right.some((code) => this.keysDown.has(code))) x += 1;
    if (keys.left.some((code) => this.keysDown.has(code))) x -= 1;
    if (keys.forward.some((code) => this.keysDown.has(code))) y += 1;
    if (keys.back.some((code) => this.keysDown.has(code))) y -= 1;

    if (pad) {
      const padX = applyDeadzone(
        pad.axes[this.config.gamepadAxes.moveX] ?? 0,
        this.config.stickDeadzone,
      );
      const padY = -applyDeadzone(
        pad.axes[this.config.gamepadAxes.moveY] ?? 0,
        this.config.stickDeadzone,
      );
      if (Math.abs(padX) > 0 || Math.abs(padY) > 0) {
        x = padX;
        y = padY;
      }
    }

    const length = Math.hypot(x, y);
    if (length > 1e-4) {
      this.moveX = x / length;
      this.moveY = y / length;
      this.moveMagnitude = Math.min(length, 1);
    } else {
      this.moveX = 0;
      this.moveY = 0;
      this.moveMagnitude = 0;
    }
  }

  private collectLook(pad: Gamepad | null): void {
    this.lookDeltaX = this.pendingLookX;
    this.lookDeltaY = this.pendingLookY;
    this.pendingLookX = 0;
    this.pendingLookY = 0;

    const deadzone = this.config.stickDeadzone;
    this.lookStickX = pad
      ? applyDeadzone(pad.axes[this.config.gamepadAxes.lookX] ?? 0, deadzone)
      : 0;
    this.lookStickY = pad
      ? applyDeadzone(pad.axes[this.config.gamepadAxes.lookY] ?? 0, deadzone)
      : 0;
  }

  private pollGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.gamepadIndex !== null) {
      const pad = pads[this.gamepadIndex];
      if (pad?.connected === true) return pad;
      this.gamepadIndex = null;
    }
    for (const pad of pads) {
      if (pad?.connected === true) {
        this.gamepadIndex = pad.index;
        return pad;
      }
    }
    return null;
  }

  private bindDom(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      this.keysDown.add(event.code);
      if (event.code === 'Space') event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      this.keysDown.delete(event.code);
    };
    const onMouseDown = (event: MouseEvent): void => {
      this.mouseDown.add(event.button);
    };
    const onMouseUp = (event: MouseEvent): void => {
      this.mouseDown.delete(event.button);
    };
    const onMouseMove = (event: MouseEvent): void => {
      if (!this.pointerLocked) return;
      this.pendingLookX += event.movementX;
      this.pendingLookY += event.movementY;
    };
    const onContextMenu = (event: Event): void => {
      event.preventDefault();
    };
    const onPointerLockChange = (): void => {
      this.pointerLocked = document.pointerLockElement === this.element;
      if (!this.pointerLocked) {
        this.keysDown.clear();
        this.mouseDown.clear();
      }
    };
    const onCanvasClick = (): void => {
      if (!this.pointerLocked) void this.element.requestPointerLock();
    };
    const onBlur = (): void => {
      this.keysDown.clear();
      this.mouseDown.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    this.element.addEventListener('contextmenu', onContextMenu);
    this.element.addEventListener('click', onCanvasClick);

    this.listeners.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('blur', onBlur),
      () => document.removeEventListener('pointerlockchange', onPointerLockChange),
      () => this.element.removeEventListener('contextmenu', onContextMenu),
      () => this.element.removeEventListener('click', onCanvasClick),
    );
  }
}

export function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) <= deadzone) return 0;
  const sign = Math.sign(value);
  return sign * ((Math.abs(value) - deadzone) / (1 - deadzone));
}
