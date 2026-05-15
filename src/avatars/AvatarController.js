import * as THREE from 'three';
import { AnimationStateMachine } from '../core/AnimationStateMachine.js';
import { AvatarCustomizer } from './AvatarCustomizer.js';
import { VRMAvatar } from '../vrm/VRMAvatar.js';
import { resolveAnimationClips, HUMANOID_CLIP_PATTERNS } from './clipResolver.js';

const _HEAD_OFFSET = new THREE.Vector3();

const _UP = new THREE.Vector3(0, 1, 0);

/**
 * @typedef {import('../core/InputSystem.js').InputSystem} InputSystem
 * @typedef {import('../core/CameraController.js').CameraController} CameraController
 * @typedef {import('../core/AnimationMixerManager.js').AnimationMixerManager} AnimationMixerManager
 * @typedef {import('../core/ModelManager.js').ModelManager} ModelManager
 * @typedef {import('./AvatarCustomizer.js').AvatarCustomizer} AvatarCustomizer
 * @typedef {import('./AvatarCustomizer.js').AvatarCustomizationConfig} AvatarCustomizationConfig
 * @typedef {import('../vrm/VRMAvatar.js').VRMAvatar} VRMAvatar
 * @typedef {import('../core/AnimationSystem.js').AnimationSystem} AnimationSystem
 * @typedef {import('@pixiv/three-vrm').VRM} VRM
 */

/**
 * @typedef {{
 *   object: THREE.Object3D,
 *   animations?: THREE.AnimationClip[],
 *   inputSystem: InputSystem,
 *   cameraController: CameraController,
 *   mixerManager: AnimationMixerManager,
 *   modelManager?: ModelManager,
 *   animationSystem?: AnimationSystem,
 *   vrm?: VRM,
 *   vrmAvatar?: VRMAvatar,
 *   customization?: AvatarCustomizationConfig,
 *   customizer?: AvatarCustomizer,
 *   clipMap?: Record<string, string>,
 *   walkSpeed?: number,
 *   runSpeed?: number,
 *   turnSpeed?: number,
 *   acceleration?: number,
 *   groundY?: number,
 *   gravity?: number,
 *   jumpForce?: number,
 *   scanSource?: string | null,
 * }} AvatarControllerOptions
 */

/**
 * PR32 — playable avatar with grounded movement and skeletal animation.
 */
export class AvatarController {
  /**
   * @param {AvatarControllerOptions} options
   */
  constructor(options) {
    this.object = options.object;
    this.inputSystem = options.inputSystem;
    this.cameraController = options.cameraController;
    if (!options.mixerManager) {
      throw new Error('AvatarController requires mixerManager');
    }
    this.mixerManager = options.mixerManager;
    this._modelManager = options.modelManager ?? null;
    this._animationSystem = options.animationSystem ?? null;

    /** @type {VRMAvatar | null} */
    this.vrmAvatar =
      options.vrmAvatar ??
      (options.vrm
        ? new VRMAvatar({
            vrm: options.vrm,
            mixerManager: this.mixerManager,
            lookAtTarget: options.cameraController?.camera ?? null,
          })
        : null);

    if (this.vrmAvatar && this._animationSystem) {
      this._animationSystem.registerVRMAvatar(this.vrmAvatar);
    }

    this.walkSpeed = options.walkSpeed ?? 2.2;
    this.runSpeed = options.runSpeed ?? 4.5;
    this.turnSpeed = options.turnSpeed ?? 10;
    this.acceleration = options.acceleration ?? 12;
    this.groundY = options.groundY ?? 0;
    this.gravity = options.gravity ?? 18;
    this.jumpForce = options.jumpForce ?? 5.5;

    this.id = options.object.name || 'avatar';
    this.scanSource = options.scanSource ?? null;
    this.metadata = {
      title: options.scanSource ? 'Scanned Avatar' : 'Avatar',
      type: 'avatar',
      payload: options.scanSource ? { scanUrl: options.scanSource, stylized: true } : null,
    };

    this._horizontalVelocity = new THREE.Vector3();
    this._verticalVelocity = 0;
    this._grounded = true;
    this._isRunning = false;
    this._locomotionState = 'idle';
    this.dialoguePaused = false;
    /** When true, locomotion is handled externally (combat dash/attacks). */
    this.combatPaused = false;
    /** Combat zone: Space triggers dash instead of jump. */
    this.combatMode = false;
    /** Preview pod: idle animation only, no locomotion (PR44). */
    this.inspectMode = false;
    /** @type {import('../combat/CombatController.js').CombatController | null} */
    this.combatController = null;
    /** @type {import('../combat/AuraController.js').AuraController | null} */
    this.auraController = null;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wishDir = new THREE.Vector3();

    const animations = options.animations ?? [];
    const clipNames = animations.map((c) => c.name);
    const resolved =
      options.clipMap ??
      resolveAnimationClips(clipNames, HUMANOID_CLIP_PATTERNS);

    this._clips = resolved;
    this.mixerManager.createMixer(this.object, animations);

    this.stateMachine = new AnimationStateMachine(this.mixerManager, this.object, {
      defaultState: 'idle',
      crossfadeDuration: 0.2,
      states: {
        idle: { clip: resolved.idle, loop: THREE.LoopRepeat },
        walk: { clip: resolved.walk, loop: THREE.LoopRepeat },
        run: { clip: resolved.run, loop: THREE.LoopRepeat, timeScale: 1.05 },
      },
    });
    this.stateMachine.setState('idle', 0);

    /** @type {AvatarCustomizer | null} */
    this.customizer =
      options.customizer ??
      (options.modelManager
        ? new AvatarCustomizer({
            baseObject: this.object,
            modelManager: options.modelManager,
            customization: options.customization,
          })
        : null);

    this._setupInteraction();
  }

