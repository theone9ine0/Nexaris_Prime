import * as THREE from 'three';

/**
 * @typedef {'freefly' | 'orbit'} CameraMode
 */

/**
 * @typedef {{
 *   camera: THREE.PerspectiveCamera,
 *   domElement: HTMLElement,
 *   inputSystem?: InputSystemLike | null,
 *   mode?: CameraMode,
 *   moveSpeed?: number,
 *   lookSpeed?: number,
 *   dampingFactor?: number,
 *   orbitMinDistance?: number,
 *   orbitMaxDistance?: number,
 *   modeBlendDuration?: number,
 * }} CameraControllerOptions
 */

/**
 * Minimal InputSystem surface (PR11) — optional injection.
 * @typedef {{
 *   on: (event: string, handler: (e: Event) => void) => void,
 *   off: (event: string, handler: (e: Event) => void) => void,
 *   isKeyDown?: (code: string) => boolean,
 * }} InputSystemLike
 */

const MODE_FREEFLY = 'freefly';
const MODE_ORBIT = 'orbit';

const PI_2 = Math.PI / 2;
const EPS = 1e-6;

/**
 * PR10 — keyboard + mouse camera traversal (FreeFly and Orbit).
 */
export class CameraController {
  /**
   * @param {CameraControllerOptions} options
   */
  constructor(options) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.inputSystem = options.inputSystem ?? null;

    /** @type {CameraMode} */
    this.mode = options.mode ?? MODE_FREEFLY;
    this.moveSpeed = options.moveSpeed ?? 4;
    this.lookSpeed = options.lookSpeed ?? 0.002;
    this.dampingFactor = options.dampingFactor ?? 10;
    this.orbitMinDistance = options.orbitMinDistance ?? 0.5;
    this.orbitMaxDistance = options.orbitMaxDistance ?? 40;
    this.modeBlendDuration = options.modeBlendDuration ?? 0.35;

    this.enabled = true;
    this._inputActive = true;

    this.orbitTarget = new THREE.Vector3(0, 0, 0);

    this._velocity = new THREE.Vector3();
    this._moveInput = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._keys = new Set();
    this._pointerLocked = false;
    this._lookDelta = { x: 0, y: 0 };

    this._orbitRadius = 4;
    this._orbitTheta = 0;
    this._orbitPhi = PI_2 * 0.5;
    this._orbitDragging = false;
    this._orbitPanning = false;
    this._lastPointer = { x: 0, y: 0 };

    this._modeBlend = 1;
    this._blendFromPos = new THREE.Vector3();
    this._blendFromQuat = new THREE.Quaternion();
    this._blendToPos = new THREE.Vector3();
    this._blendToQuat = new THREE.Quaternion();

    this._scratchV3a = new THREE.Vector3();
    this._scratchV3b = new THREE.Vector3();
    this._scratchQuat = new THREE.Quaternion();

    /** @type {Map<string, (e: Event) => void>} */
    this._handlers = new Map();
    this._useInternalInput = !this.inputSystem;

