import { AnimationMixerManager } from './AnimationMixerManager.js';

/**
 * @typedef {{
 *   updateAnimation: (deltaTime: number) => void,
 * }} Animatable
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
    this.mixerManager.update(deltaTime);
  }

  clear() {
    this._objects.clear();
    this.mixerManager.clear();
  }

  /**
   * @returns {number}
   */
  getTime() {
    return this.time;
  }
}
