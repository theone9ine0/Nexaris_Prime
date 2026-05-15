import * as THREE from 'three';
import { InputSystem } from './InputSystem.js';

/**
 * @typedef {'freefly' | 'orbit' | 'follow'} CameraMode
 */

/**
 * @typedef {{
 *   camera: THREE.PerspectiveCamera,
 *   domElement: HTMLElement,
 *   inputSystem: InputSystem,
 *   mode?: CameraMode,
 *   moveSpeed?: number,
 *   lookSpeed?: number,
 *   dampingFactor?: number,
 *   orbitMinDistance?: number,
 *   orbitMaxDistance?: number,
 *   modeBlendDuration?: number,
 * }} CameraControllerOptions
 */

const MODE_FREEFLY = 'freefly';
const MODE_ORBIT = 'orbit';
const MODE_FOLLOW = 'follow';

const PI_2 = Math.PI / 2;
const EPS = 1e-6;

/**
 * PR10 — keyboard + mouse camera traversal (FreeFly and Orbit).
 * Consumes PR11 InputSystem for all keyboard/mouse state.
 */
export class CameraController {
  /**
   * @param {CameraControllerOptions} options
   */
  constructor(options) {
    if (!options.inputSystem) {
      throw new Error('CameraController requires an InputSystem instance');
    }

    this.camera = options.camera;
    this.domElement = options.domElement;
    this.inputSystem = options.inputSystem;

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

    /** @type {THREE.Object3D | null} */
    this.followTarget = null;
    this.followOffset = new THREE.Vector3(0, 2.2, 4.5);
    this.followLookAtOffset = new THREE.Vector3(0, 1.4, 0);
    this.followSmooth = 10;
    this._followYaw = 0;
    this._followPitch = 0.25;
    this.freeLook = true;

    this._velocity = new THREE.Vector3();
    this._moveInput = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this._orbitRadius = 4;
    this._orbitTheta = 0;
    this._orbitPhi = PI_2 * 0.5;

    this._modeBlend = 1;
    this._blendFromPos = new THREE.Vector3();
    this._blendFromQuat = new THREE.Quaternion();
    this._shakeIntensity = 0;
    this._blendToPos = new THREE.Vector3();
    this._blendToQuat = new THREE.Quaternion();

    this._scratchV3a = new THREE.Vector3();
    this._scratchV3b = new THREE.Vector3();
    this._scratchQuat = new THREE.Quaternion();

    /** @type {(payload: import('./InputSystem.js').MouseButtonPayload) => void} */
    this._handleMouseDown = (payload) => this._onInputMouseDown(payload);
    this._handlePointerLockChange = () => this._onPointerLockChange();

    this.inputSystem.on('mouseDown', this._handleMouseDown);
    document.addEventListener('pointerlockchange', this._handlePointerLockChange);
  }

  /**
   * @param {import('./InputSystem.js').MouseButtonPayload} payload
   */
  _onInputMouseDown(payload) {
    if (!this._inputActive || !this.enabled) return;
    if (payload.event.target !== this.domElement && !this.domElement.contains(payload.event.target)) {
      return;
    }

    if (
      (this.mode === MODE_FREEFLY || this.mode === MODE_FOLLOW) &&
      payload.button === 0
    ) {
      this.domElement.requestPointerLock?.();
    }
  }

  _onPointerLockChange() {
    if (document.pointerLockElement !== this.domElement && this.mode === MODE_FREEFLY) {
      // pointer released — deltas stop via InputSystem
    }
  }

  /**
   * Disable user input during scene transitions or cutscenes.
   * @param {boolean} active
   */
  setInputActive(active) {
    this._inputActive = active;
    if (!active) {
      this.inputSystem.clearFrameState();
      this._velocity.set(0, 0, 0);
    }
  }

  /**
   * @param {CameraMode} mode
   */
  /**
   * @param {THREE.Object3D} target
   * @param {{ offset?: THREE.Vector3, lookAtOffset?: THREE.Vector3 }} [options]
   */
  followTarget(target, options = {}) {
    this.followTarget = target;
    if (options.offset) this.followOffset.copy(options.offset);
    if (options.lookAtOffset) this.followLookAtOffset.copy(options.lookAtOffset);

    const worldPos = this._scratchV3a;
    target.getWorldPosition(worldPos);
    this._followYaw = Math.atan2(
      this.camera.position.x - worldPos.x,
      this.camera.position.z - worldPos.z,
    );

    this.setMode(MODE_FOLLOW);
  }

  clearFollowTarget() {
    this.followTarget = null;
    if (this.mode === MODE_FOLLOW) {
      this.setMode(MODE_FREEFLY);
    }
  }

