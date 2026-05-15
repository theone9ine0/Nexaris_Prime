import * as THREE from 'three';
import { AnimationStateMachine } from '../core/AnimationStateMachine.js';
import { AvatarCustomizer } from '../avatars/AvatarCustomizer.js';
import { VRMAvatar } from '../vrm/VRMAvatar.js';
import {
  resolveAnimationClips,
  HUMANOID_CLIP_PATTERNS,
} from '../avatars/clipResolver.js';

const _UP = new THREE.Vector3(0, 1, 0);

/** @typedef {'idle' | 'wander' | 'followPlayer' | 'interact' | 'dialogue'} NPCState */

/**
 * @typedef {import('../core/AnimationMixerManager.js').AnimationMixerManager} AnimationMixerManager
 * @typedef {import('../core/ModelManager.js').ModelManager} ModelManager
 * @typedef {import('../avatars/AvatarCustomizer.js').AvatarCustomizer} AvatarCustomizer
 * @typedef {import('../avatars/AvatarCustomizer.js').AvatarCustomizationConfig} AvatarCustomizationConfig
 * @typedef {import('../vrm/VRMAvatar.js').VRMAvatar} VRMAvatar
 * @typedef {import('../core/AnimationSystem.js').AnimationSystem} AnimationSystem
 * @typedef {import('@pixiv/three-vrm').VRM} VRM
 * @typedef {import('../dialogue/DialogueManager.js').DialogueManager} DialogueManager
 */

/**
 * @typedef {{
 *   object: THREE.Object3D,
 *   animations?: THREE.AnimationClip[],
 *   mixerManager: AnimationMixerManager,
 *   modelManager?: ModelManager,
 *   animationSystem?: AnimationSystem,
 *   vrm?: VRM,
 *   vrmAvatar?: VRMAvatar,
 *   lookAtTarget?: THREE.Object3D | null,
 *   customization?: AvatarCustomizationConfig,
 *   customizer?: AvatarCustomizer,
 *   id?: string,
 *   clipMap?: Record<string, string>,
 *   walkSpeed?: number,
 *   runSpeed?: number,
 *   turnSpeed?: number,
 *   groundY?: number,
 *   wanderRadius?: number,
 *   followDistance?: number,
 *   followStopDistance?: number,
 *   initialState?: NPCState,
 *   dialogueId?: string,
 *   dialogueManager?: DialogueManager,
 *   speakerName?: string,
 *   onInteract?: () => void,
 * }} NPCOptions
 */

/**
 * PR33 — animated NPC with lightweight idle / wander / follow / interact AI.
 */
export class NPC {
  /**
   * @param {NPCOptions} options
   */
  constructor(options) {
    if (!options.mixerManager) {
      throw new Error('NPC requires mixerManager');
    }

    this.object = options.object;
    this.mixerManager = options.mixerManager;
    this._modelManager = options.modelManager ?? null;
    this._animationSystem = options.animationSystem ?? null;
    this.id = options.id ?? options.object.name ?? `npc_${Date.now()}`;
    this.object.name = this.id;

    this.walkSpeed = options.walkSpeed ?? 1.4;
    this.runSpeed = options.runSpeed ?? 2.8;
    this.turnSpeed = options.turnSpeed ?? 8;
    this.groundY = options.groundY ?? 0;
    this.wanderRadius = options.wanderRadius ?? 5;
    this.followDistance = options.followDistance ?? 3.5;
    this.followStopDistance = options.followStopDistance ?? 1.8;

    this.onInteract = options.onInteract ?? null;
    this.dialogueId = options.dialogueId ?? null;
    this.dialogueManager = options.dialogueManager ?? null;
    this.speakerName = options.speakerName ?? this.id;

    /** @type {NPCState} */
    this.state = options.initialState ?? 'idle';
    /** @type {NPCState | null} */
    this._preDialogueState = null;
    /** @type {THREE.Object3D | null} */
    this.target = null;

    this.metadata = {
      title: options.speakerName ?? this.id,
      type: 'npc',
      payload: { dialogueId: this.dialogueId },
    };

    this._wanderOrigin = this.object.position.clone();
    this._wanderTarget = new THREE.Vector3();
    this._velocity = new THREE.Vector3();
    this._locomotionState = 'idle';
    this._wantsWander = this.state === 'wander';
    this._idleUntil = 0;
    this._lookPhase = Math.random() * Math.PI * 2;
    this._arriveThreshold = 0.35;

    const animations = options.animations ?? [];
    const clipNames = animations.map((c) => c.name);
    this._clips =
      options.clipMap ?? resolveAnimationClips(clipNames, HUMANOID_CLIP_PATTERNS);

    this.mixerManager.createMixer(this.object, animations);
    this.stateMachine = new AnimationStateMachine(this.mixerManager, this.object, {
      defaultState: 'idle',
      crossfadeDuration: 0.25,
      states: {
        idle: { clip: this._clips.idle, loop: THREE.LoopRepeat },
        walk: { clip: this._clips.walk, loop: THREE.LoopRepeat },
        run: { clip: this._clips.run, loop: THREE.LoopRepeat, timeScale: 1 },
      },
    });
    this.stateMachine.setState('idle', 0);

    if (this.state === 'wander') {
      this._pickWanderPoint();
    }

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

    /** @type {VRMAvatar | null} */
    this.vrmAvatar =
      options.vrmAvatar ??
      (options.vrm
        ? new VRMAvatar({
            vrm: options.vrm,
            mixerManager: this.mixerManager,
            lookAtTarget: options.lookAtTarget ?? null,
          })
        : null);

    if (this.vrmAvatar && this._animationSystem) {
      this._animationSystem.registerVRMAvatar(this.vrmAvatar);
    }

    this._savedLookAtTarget = options.lookAtTarget ?? null;

    this._setupInteraction();
  }