  /**
   * @returns {AvatarCustomizer | null}
   */
  /**
   * @returns {VRMAvatar | null}
   */
  getVRMAvatar() {
    return this.vrmAvatar;
  }

  getCustomizer() {
    if (!this.customizer && this._modelManager) {
      this.customizer = new AvatarCustomizer({
        baseObject: this.object,
        modelManager: this._modelManager,
      });
    }
    return this.customizer;
  }

  /**
   * @param {AvatarCustomizationConfig} config
   */
  async applyCustomization(config) {
    const customizer = this.getCustomizer();
    if (!customizer) {
      console.warn('[AvatarController] applyCustomization requires modelManager');
      return;
    }
    await customizer.applyCustomization(config);
  }

  _setupInteraction() {
    let hitMesh = null;
    this.object.traverse((child) => {
      if (child.isMesh && !hitMesh) hitMesh = child;
    });
    if (!hitMesh) return;

    const self = this;
    this._interactive = {
      id: this.id,
      mesh: hitMesh,
      metadata: this.metadata,
      onHoverEnter() {},
      onHoverExit() {},
      onClick() {
        self.triggerEmote();
        self.vrmAvatar?.playExpression('happy', 0.5);
      },
    };
    hitMesh.userData.interactive = this._interactive;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setPosition(x, y, z) {
    this.object.position.set(x, y, z);
  }

  /**
   * @param {number} yaw
   */
  setRotation(yaw) {
    this.object.rotation.y = yaw;
  }

  triggerEmote() {
    const emote = this._clips.emote ?? this._clips.idle;
    if (emote) {
      this.stateMachine.triggerOneShot(emote, {
        returnTo: this._locomotionState,
        fadeIn: 0.12,
      });
    }
    this.vrmAvatar?.playExpression('happy', 0.6);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.05);
    if (this.dialoguePaused || this.combatPaused) {
      this.auraController?.update(deltaTime);
      return;
    }

    if (this.inspectMode) {
      this.auraController?.update(deltaTime);
      this._updateLocomotionAnimation();
      this._updateVRMFollowCamera();
      this._updateVRMLocomotionExpression();
      return;
    }

    this.auraController?.update(deltaTime);
    this._updateMovement(dt);
    this._updateLocomotionAnimation();
    this._updateVRMFollowCamera();
    this._updateVRMLocomotionExpression();
  }

  _updateVRMFollowCamera() {
    if (!this.vrmAvatar || !this.cameraController?.followTarget) return;
    if (this.cameraController.followTarget !== this.object) return;

    const head = this.vrmAvatar.getHeadBone();
    if (!head) return;

    head.getWorldPosition(_HEAD_OFFSET);
    this.cameraController.followLookAtOffset.set(
      0,
      _HEAD_OFFSET.y - this.object.position.y,
      0,
    );
  }