  /**
   * @returns {number} horizontal camera yaw (radians)
   */
  getFollowYaw() {
    return this._followYaw;
  }

  setMode(mode) {
    if (mode !== MODE_FREEFLY && mode !== MODE_ORBIT && mode !== MODE_FOLLOW) {
      throw new Error(`Unknown camera mode: ${mode}`);
    }
    if (mode === this.mode && this._modeBlend >= 1) return;

    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }

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

  syncFromCamera() {
    this._syncStateFromCamera();
  }

  /**
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
   * Light screen shake for charge / transformation moments (PR39).
   * @param {number} intensity
   */
  addScreenShake(intensity) {
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
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

    if (!this._inputActive) return;

    if (this.mode === MODE_FOLLOW) {
      this._updateFollow(dt);
    } else if (this.mode === MODE_FREEFLY) {
      this._updateFreeFly(dt);
    } else {
      this._updateOrbit(dt);
    }

    if (this._shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this._shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this._shakeIntensity * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * this._shakeIntensity;
      this._shakeIntensity *= 0.88;
    }
  }

  /**
   * @param {number} dt
   */
  _updateFollow(dt) {
    if (!this.followTarget) return;

    if (this.freeLook && document.pointerLockElement === this.domElement) {
      const { x: dx, y: dy } = this.inputSystem.getMouseDelta();
      this._followYaw -= dx * this.lookSpeed * 1.5;
      this._followPitch -= dy * this.lookSpeed;
      this._followPitch = THREE.MathUtils.clamp(this._followPitch, -0.15, 1.1);
    }

    const targetPos = this._scratchV3a;
    this.followTarget.getWorldPosition(targetPos);

    const offset = this._scratchV3b
      .copy(this.followOffset)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this._followYaw);

    const desiredPos = targetPos.clone().add(offset);
    const smooth = 1 - Math.exp(-this.followSmooth * dt);
    this.camera.position.lerp(desiredPos, smooth);

    const lookAt = targetPos.clone().add(this.followLookAtOffset);
    this.camera.lookAt(lookAt);
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

    const input = this.inputSystem;
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
    if (input.isKeyDown('KeyW')) this._moveInput.add(forward);
    if (input.isKeyDown('KeyS')) this._moveInput.sub(forward);
    if (input.isKeyDown('KeyD')) this._moveInput.add(right);
    if (input.isKeyDown('KeyA')) this._moveInput.sub(right);
    if (input.isKeyDown('Space')) this._moveInput.y += 1;
    if (input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')) {
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
    if (document.pointerLockElement !== this.domElement) return;

    const { x: dx, y: dy } = this.inputSystem.getMouseDelta();
    if (dx === 0 && dy === 0) return;

    this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._euler.y -= dx * this.lookSpeed;
    this._euler.x -= dy * this.lookSpeed;
    this._euler.x = THREE.MathUtils.clamp(this._euler.x, -PI_2 + 0.01, PI_2 - 0.01);
    this.camera.quaternion.setFromEuler(this._euler);
  }

  /**
   * @param {number} dt
   */
  _updateOrbit(dt) {
    const input = this.inputSystem;
    const { x: dx, y: dy } = input.getMouseDelta();
    const dragging = input.isMouseDown(0);
    const panning = input.isMouseDown(2);

    if (dragging) {
      this._orbitTheta -= dx * this.lookSpeed * 2.5;
      this._orbitPhi -= dy * this.lookSpeed * 2.5;
      this._orbitPhi = THREE.MathUtils.clamp(this._orbitPhi, 0.08, Math.PI - 0.08);
    }

    if (panning) {
      const panSpeed = this._orbitRadius * 0.0012;
      const right = this._scratchV3a.setFromMatrixColumn(this.camera.matrix, 0);
      const up = this._scratchV3b.setFromMatrixColumn(this.camera.matrix, 1);
      this.orbitTarget.addScaledVector(right, -dx * panSpeed);
      this.orbitTarget.addScaledVector(up, dy * panSpeed);
    }

    const scrollY = input.getScrollDelta().y;
    if (scrollY !== 0) {
      const zoomFactor = 1 + scrollY * 0.001;
      this._orbitRadius = THREE.MathUtils.clamp(
        this._orbitRadius * zoomFactor,
        this.orbitMinDistance,
        this.orbitMaxDistance,
      );
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
    } else if (mode === MODE_FOLLOW) {
      this._velocity.set(0, 0, 0);
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

  /**
   * @param {number} t
   */
  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  dispose() {
    this.inputSystem.off('mouseDown', this._handleMouseDown);
    document.removeEventListener('pointerlockchange', this._handlePointerLockChange);
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
    this.enabled = false;
  }
}