    if (this._useInternalInput) {
      this._attachInternalInput();
    }
  }

  /**
   * Disable user input during scene transitions or cutscenes.
   * @param {boolean} active
   */
  setInputActive(active) {
    this._inputActive = active;
    if (!active) {
      this._keys.clear();
      this._lookDelta.x = 0;
      this._lookDelta.y = 0;
      this._orbitDragging = false;
      this._orbitPanning = false;
      this._velocity.set(0, 0, 0);
    }
  }

  /**
   * @param {CameraMode} mode
   */
  setMode(mode) {
    if (mode !== MODE_FREEFLY && mode !== MODE_ORBIT) {
      throw new Error(`Unknown camera mode: ${mode}`);
    }
    if (mode === this.mode && this._modeBlend >= 1) return;

    this._syncStateFromCamera();

    this._blendFromPos.copy(this.camera.position);
    this._blendFromQuat.copy(this.camera.quaternion);

    this.mode = mode;
    this._prepareModeState(mode);
    this._computeModePose(mode, this._blendToPos, this._blendToQuat);
    this._modeBlend = 0;
  }

  /**
   * @returns {CameraMode}
   */
  getMode() {
    return this.mode;
  }

  toggleMode() {
    this.setMode(this.mode === MODE_FREEFLY ? MODE_ORBIT : MODE_FREEFLY);
  }

  /**
   * @param {THREE.Vector3} target
   */
  setOrbitTarget(target) {
    this.orbitTarget.copy(target);
    if (this.mode === MODE_ORBIT) {
      this._syncOrbitFromCamera();
    }
  }

  /**
   * Read camera transform into internal freefly / orbit state.
   */
  syncFromCamera() {
    this._syncStateFromCamera();
  }

  /**
   * Apply a scene's default camera pose (e.g. after SceneManager activation).
   * @param {THREE.Vector3} position
   * @param {THREE.Vector3} [lookAt]
   */
  applyScenePose(position, lookAt = new THREE.Vector3(0, 0, 0)) {
    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
    this.syncFromCamera();
    this._velocity.set(0, 0, 0);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.enabled || deltaTime <= 0) return;

    const dt = Math.min(deltaTime, 0.05);

    if (this._modeBlend < 1) {
      this._updateModeBlend(dt);
      return;
    }

    if (!this._inputActive) {
      return;
    }

    if (this.mode === MODE_FREEFLY) {
      this._updateFreeFly(dt);
    } else {
      this._updateOrbit(dt);
    }
  }

  /**
   * @param {number} dt
   */
  _updateModeBlend(dt) {
    this._modeBlend = Math.min(1, this._modeBlend + dt / this.modeBlendDuration);
    const t = this._easeInOutCubic(this._modeBlend);

    this.camera.position.lerpVectors(this._blendFromPos, this._blendToPos, t);
    this.camera.quaternion.slerpQuaternions(this._blendFromQuat, this._blendToQuat, t);

    if (this._modeBlend >= 1) {
      this._syncStateFromCamera();
    }
  }

  /**
   * @param {number} dt
   */
  _updateFreeFly(dt) {
    this._applyLookFreeFly();

    const forward = this._scratchV3a;
    const right = this._scratchV3b;
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < EPS) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }
    right.crossVectors(forward, this.camera.up).normalize();

    this._moveInput.set(0, 0, 0);
    if (this._keys.has('KeyW')) this._moveInput.add(forward);
    if (this._keys.has('KeyS')) this._moveInput.sub(forward);
    if (this._keys.has('KeyD')) this._moveInput.add(right);
    if (this._keys.has('KeyA')) this._moveInput.sub(right);
    if (this._keys.has('Space')) this._moveInput.y += 1;
    if (this._keys.has('ShiftLeft') || this._keys.has('ShiftRight')) {
      this._moveInput.y -= 1;
    }

    const targetSpeed =
      this._moveInput.lengthSq() > 0
        ? this._moveInput.normalize().multiplyScalar(this.moveSpeed)
        : this._scratchV3a.set(0, 0, 0);

    const damp = 1 - Math.exp(-this.dampingFactor * dt);
    this._velocity.lerp(targetSpeed, damp);
    this.camera.position.addScaledVector(this._velocity, dt);
  }

  _applyLookFreeFly() {
    if (this._lookDelta.x === 0 && this._lookDelta.y === 0) return;

    this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._euler.y -= this._lookDelta.x * this.lookSpeed;
    this._euler.x -= this._lookDelta.y * this.lookSpeed;
    this._euler.x = THREE.MathUtils.clamp(this._euler.x, -PI_2 + 0.01, PI_2 - 0.01);
    this.camera.quaternion.setFromEuler(this._euler);

    this._lookDelta.x = 0;
    this._lookDelta.y = 0;
  }

  /**
   * @param {number} dt
   */
  _updateOrbit(dt) {
    const dx = this._lookDelta.x;
    const dy = this._lookDelta.y;
    this._lookDelta.x = 0;
    this._lookDelta.y = 0;

    if (this._orbitDragging) {
      this._orbitTheta -= dx * this.lookSpeed * 2.5;
      this._orbitPhi -= dy * this.lookSpeed * 2.5;
      this._orbitPhi = THREE.MathUtils.clamp(this._orbitPhi, 0.08, Math.PI - 0.08);
    }

    if (this._orbitPanning) {
      const panSpeed = this._orbitRadius * 0.0012;
      const right = this._scratchV3a.setFromMatrixColumn(this.camera.matrix, 0);
      const up = this._scratchV3b.setFromMatrixColumn(this.camera.matrix, 1);
      this.orbitTarget.addScaledVector(right, -dx * panSpeed);
      this.orbitTarget.addScaledVector(up, dy * panSpeed);
    }

    this._applyOrbitPose();
  }

  _applyOrbitPose() {
    const sinPhi = Math.sin(this._orbitPhi);
    const offset = this._scratchV3a.set(
      this._orbitRadius * sinPhi * Math.sin(this._orbitTheta),
      this._orbitRadius * Math.cos(this._orbitPhi),
      this._orbitRadius * sinPhi * Math.cos(this._orbitTheta),
    );
    this.camera.position.copy(this.orbitTarget).add(offset);
    this.camera.lookAt(this.orbitTarget);
  }

  _syncStateFromCamera() {
    this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._velocity.set(0, 0, 0);
    this._syncOrbitFromCamera();
  }

  _syncOrbitFromCamera() {
    const offset = this._scratchV3a.copy(this.camera.position).sub(this.orbitTarget);
    this._orbitRadius = THREE.MathUtils.clamp(
      offset.length(),
      this.orbitMinDistance,
      this.orbitMaxDistance,
    );
    if (this._orbitRadius < EPS) {
      this._orbitRadius = 4;
      return;
    }
    this._orbitPhi = Math.acos(THREE.MathUtils.clamp(offset.y / this._orbitRadius, -1, 1));
    this._orbitTheta = Math.atan2(offset.x, offset.z);
  }

  /**
   * @param {CameraMode} mode
   */
  _prepareModeState(mode) {
    if (mode === MODE_ORBIT) {
      this._syncOrbitFromCamera();
      this._orbitDragging = false;
      this._orbitPanning = false;
    } else {
      this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this._velocity.set(0, 0, 0);
    }
  }

  /**
   * @param {CameraMode} mode
   * @param {THREE.Vector3} outPos
   * @param {THREE.Quaternion} outQuat
   */
  _computeModePose(mode, outPos, outQuat) {
    if (mode === MODE_ORBIT) {
      const sinPhi = Math.sin(this._orbitPhi);
      outPos.set(
        this.orbitTarget.x + this._orbitRadius * sinPhi * Math.sin(this._orbitTheta),
        this.orbitTarget.y + this._orbitRadius * Math.cos(this._orbitPhi),
        this.orbitTarget.z + this._orbitRadius * sinPhi * Math.cos(this._orbitTheta),
      );
      this._scratchQuat.copy(this.camera.quaternion);
      this.camera.position.copy(outPos);
      this.camera.lookAt(this.orbitTarget);
      outQuat.copy(this.camera.quaternion);
      this.camera.quaternion.copy(this._scratchQuat);
    } else {
      outPos.copy(this.camera.position);
      outQuat.setFromEuler(this._euler);
    }
  }

  _attachInternalInput() {
    const onKeyDown = (e) => {
      if (!this._inputActive) return;
      this._keys.add(e.code);
    };
    const onKeyUp = (e) => {
      this._keys.delete(e.code);
    };
    const onBlur = () => {
      this._keys.clear();
      this._orbitDragging = false;
      this._orbitPanning = false;
    };

    const onMouseDown = (e) => {
      if (!this._inputActive || !this.enabled) return;
      this._lastPointer.x = e.clientX;
      this._lastPointer.y = e.clientY;

      if (this.mode === MODE_FREEFLY && e.button === 0) {
        this.domElement.requestPointerLock?.();
      }
      if (this.mode === MODE_ORBIT) {
        if (e.button === 0) this._orbitDragging = true;
        if (e.button === 2) this._orbitPanning = true;
      }
    };

    const onMouseUp = (e) => {
      if (e.button === 0) this._orbitDragging = false;
      if (e.button === 2) this._orbitPanning = false;
    };

    const onMouseMove = (e) => {
      if (!this._inputActive) return;

      if (this.mode === MODE_FREEFLY && document.pointerLockElement === this.domElement) {
        this._lookDelta.x += e.movementX;
        this._lookDelta.y += e.movementY;
        return;
      }

      if (this.mode === MODE_ORBIT && (this._orbitDragging || this._orbitPanning)) {
        const dx = e.clientX - this._lastPointer.x;
        const dy = e.clientY - this._lastPointer.y;
        this._lastPointer.x = e.clientX;
        this._lastPointer.y = e.clientY;
        this._lookDelta.x += dx;
        this._lookDelta.y += dy;
      }
    };

    const onWheel = (e) => {
      if (!this._inputActive || this.mode !== MODE_ORBIT) return;
      e.preventDefault();
      const zoomFactor = 1 + e.deltaY * 0.001;
      this._orbitRadius = THREE.MathUtils.clamp(
        this._orbitRadius * zoomFactor,
        this.orbitMinDistance,
        this.orbitMaxDistance,
      );
      this._applyOrbitPose();
    };

    const onContextMenu = (e) => {
      if (this.mode === MODE_ORBIT) e.preventDefault();
    };

    const onPointerLockChange = () => {
      this._pointerLocked = document.pointerLockElement === this.domElement;
    };

    this._addHandler(window, 'keydown', onKeyDown);
    this._addHandler(window, 'keyup', onKeyUp);
    this._addHandler(window, 'blur', onBlur);
    this._addHandler(this.domElement, 'mousedown', onMouseDown);
    this._addHandler(window, 'mouseup', onMouseUp);
    this._addHandler(window, 'mousemove', onMouseMove);
    this._addHandler(this.domElement, 'wheel', onWheel, { passive: false });
    this._addHandler(this.domElement, 'contextmenu', onContextMenu);
    this._addHandler(document, 'pointerlockchange', onPointerLockChange);
  }

  /**
   * @param {EventTarget} target
   * @param {string} type
   * @param {(e: Event) => void} fn
   * @param {AddEventListenerOptions} [options]
   */
  _addHandler(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    this._handlers.set(`${type}:${fn}`, { target, type, fn, options });
  }

  _removeAllHandlers() {
    for (const { target, type, fn, options } of this._handlers.values()) {
      target.removeEventListener(type, fn, options);
    }
    this._handlers.clear();
  }

  /**
   * @param {number} t
   */
  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  dispose() {
    this._removeAllHandlers();
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
    this._keys.clear();
    this.enabled = false;
  }
}
