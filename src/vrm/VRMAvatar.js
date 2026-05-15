import * as THREE from 'three';
import { resolveExpressionName } from './vrmExpressions.js';

/** Max spring-bone joints simulated per avatar (performance guard). */
export const VRM_SPRING_BONE_LIMIT = 128;

/**
 * @typedef {import('@pixiv/three-vrm').VRM} VRM
 * @typedef {import('../core/AnimationMixerManager.js').AnimationMixerManager} AnimationMixerManager
 */

/**
 * @typedef {{
 *   vrm: VRM,
 *   mixerManager?: AnimationMixerManager,
 *   autoBlink?: boolean,
 *   lookAtTarget?: THREE.Object3D | null,
 *   blinkInterval?: [number, number],
 * }} VRMAvatarOptions
 */

/**
 * PR35 — VRM facial expressions, blinking, look-at, and spring-bone physics.
 */
export class VRMAvatar {
  /**
   * @param {VRMAvatarOptions} options
   */
  constructor(options) {
    this.vrm = options.vrm;
    this.object = options.vrm.scene;
    this.mixerManager = options.mixerManager ?? null;

    this.autoBlink = options.autoBlink ?? true;
    this._blinkEnabled = true;
    this._blinkTimer = 0;
    this._blinkPhase = 0;
    this._blinkInterval = options.blinkInterval ?? [2.5, 5.5];

    /** @type {THREE.Object3D | null} */
    this._lookAtTarget = options.lookAtTarget ?? null;

    /** @type {Map<string, number>} */
    this._expressionWeights = new Map();
    /** @type {{ from: string, to: string, elapsed: number, duration: number } | null} */
    this._expressionFade = null;
    /** @type {{ name: string, elapsed: number, duration: number, returnTo: string } | null} */
    this._expressionPlay = null;

    if (this.vrm.lookAt) {
      this.vrm.lookAt.autoUpdate = true;
      if (this._lookAtTarget) {
        this.vrm.lookAt.target = this._lookAtTarget;
      }
    }

    this._limitSpringBones();
    this._applyExpressionWeights();

    this._springBoost = 1;
    this._savedSpringSettings = [];
    this._transformationExpressionActive = false;
  }

  /**
   * @returns {THREE.Object3D | null}
   */
  getHeadBone() {
    return (
      this.vrm.humanoid?.getNormalizedBoneNode('head') ??
      this.vrm.humanoid?.getRawBoneNode('head') ??
      null
    );
  }

  /**
   * @param {THREE.Object3D | null} target
   */
  setLookAtTarget(target) {
    this._lookAtTarget = target;
    if (this.vrm.lookAt) {
      this.vrm.lookAt.target = target;
      this.vrm.lookAt.autoUpdate = !!target;
    }
  }

  /**
   * @param {boolean} enabled
   */
  setBlink(enabled) {
    this._blinkEnabled = enabled;
    if (!enabled) {
      this.setExpression('blink', 0);
    }
  }

  /**
   * @param {string} name
   * @param {number} value
   */
  setExpression(name, value) {
    const preset = resolveExpressionName(name);
    this._expressionWeights.set(preset, THREE.MathUtils.clamp(value, 0, 1));
    this._applyExpressionWeights();
  }

  /**
   * @param {string} name
   * @param {number} [duration=0.35]
   * @param {string} [returnTo='neutral']
   */
  playExpression(name, duration = 0.35, returnTo = 'neutral') {
    this._expressionPlay = {
      name: resolveExpressionName(name),
      elapsed: 0,
      duration,
      returnTo: resolveExpressionName(returnTo),
    };
  }

  /**
   * @param {string} from
   * @param {string} to
   * @param {number} duration
   */
  crossfadeExpression(from, to, duration = 0.25) {
    this._expressionFade = {
      from: resolveExpressionName(from),
      to: resolveExpressionName(to),
      elapsed: 0,
      duration: Math.max(duration, 0.01),
    };
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.05);

    this._updateBlink(dt);
    this._updateExpressionAnimation(dt);

