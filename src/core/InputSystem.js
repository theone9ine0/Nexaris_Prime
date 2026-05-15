/**
 * @typedef {{
 *   domElement?: HTMLElement | null,
 *   target?: Window | Document | HTMLElement,
 * }} InputSystemOptions
 */

/**
 * @typedef {{
 *   event: KeyboardEvent,
 *   code: string,
 *   key: string,
 * }} KeyEventPayload
 */

/**
 * @typedef {{
 *   event: MouseEvent,
 *   button: number,
 *   position: { x: number, y: number },
 * }} MouseButtonPayload
 */

/**
 * @typedef {{
 *   event: MouseEvent,
 *   position: { x: number, y: number },
 *   delta: { x: number, y: number },
 * }} MouseMovePayload
 */

/**
 * @typedef {{
 *   event: WheelEvent,
 *   deltaX: number,
 *   deltaY: number,
 *   deltaZ: number,
 * }} ScrollPayload
 */

/**
 * @typedef {{
 *   id: string,
 *   index: number,
 *   connected: boolean,
 *   buttons: boolean[],
 *   axes: number[],
 *   timestamp: number,
 * }} GamepadState
 */

/**
 * PR11 — unified keyboard, mouse, and (future) gamepad input.
 */
export class InputSystem {
  /**
   * @param {InputSystemOptions} [options]
   */
  constructor(options = {}) {
    this.domElement = options.domElement ?? null;
    this.target = options.target ?? window;

    this.enabled = true;

    /** @type {Set<string>} */
    this._keysDown = new Set();
    /** @type {Set<number>} */
    this._mouseButtonsDown = new Set();

    this.mousePosition = { x: 0, y: 0 };
    this._lastMousePosition = { x: 0, y: 0 };
    this._mouseDelta = { x: 0, y: 0 };
    this._scrollDelta = { x: 0, y: 0, z: 0 };

    /** @type {Map<number, GamepadState>} */
    this.gamepads = new Map();

    /** @type {Map<string, Set<(payload: unknown) => void>>} */
    this._listeners = new Map();

    /** @type {Array<{ target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions }>} */
    this._bindings = [];

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    this._attachListeners();
  }

  _attachListeners() {
    const mouseTarget = this.domElement ?? this.target;
    this._bind(this.target, 'keydown', this._onKeyDown);
    this._bind(this.target, 'keyup', this._onKeyUp);
    this._bind(this.target, 'blur', this._onBlur);
    this._bind(mouseTarget, 'mousedown', this._onMouseDown);
    this._bind(this.target, 'mouseup', this._onMouseUp);
    this._bind(this.target, 'mousemove', this._onMouseMove);
    this._bind(mouseTarget, 'wheel', this._onWheel, { passive: false });
    if (this.domElement) {
      this._bind(this.domElement, 'contextmenu', this._onContextMenu);
    }
  }

  /**
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListener} fn
   * @param {AddEventListenerOptions} [options]
   */
  _bind(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    this._bindings.push({ target, type, fn, options });
  }

  /**
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clearFrameState();
    }
  }

  /**
   * Clear keys, buttons, and frame deltas (e.g. during scene transitions).
   */
  clearFrameState() {
    this._keysDown.clear();
    this._mouseButtonsDown.clear();
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;
    this._scrollDelta.x = 0;
    this._scrollDelta.y = 0;
    this._scrollDelta.z = 0;
  }

  /**
   * @param {string} key KeyboardEvent.code (e.g. "KeyW", "Space")
   * @returns {boolean}
   */
  isKeyDown(key) {
    return this._keysDown.has(key);
  }

  /**
   * @param {number} button 0 = left, 1 = middle, 2 = right
   * @returns {boolean}
   */
  isMouseDown(button) {
    return this._mouseButtonsDown.has(button);
  }

  /**
   * Movement accumulated since the last `update()`.
   * @returns {{ x: number, y: number }}
   */
  getMouseDelta() {
    return this._mouseDelta;
  }

  /**
   * Scroll accumulated since the last `update()`.
   * @returns {{ x: number, y: number, z: number }}
   */
  getScrollDelta() {
    return this._scrollDelta;
  }

  /**
   * Reset per-frame deltas. Call once per frame after subsystems consume input.
   */
  update() {
    this.pollGamepads();
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;
    this._scrollDelta.x = 0;
    this._scrollDelta.y = 0;
    this._scrollDelta.z = 0;
  }

  /**
   * Poll connected gamepads (scaffolding for future PR).
   */
  pollGamepads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    const connected = new Set();
    const pads = navigator.getGamepads();

