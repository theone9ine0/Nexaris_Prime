import { AnimationCurve } from './AnimationCurve.js';
import { applyEasing } from './Easing.js';

/**
 * @typedef {{
 *   shardManager: import('../shards/ShardManager.js').ShardManager,
 *   clusterManager?: import('../clusters/ClusterManager.js').ClusterManager | null,
 * }} AnimationSystemOptions
 */

/**
 * @typedef {{
 *   target: object,
 *   property: string,
 *   from: number,
 *   to: number,
 *   duration: number,
 *   elapsed: number,
 *   easing?: import('./Easing.js').EasingName,
 *   onComplete?: () => void,
 * }} Tween
 */

/**
 * @typedef {{
 *   target: object,
 *   property: string,
 *   curve: AnimationCurve | { evaluate: (t: number) => number },
 *   duration: number,
 *   elapsed: number,
 *   offset?: number,
 *   onComplete?: () => void,
 * }} CurveTween
 */

/**
 * Central animation driver: shards, clusters, eased tweens, and curves.
 */
export class AnimationSystem {
  /**
   * @param {AnimationSystemOptions} options
   */
  constructor(options) {
    this.shardManager = options.shardManager;
    this.clusterManager = options.clusterManager ?? null;
    this.time = 0;
    /** @type {Tween[]} */
    this._tweens = [];
    /** @type {CurveTween[]} */
    this._curveTweens = [];
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.time += deltaTime;
    this._updateTweens(deltaTime);
    this._updateCurveTweens(deltaTime);

    this.shardManager.update(deltaTime);
    this.clusterManager?.update(deltaTime);
  }

  /**
   * Eased one-shot tween between two values.
   * @param {{
   *   target: object,
   *   property: string,
   *   from: number,
   *   to: number,
   *   duration: number,
   *   easing?: import('./Easing.js').EasingName,
   *   onComplete?: () => void,
   * }} options
   * @returns {() => void} cancel
   */
  tween(options) {
    const tween = {
      target: options.target,
      property: options.property,
      from: options.from,
      to: options.to,
      duration: Math.max(0.001, options.duration),
      elapsed: 0,
      easing: options.easing ?? 'easeInOutCubic',
      onComplete: options.onComplete,
    };
    this._tweens.push(tween);

    return () => {
      const i = this._tweens.indexOf(tween);
      if (i >= 0) this._tweens.splice(i, 1);
    };
  }

  /**
   * Drive a numeric property with a time-based curve (keyframes, sin, ping-pong).
   * @param {{
   *   target: object,
   *   property: string,
   *   curve: AnimationCurve | { evaluate: (t: number) => number },
   *   duration: number,
   *   offset?: number,
   *   onComplete?: () => void,
   * }} options
   * @returns {() => void} cancel
   */
  tweenCurve(options) {
    const entry = {
      target: options.target,
      property: options.property,
      curve: options.curve,
      duration: Math.max(0.001, options.duration),
      elapsed: 0,
      offset: options.offset ?? 0,
      onComplete: options.onComplete,
    };
    this._curveTweens.push(entry);

    return () => {
      const i = this._curveTweens.indexOf(entry);
      if (i >= 0) this._curveTweens.splice(i, 1);
    };
  }

  /**
   * @param {number} deltaTime
   */
  _updateTweens(deltaTime) {
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const tween = this._tweens[i];
      tween.elapsed += deltaTime;
      const t = Math.min(tween.elapsed / tween.duration, 1);
      const eased = applyEasing(tween.easing ?? 'linear', t);
      tween.target[tween.property] =
        tween.from + (tween.to - tween.from) * eased;

      if (t >= 1) {
        tween.onComplete?.();
        this._tweens.splice(i, 1);
      }
    }
  }

  /**
   * @param {number} deltaTime
   */
  _updateCurveTweens(deltaTime) {
    for (let i = this._curveTweens.length - 1; i >= 0; i--) {
      const entry = this._curveTweens[i];
      entry.elapsed += deltaTime;
      const t = entry.elapsed + entry.offset;
      entry.target[entry.property] = entry.curve.evaluate(t);

      if (entry.elapsed >= entry.duration) {
        entry.onComplete?.();
        this._curveTweens.splice(i, 1);
      }
    }
  }

  /**
   * @returns {number} elapsed seconds
   */
  getTime() {
    return this.time;
  }

  /**
   * Shared curves for procedural motion.
   */
  static curves = {
    float: AnimationCurve.sin(1.2, 0.06),
    pulse: AnimationCurve.pingPong(0.42, { easing: 'easeInOutSine' }),
    drift: AnimationCurve.sin(0.55, 0.1),
  };
}
