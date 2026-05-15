import { applyEasing } from './Easing.js';

/**
 * @typedef {{
 *   time: number,
 *   value: number,
 *   easing?: import('./Easing.js').EasingName,
 * }} Keyframe
 */

/**
 * Time-based animation curves with optional easing per segment.
 */
export class AnimationCurve {
  /**
   * @param {Keyframe[]} keyframes sorted by time
   * @param {{ duration?: number, loop?: boolean, easing?: import('./Easing.js').EasingName }} [options]
   */
  constructor(keyframes, options = {}) {
    if (!keyframes?.length) {
      throw new Error('AnimationCurve requires at least one keyframe');
    }
    this.keyframes = [...keyframes].sort((a, b) => a.time - b.time);
    this.duration =
      options.duration ??
      this.keyframes[this.keyframes.length - 1].time;
    this.loop = options.loop ?? true;
    this.easing = options.easing ?? 'linear';
  }

  /**
   * Sinusoidal oscillation around 0.
   * @param {number} frequency Hz-scale multiplier on time
   * @param {number} amplitude
   * @param {number} [phase]
   */
  static sin(frequency, amplitude, phase = 0) {
    return {
      evaluate: (t) => Math.sin(t * frequency + phase) * amplitude,
    };
  }

  /**
   * Ping-pong between 0 and 1 with easing.
   * @param {number} duration seconds per full cycle
   * @param {{ easing?: import('./Easing.js').EasingName }} [options]
   */
  static pingPong(duration, options = {}) {
    const easing = options.easing ?? 'easeInOutSine';
    return {
      evaluate: (t) => {
        const phase = (t % duration) / duration;
        const half = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        return applyEasing(easing, half);
      },
    };
  }

  /**
   * @param {number} elapsed seconds
   * @returns {number}
   */
  evaluate(elapsed) {
    let t = elapsed;
    if (this.loop && this.duration > 0) {
      t = elapsed % this.duration;
    } else {
      t = Math.min(elapsed, this.duration);
    }

    const keys = this.keyframes;
    if (t <= keys[0].time) return keys[0].value;
    if (t >= keys[keys.length - 1].time) return keys[keys.length - 1].value;

    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (t >= a.time && t <= b.time) {
        const span = b.time - a.time || 1;
        const local = (t - a.time) / span;
        const eased = applyEasing(b.easing ?? this.easing, local);
        return a.value + (b.value - a.value) * eased;
      }
    }

    return keys[keys.length - 1].value;
  }
}