    this.vrm.update(dt);
  }

  /**
   * AnimationSystem hook — spring bones + expressions (mixer runs separately).
   * @param {number} deltaTime
   */
  updateAnimation(deltaTime) {
    this.update(deltaTime);
  }

  /**
   * Boost spring bone motion during transformations (PR39).
   * @param {number} multiplier
   */
  applyTransformationBoost(multiplier = 1.3) {
    const manager = this.vrm.springBoneManager;
    if (!manager?.joints?.length) return;

    this._springBoost = multiplier;
    this._savedSpringSettings = [];

    const limit = Math.min(manager.joints.length, VRM_SPRING_BONE_LIMIT);
    for (let i = 0; i < limit; i++) {
      const joint = manager.joints[i];
      if (!joint?.settings) continue;
      this._savedSpringSettings.push({
        stiffness: joint.settings.stiffness,
        gravityPower: joint.settings.gravityPower,
      });
      joint.settings.stiffness *= multiplier;
      joint.settings.gravityPower *= multiplier * 0.85;
    }
  }

  clearTransformationBoost() {
    const manager = this.vrm.springBoneManager;
    if (!manager?.joints?.length || !this._savedSpringSettings.length) {
      this._springBoost = 1;
      return;
    }

    const limit = Math.min(manager.joints.length, this._savedSpringSettings.length);
    for (let i = 0; i < limit; i++) {
      const joint = manager.joints[i];
      const saved = this._savedSpringSettings[i];
      if (!joint?.settings || !saved) continue;
      joint.settings.stiffness = saved.stiffness;
      joint.settings.gravityPower = saved.gravityPower;
    }
    this._savedSpringSettings = [];
    this._springBoost = 1;
  }

  /**
   * Stylized transformation face / hair offsets via blendshapes.
   * @param {{ eyeGlow?: number, hairLift?: number, expression?: string }} options
   */
  setTransformationExpressions(options = {}) {
    this._transformationExpressionActive = true;
    if (options.eyeGlow != null) {
      this.setExpression('surprised', options.eyeGlow * 0.4);
      this.setExpression('relaxed', 0);
    }
    if (options.hairLift != null) {
      this.setExpression('happy', options.hairLift * 0.25);
    }
    if (options.expression) {
      this.playExpression(options.expression, 0.8, 'neutral');
    }
  }

  clearTransformationExpressions() {
    if (!this._transformationExpressionActive) return;
    this._transformationExpressionActive = false;
    this.setExpression('surprised', 0);
    this.setExpression('happy', 0);
    this.setExpression('relaxed', 0);
  }

  /**
   * PR43 — baseline expression weights for scanned avatars.
   * @param {{ neutral?: number, happy?: number, relaxed?: number, surprised?: number }} profile
   */
  setScanExpressionProfile(profile) {
    this._scanExpressionProfile = { ...profile };
    for (const [name, weight] of Object.entries(profile)) {
      if (weight != null) {
        this.setExpression(name, weight);
      }
    }
  }

  /**
   * Stylized scan presentation (non-realistic highlights).
   * @param {{ eyeGlow?: number, hairLift?: number }} [options]
   */
  applyScanPresentation(options = {}) {
    if (options.eyeGlow != null) {
      this.setExpression('surprised', options.eyeGlow * 0.35);
    }
    if (options.hairLift != null) {
      this.setExpression('happy', options.hairLift * 0.2);
    }
    this.object.userData.scanPresentation = true;
  }

  dispose() {
    this.clearTransformationBoost();
    this.clearTransformationExpressions();
    this._expressionWeights.clear();
    this._expressionFade = null;
    this._expressionPlay = null;
    if (this.vrm.lookAt) {
      this.vrm.lookAt.target = null;
    }
  }

  _limitSpringBones() {
    const manager = this.vrm.springBoneManager;
    if (!manager?.joints?.length) return;
    if (manager.joints.length <= VRM_SPRING_BONE_LIMIT) return;

    for (let i = VRM_SPRING_BONE_LIMIT; i < manager.joints.length; i++) {
      const joint = manager.joints[i];
      if (joint?.settings) {
        joint.settings.stiffness = 0;
        joint.settings.gravityPower = 0;
      }
    }
  }

  _applyExpressionWeights() {
    const em = this.vrm.expressionManager;
    if (!em) return;

    for (const [name, weight] of this._expressionWeights) {
      em.setValue(name, weight);
    }
    em.update();
  }

  /**
   * @param {number} dt
   */
  _updateBlink(dt) {
    if (!this.autoBlink || !this._blinkEnabled || !this.vrm.expressionManager) return;

    if (this._blinkPhase > 0) {
      this._blinkPhase -= dt;
      const t = THREE.MathUtils.clamp(1 - this._blinkPhase / 0.12, 0, 1);
      const weight = t < 0.5 ? t * 2 : (1 - t) * 2;
      this.setExpression('blink', weight);
      if (this._blinkPhase <= 0) {
        this.setExpression('blink', 0);
      }
      return;
    }

    this._blinkTimer -= dt;
    if (this._blinkTimer <= 0) {
      this._blinkPhase = 0.12;
      const [min, max] = this._blinkInterval;
      this._blinkTimer = min + Math.random() * (max - min);
    }
  }

  /**
   * @param {number} dt
   */
  _updateExpressionAnimation(dt) {
    if (this._expressionFade) {
      const f = this._expressionFade;
      f.elapsed += dt;
      const t = THREE.MathUtils.clamp(f.elapsed / f.duration, 0, 1);
      this.setExpression(f.from, 1 - t);
      this.setExpression(f.to, t);
      if (t >= 1) {
        this._expressionFade = null;
      }
      return;
    }

    if (!this._expressionPlay) return;

    const p = this._expressionPlay;
    p.elapsed += dt;
    const half = p.duration * 0.5;
    let weight = 0;
    if (p.elapsed < half) {
      weight = p.elapsed / half;
    } else if (p.elapsed < p.duration) {
      weight = 1 - (p.elapsed - half) / half;
    }

    this.setExpression(p.name, weight);

    if (p.elapsed >= p.duration) {
      this.setExpression(p.name, 0);
      this.setExpression(p.returnTo, 0);
      this._expressionPlay = null;
    }
  }
}