  _updateVRMLocomotionExpression() {
    if (!this.vrmAvatar) return;

    if (this._locomotionState === 'run') {
      this.vrmAvatar.setExpression('relaxed', 0.15);
    } else if (this._locomotionState === 'walk') {
      this.vrmAvatar.setExpression('relaxed', 0.08);
    } else {
      this.vrmAvatar.setExpression('relaxed', 0);
    }
  }

  /**
   * @param {number} dt
   */
  _updateMovement(dt) {
    const input = this.inputSystem;
    const camera = this.cameraController.camera;

    camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    if (this._forward.lengthSq() < 1e-6) {
      this._forward.set(0, 0, -1);
    } else {
      this._forward.normalize();
    }

    this._right.crossVectors(this._forward, _UP).normalize();

    this._wishDir.set(0, 0, 0);
    if (input.isKeyDown('KeyW')) this._wishDir.add(this._forward);
    if (input.isKeyDown('KeyS')) this._wishDir.sub(this._forward);
    if (input.isKeyDown('KeyD')) this._wishDir.add(this._right);
    if (input.isKeyDown('KeyA')) this._wishDir.sub(this._right);

    this._isRunning =
      input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight');

    const hasInput = this._wishDir.lengthSq() > 1e-4;
    const maxSpeed = this._isRunning ? this.runSpeed : this.walkSpeed;

    if (hasInput) {
      this._wishDir.normalize().multiplyScalar(maxSpeed);
    } else {
      this._wishDir.set(0, 0, 0);
    }

    const damp = 1 - Math.exp(-this.acceleration * dt);
    this._horizontalVelocity.lerp(this._wishDir, damp);

    this.object.position.x += this._horizontalVelocity.x * dt;
    this.object.position.z += this._horizontalVelocity.z * dt;

    if (
      !this.combatMode &&
      input.isKeyDown('Space') &&
      this._grounded &&
      this._clips.jump &&
      this._verticalVelocity <= 0.1
    ) {
      this._verticalVelocity = this.jumpForce;
      this._grounded = false;
      this.stateMachine.triggerOneShot(this._clips.jump, {
        returnTo: 'idle',
        fadeIn: 0.08,
      });
    }

    this._verticalVelocity -= this.gravity * dt;
    this.object.position.y += this._verticalVelocity * dt;

    if (this.object.position.y <= this.groundY) {
      this.object.position.y = this.groundY;
      this._verticalVelocity = 0;
      this._grounded = true;
    }

    if (hasInput && this._horizontalVelocity.lengthSq() > 0.05) {
      const targetYaw = Math.atan2(this._horizontalVelocity.x, this._horizontalVelocity.z);
      this.object.rotation.y = this._lerpAngle(
        this.object.rotation.y,
        targetYaw,
        this.turnSpeed * dt,
      );
    } else if (this.cameraController.getFollowYaw) {
      const camYaw = this.cameraController.getFollowYaw();
      this.object.rotation.y = this._lerpAngle(
        this.object.rotation.y,
        camYaw,
        this.turnSpeed * dt * 0.5,
      );
    }
  }

  _updateLocomotionAnimation() {
    const speed = Math.hypot(
      this._horizontalVelocity.x,
      this._horizontalVelocity.z,
    );
    const runThreshold = this.walkSpeed * 0.85;
    const walkThreshold = 0.12;

    let next = 'idle';
    if (speed > runThreshold && this._isRunning) {
      next = 'run';
    } else if (speed > walkThreshold) {
      next = this._isRunning ? 'run' : 'walk';
    }

    if (next !== this._locomotionState) {
      this.stateMachine.setLocomotion(next);
      this._locomotionState = next;
    }
  }

  /**
   * @param {number} current
   * @param {number} target
   * @param {number} t
   */
  _lerpAngle(current, target, t) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return current + delta * Math.min(t, 1);
  }

  dispose() {
    this.auraController?.dispose();
    this.auraController = null;
    if (this.vrmAvatar && this._animationSystem) {
      this._animationSystem.unregisterVRMAvatar(this.vrmAvatar);
    }
    this.vrmAvatar?.dispose();
    this.vrmAvatar = null;
    this.customizer?.dispose();
    this.customizer = null;
    this.stateMachine?.dispose();
    this.mixerManager.removeMixer(this.object);
    if (this._interactive?.mesh) {
      delete this._interactive.mesh.userData.interactive;
    }
  }
}