  /**
   * @returns {VRMAvatar | null}
   */
  getVRMAvatar() {
    return this.vrmAvatar;
  }

  /**
   * @param {string} name
   * @param {number} [duration]
   */
  playExpression(name, duration = 0.4) {
    this.vrmAvatar?.playExpression(name, duration);
  }

  /**
   * @returns {AvatarCustomizer | null}
   */
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
    if (!customizer) return;
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
        self.triggerInteract();
      },
    };
    hitMesh.userData.interactive = this._interactive;
  }

  /**
   * @param {NPCState} stateName
   */
  setState(stateName) {
    this.state = stateName;
    if (stateName === 'wander') {
      this._wantsWander = true;
      this._wanderOrigin.copy(this.object.position);
      this._pickWanderPoint();
    }
    if (stateName === 'idle') {
      this._wantsWander = false;
      this._velocity.set(0, 0, 0);
    }
    if (stateName === 'followPlayer') {
      this._velocity.set(0, 0, 0);
    }
  }

  /**
   * @param {THREE.Object3D | null} object3D
   */
  setTarget(object3D) {
    this.target = object3D;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setPosition(x, y, z) {
    this.object.position.set(x, y, z);
    if (this.state === 'wander') {
      this._wanderOrigin.copy(this.object.position);
    }
  }

  /**
   * @param {THREE.Object3D | null} playerObject
   */
  enterDialogue(playerObject) {
    this._preDialogueState = this.state;
    this.state = 'dialogue';
    this._velocity.set(0, 0, 0);
    this._wantsWander = false;

    if (playerObject) {
      this.vrmAvatar?.setLookAtTarget(playerObject);
      const dir = this._scratchDir();
      playerObject.getWorldPosition(dir);
      dir.sub(this.object.position);
      dir.y = 0;
      if (dir.lengthSq() > 1e-4) {
        this.object.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }
  }

  exitDialogue() {
    const restore = this._preDialogueState ?? 'idle';
    this._preDialogueState = null;
    this.setState(restore);
    this.vrmAvatar?.setLookAtTarget(this._savedLookAtTarget ?? null);
  }

  playDialogueEmote() {
    const emote = this._clips.emote ?? this._clips.idle;
    if (emote) {
      this.stateMachine.triggerOneShot(emote, {
        returnTo: 'idle',
        fadeIn: 0.12,
      });
    }
  }

  triggerInteract() {
    if (this.dialogueId && this.dialogueManager) {
      if (this.dialogueManager.isActive) {
        this.dialogueManager.next();
        return;
      }
      this.dialogueManager.startDialogue(this, this.dialogueId);
      this.onInteract?.();
      return;
    }

    const emote = this._clips.emote ?? this._clips.idle;
    if (!emote) return;

    const prevState = this.state;
    this.state = 'interact';
    this._velocity.set(0, 0, 0);

    this.stateMachine.triggerOneShot(emote, {
      returnTo: 'idle',
      fadeIn: 0.15,
    });

    this.onInteract?.();
    this.vrmAvatar?.playExpression('happy', 0.55);

    this._interactFinishUnsub?.();
    this._interactFinishUnsub = this.mixerManager.onFinished(this.object, (event) => {
      if (event.action?.getClip()?.name !== emote) return;
      this._interactFinishUnsub?.();
      this._interactFinishUnsub = null;
      if (prevState === 'wander' || prevState === 'followPlayer') {
        this.setState(prevState);
      } else {
        this.setState('idle');
      }
    });
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.05);

    switch (this.state) {
      case 'idle':
        this._updateIdle(dt);
        break;
      case 'wander':
        this._updateWander(dt);
        break;
      case 'followPlayer':
        this._updateFollowPlayer(dt);
        break;
      case 'interact':
      case 'dialogue':
        this._velocity.lerp(new THREE.Vector3(), 1 - Math.exp(-10 * dt));
        break;
      default:
        break;
    }

    this.object.position.y = this.groundY;
    this._updateLocomotionAnimation();
  }

  /**
   * @param {number} dt
   */
  _updateIdle(dt) {
    this._velocity.lerp(new THREE.Vector3(), 1 - Math.exp(-10 * dt));
    this._lookAround(dt);

    if (this._wantsWander && performance.now() * 0.001 >= this._idleUntil) {
      this.state = 'wander';
      this._pickWanderPoint();
    }
  }

  /**
   * @param {number} dt
   */
  _updateWander(dt) {
    const dist = this.object.position.distanceTo(this._wanderTarget);
    if (dist < this._arriveThreshold) {
      this.state = 'idle';
      this._idleUntil = performance.now() * 0.001 + 1.2 + Math.random() * 2.5;
      this._wantsWander = true;
      this._velocity.set(0, 0, 0);
      return;
    }

    this._steerToward(this._wanderTarget, this.walkSpeed, dt);
  }

  /**
   * @param {number} dt
   */
  _updateFollowPlayer(dt) {
    if (!this.target) {
      this.setState('idle');
      return;
    }

    const targetPos = this._scratchPos();
    this.target.getWorldPosition(targetPos);

    const offset = this._scratchDir();
    offset.subVectors(targetPos, this.object.position);
    offset.y = 0;
    const dist = offset.length();

    if (dist > this.followStopDistance) {
      this._steerToward(targetPos, this.walkSpeed, dt);
    } else {
      this._velocity.lerp(new THREE.Vector3(), 1 - Math.exp(-8 * dt));
      if (dist > 0.05) {
        const yaw = Math.atan2(offset.x, offset.z);
        this.object.rotation.y = this._lerpAngle(this.object.rotation.y, yaw, this.turnSpeed * dt);
      }
    }
  }

  _lookAround(dt) {
    this._lookPhase += dt * 0.4;
    const sway = Math.sin(this._lookPhase) * 0.08;
    this.object.rotation.y += sway * dt;
  }

  _pickWanderPoint() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.wanderRadius;
    this._wanderTarget.set(
      this._wanderOrigin.x + Math.cos(angle) * radius,
      this.groundY,
      this._wanderOrigin.z + Math.sin(angle) * radius,
    );
  }

  /**
   * @param {THREE.Vector3} target
   * @param {number} speed
   * @param {number} dt
   */
  _steerToward(target, speed, dt) {
    const dir = this._scratchDir();
    dir.subVectors(target, this.object.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 1e-4) {
      this._velocity.set(0, 0, 0);
      return;
    }

    dir.normalize();
    const desired = dir.multiplyScalar(speed);
    const damp = 1 - Math.exp(-8 * dt);
    this._velocity.lerp(desired, damp);

    this.object.position.x += this._velocity.x * dt;
    this.object.position.z += this._velocity.z * dt;

    const yaw = Math.atan2(this._velocity.x, this._velocity.z);
    this.object.rotation.y = this._lerpAngle(
      this.object.rotation.y,
      yaw,
      this.turnSpeed * dt,
    );
  }

  _updateLocomotionAnimation() {
    const speed = Math.hypot(this._velocity.x, this._velocity.z);
    let next = 'idle';
    if (speed > 0.15) {
      next = speed > this.walkSpeed * 0.85 ? 'run' : 'walk';
    }

    if (this.state === 'interact' || this.state === 'dialogue') {
      return;
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

  _scratchPos() {
    if (!this._pos) this._pos = new THREE.Vector3();
    return this._pos;
  }

  _scratchDir() {
    if (!this._dir) this._dir = new THREE.Vector3();
    return this._dir;
  }

  dispose() {
    if (this.vrmAvatar && this._animationSystem) {
      this._animationSystem.unregisterVRMAvatar(this.vrmAvatar);
    }
    this.vrmAvatar?.dispose();
    this.vrmAvatar = null;
    this.customizer?.dispose();
    this.customizer = null;
    this._interactFinishUnsub?.();
    this._interactFinishUnsub = null;
    this.stateMachine?.dispose();
    this.mixerManager.removeMixer(this.object);
    if (this._interactive?.mesh) {
      delete this._interactive.mesh.userData.interactive;
    }
  }
}
