import { AnimationMixerManager } from './AnimationMixerManager.js';

/**
 * @typedef {{
 *   updateAnimation: (deltaTime: number) => void,
 * }} Animatable
 */

/**
 * @typedef {{
 *   update: (deltaTime: number) => void,
 * }} VRMUpdatable
 */

/**
 * Central PR4 animation subsystem. Updates registered objects and PR31 mixers.
 */
export class AnimationSystem {
  /**
   * @param {AnimationMixerManager} [mixerManager]
   */
  constructor(mixerManager) {
    this.time = 0;
    this.mixerManager = mixerManager ?? new AnimationMixerManager();
    /** @type {Set<Animatable>} */
    this._objects = new Set();
    /** @type {Set<VRMUpdatable>} */
    this._vrmAvatars = new Set();
  }

  /**
   * Register a VRM avatar for spring-bone / look-at / expression updates.
   * @param {VRMUpdatable} avatar
   */
  registerVRMAvatar(avatar) {
    if (!avatar || typeof avatar.update !== 'function') {
      throw new Error('registerVRMAvatar requires avatar.update(deltaTime)');
    }
    this._vrmAvatars.add(avatar);
  }

  /**
   * @param {VRMUpdatable} avatar
   * @returns {boolean}
   */
  unregisterVRMAvatar(avatar) {
    return this._vrmAvatars.delete(avatar);
  }

  /**
   * @param {Animatable} object
   */
  register(object) {
    if (!object || typeof object.updateAnimation !== 'function') {
      throw new Error('register requires object.updateAnimation(deltaTime)');
    }
    this._objects.add(object);
  }

  /**
   * @param {Animatable} object
   * @returns {boolean}
   */
  unregister(object) {
    return this._objects.delete(object);
  }

  /**
   * @returns {number}
   */
  getCount() {
    return this._objects.size;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.time += deltaTime;
    for (const object of this._objects) {
      object.updateAnimation(deltaTime);
    }
    for (const vrmAvatar of this._vrmAvatars) {
      vrmAvatar.update(deltaTime);
    }
    this.mixerManager.update(deltaTime);
  }

  clear() {
    this._objects.clear();
    this._vrmAvatars.clear();
    this.mixerManager.clear();
  }

  /**
   * @returns {number}
   */
  getTime() {
    return this.time;
  }
}
