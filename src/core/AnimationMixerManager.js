import * as THREE from 'three';

/**
 * @typedef {{
 *   mixer: THREE.AnimationMixer,
 *   clips: Map<string, THREE.AnimationClip>,
 *   actions: Map<string, THREE.AnimationAction>,
 *   currentAction: THREE.AnimationAction | null,
 * }} MixerEntry
 */

/**
 * @typedef {{
 *   loop?: THREE.AnimationActionLoopStyles,
 *   fadeIn?: number,
 *   fadeOut?: number,
 *   timeScale?: number,
 *   reset?: boolean,
 *   clampWhenFinished?: boolean,
 * }} PlayOptions
 */

/**
 * PR31 — skeletal animation mixers for GLB characters and creatures.
 */
export class AnimationMixerManager {
  constructor() {
    /** @type {Map<THREE.Object3D, MixerEntry>} */
    this._mixers = new Map();
  }

  /**
   * @param {THREE.Object3D} object
   * @param {THREE.AnimationClip[]} animations
   * @returns {THREE.AnimationMixer}
   */
  createMixer(object, animations = []) {
    if (this._mixers.has(object)) {
      this.removeMixer(object);
    }

    const mixer = new THREE.AnimationMixer(object);
    const clips = new Map();
    const actions = new Map();

    for (const clip of animations) {
      clips.set(clip.name, clip);
      actions.set(clip.name, mixer.clipAction(clip));
    }

    this._mixers.set(object, {
      mixer,
      clips,
      actions,
      currentAction: null,
    });

    return mixer;
  }

  /**
   * @param {THREE.Object3D} object
   * @returns {MixerEntry | null}
   */
  getEntry(object) {
    return this._mixers.get(object) ?? null;
  }

  /**
   * @param {THREE.Object3D} object
   * @returns {THREE.AnimationMixer | null}
   */
  getMixer(object) {
    return this._mixers.get(object)?.mixer ?? null;
  }

  /**
   * @param {THREE.Object3D} object
   * @returns {string[]}
   */
  getClipNames(object) {
    const entry = this._mixers.get(object);
    return entry ? [...entry.clips.keys()] : [];
  }

  /**
   * @param {THREE.Object3D} object
   * @param {string} clipName
   * @param {PlayOptions} [options]
   * @returns {THREE.AnimationAction | null}
   */
  play(object, clipName, options = {}) {
    const entry = this._mixers.get(object);
    if (!entry) {
      console.warn('[AnimationMixerManager] no mixer for object', object.name);
      return null;
    }

    const action = entry.actions.get(clipName);
    if (!action) {
      console.warn(
        `[AnimationMixerManager] clip not found: "${clipName}" (available: ${[...entry.actions.keys()].join(', ')})`,
      );
      return null;
    }

    const fadeIn = options.fadeIn ?? 0.2;
    const loop = options.loop ?? THREE.LoopRepeat;
    const repetitions = loop === THREE.LoopOnce ? 1 : Infinity;

    if (options.reset !== false) {
      action.reset();
    }

    action.setLoop(loop, repetitions);
    action.clampWhenFinished =
      options.clampWhenFinished ?? loop === THREE.LoopOnce;
    action.timeScale = options.timeScale ?? 1;

    if (entry.currentAction && entry.currentAction !== action) {
      entry.currentAction.fadeOut(options.fadeOut ?? fadeIn);
    }

    action.fadeIn(fadeIn).play();
    entry.currentAction = action;
    return action;
  }

  /**
   * @param {THREE.Object3D} object
   * @param {string} fromClip
   * @param {string} toClip
   * @param {number} [duration]
   * @returns {THREE.AnimationAction | null}
   */
  crossfade(object, fromClip, toClip, duration = 0.3) {
    const entry = this._mixers.get(object);
    if (!entry) return null;

    const from = entry.actions.get(fromClip);
    const to = entry.actions.get(toClip);
    if (!from || !to) {
      console.warn('[AnimationMixerManager] crossfade clips missing', fromClip, toClip);
      return null;
    }

    from.fadeOut(duration);
    to.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(duration).play();
    entry.currentAction = to;
    return to;
  }

  /**
   * @param {THREE.Object3D} object
   * @param {string} clipName
   * @param {number} [fadeOut]
   */
  stop(object, clipName, fadeOut = 0.2) {
    const entry = this._mixers.get(object);
    if (!entry) return;

    const action = entry.actions.get(clipName);
    if (!action) return;

    action.fadeOut(fadeOut);
    if (entry.currentAction === action) {
      entry.currentAction = null;
    }
  }

  /**
   * @param {THREE.Object3D} object
   * @param {number} [fadeOut]
   */
  stopAll(object, fadeOut = 0.2) {
    const entry = this._mixers.get(object);
    if (!entry) return;

    for (const action of entry.actions.values()) {
      action.fadeOut(fadeOut);
    }
    entry.currentAction = null;
  }

  /**
   * @param {THREE.Object3D} object
   * @param {(event: { action: THREE.AnimationAction }) => void} callback
   * @returns {() => void} unsubscribe
   */
  onFinished(object, callback) {
    const mixer = this.getMixer(object);
    if (!mixer) return () => {};

    const handler = (event) => callback(event);
    mixer.addEventListener('finished', handler);
    return () => mixer.removeEventListener('finished', handler);
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    for (const { mixer } of this._mixers.values()) {
      mixer.update(deltaTime);
    }
  }

  /**
   * @param {THREE.Object3D} object
   */
  removeMixer(object) {
    const entry = this._mixers.get(object);
    if (!entry) return;

    entry.mixer.stopAllAction();
    this._mixers.delete(object);
  }

  clear() {
    for (const object of [...this._mixers.keys()]) {
      this.removeMixer(object);
    }
  }
}

/** Shared mixer manager (owned per-scene via AnimationSystem). */
export const animationMixerManager = new AnimationMixerManager();