    for (const pad of pads) {
      if (!pad) continue;
      connected.add(pad.index);
      this.gamepads.set(pad.index, {
        id: pad.id,
        index: pad.index,
        connected: pad.connected,
        buttons: pad.buttons.map((b) => b.pressed),
        axes: [...pad.axes],
        timestamp: pad.timestamp,
      });
    }

    for (const index of [...this.gamepads.keys()]) {
      if (!connected.has(index)) {
        this.gamepads.delete(index);
      }
    }
  }

  /**
   * @param {number} index
   * @returns {GamepadState | undefined}
   */
  getGamepad(index) {
    return this.gamepads.get(index);
  }

  /**
   * @param {string} eventName
   * @param {(payload: unknown) => void} callback
   */
  on(eventName, callback) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(callback);
  }

  /**
   * @param {string} eventName
   * @param {(payload: unknown) => void} callback
   */
  off(eventName, callback) {
    this._listeners.get(eventName)?.delete(callback);
  }

  /**
   * @param {string} eventName
   * @param {unknown} payload
   */
  emit(eventName, payload) {
    const set = this._listeners.get(eventName);
    if (!set) return;
    for (const cb of set) {
      cb(payload);
    }
  }

  /**
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    if (!this.enabled) return;
    this._keysDown.add(e.code);
    this.emit('keyDown', /** @type {KeyEventPayload} */ ({
      event: e,
      code: e.code,
      key: e.key,
    }));
  }

  /**
   * @param {KeyboardEvent} e
   */
  _onKeyUp(e) {
    this._keysDown.delete(e.code);
    this.emit('keyUp', /** @type {KeyEventPayload} */ ({
      event: e,
      code: e.code,
      key: e.key,
    }));
  }

  /**
   * @param {MouseEvent} e
   */
  _onMouseDown(e) {
    if (!this.enabled) return;
    this._mouseButtonsDown.add(e.button);
    this._updateMousePosition(e);
    this.emit('mouseDown', /** @type {MouseButtonPayload} */ ({
      event: e,
      button: e.button,
      position: { x: this.mousePosition.x, y: this.mousePosition.y },
    }));
  }

  /**
   * @param {MouseEvent} e
   */
  _onMouseUp(e) {
    this._mouseButtonsDown.delete(e.button);
    this._updateMousePosition(e);
    this.emit('mouseUp', /** @type {MouseButtonPayload} */ ({
      event: e,
      button: e.button,
      position: { x: this.mousePosition.x, y: this.mousePosition.y },
    }));
  }

  /**
   * @param {MouseEvent} e
   */
  _onMouseMove(e) {
    if (!this.enabled) return;

    const prevX = this.mousePosition.x;
    const prevY = this.mousePosition.y;
    this._updateMousePosition(e);

    let dx = 0;
    let dy = 0;
    const locked = document.pointerLockElement != null;

    if (locked && (e.movementX !== 0 || e.movementY !== 0)) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (this._mouseButtonsDown.size > 0) {
      dx = this.mousePosition.x - prevX;
      dy = this.mousePosition.y - prevY;
    }

    this._mouseDelta.x += dx;
    this._mouseDelta.y += dy;

    this.emit('mouseMove', /** @type {MouseMovePayload} */ ({
      event: e,
      position: { x: this.mousePosition.x, y: this.mousePosition.y },
      delta: { x: dx, y: dy },
    }));
  }

  /**
   * @param {WheelEvent} e
   */
  _onWheel(e) {
    if (!this.enabled) return;
    if (this.domElement && (e.target === this.domElement || this.domElement.contains(e.target))) {
      e.preventDefault();
    }
    this._scrollDelta.x += e.deltaX;
    this._scrollDelta.y += e.deltaY;
    this._scrollDelta.z += e.deltaZ;
    this.emit('scroll', /** @type {ScrollPayload} */ ({
      event: e,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
    }));
  }

  _onBlur() {
    this.clearFrameState();
  }

  /**
   * @param {MouseEvent} e
   */
  _onContextMenu(e) {
    e.preventDefault();
  }

  /**
   * @param {MouseEvent} e
   */
  _updateMousePosition(e) {
    this._lastMousePosition.x = this.mousePosition.x;
    this._lastMousePosition.y = this.mousePosition.y;
    this.mousePosition.x = e.clientX;
    this.mousePosition.y = e.clientY;
  }

  destroy() {
    for (const { target, type, fn, options } of this._bindings) {
      target.removeEventListener(type, fn, options);
    }
    this._bindings.length = 0;
    this._listeners.clear();
    this.clearFrameState();
    this.gamepads.clear();
    this.enabled = false;
  }
}
