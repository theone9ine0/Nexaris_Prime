import * as THREE from 'three';

/**
 * @typedef {{
 *   clip: string,
 *   loop?: THREE.AnimationActionLoopStyles,
 *   timeScale?: number,
 * }} AnimationStateDef
 */

/**
 * @typedef {{
 *   states: Record<string, AnimationStateDef>,
 *   defaultState?: string,
 *   crossfadeDuration?: number,
 * }} AnimationStateMachineConfig
 */

/**
 * Lightweight locomotion / emote state helper for skeletal models.
 */
export class AnimationStateMachine {
  /**
   * @param {import('./AnimationMixerManager.js').AnimationMixerManager} mixerManager
   * @param {THREE.Object3D} object
   * @param {AnimationStateMachineConfig} config
   */
  constructor(mixerManager, object, config) {
    this.mixerManager = mixerManager;
    this.object = object;
    this.states = config.states;
    this.crossfadeDuration = config.crossfadeDuration ?? 0.25;
    this.defaultState = config.defaultState ?? Object.keys(config.states)[0] ?? null;

    /** @type {string | null} */
    this.currentState = null;
    /** @type {(() => void) | null} */
    this._finishUnsub = null;
    /** @type {string | null} */
    this._locomotionState = null;
  }

  /**
   * @param {string} stateName
   * @param {number} [crossfadeDuration]
   */
  setState(stateName, crossfadeDuration = this.crossfadeDuration) {
    const next = this.states[stateName];
    if (!next) {
      console.warn(`[AnimationStateMachine] unknown state: ${stateName}`);
      return;
    }

    const prevName = this.currentState;
    const prev = prevName ? this.states[prevName] : null;

    if (prevName === stateName) return;

    if (prev && prevName) {
      this.mixerManager.crossfade(
        this.object,
        prev.clip,
        next.clip,
        crossfadeDuration,
      );
    } else {
      this.mixerManager.play(this.object, next.clip, {
        loop: next.loop ?? THREE.LoopRepeat,
        fadeIn: crossfadeDuration,
        timeScale: next.timeScale ?? 1,
      });
    }

    this.currentState = stateName;
    if (stateName === 'idle' || stateName === 'walk' || stateName === 'run') {
      this._locomotionState = stateName;
    }
  }

  /**
   * Play a one-shot clip, then return to locomotion or default state.
   * @param {string} clipName
   * @param {{ returnTo?: string, fadeIn?: number }} [options]
   */
  triggerOneShot(clipName, options = {}) {
    const returnTo =
      options.returnTo ?? this._locomotionState ?? this.defaultState ?? 'idle';

    this._finishUnsub?.();

    const action = this.mixerManager.play(this.object, clipName, {
      loop: THREE.LoopOnce,
      fadeIn: options.fadeIn ?? 0.15,
      clampWhenFinished: true,
    });

    if (!action) return;

    this._finishUnsub = this.mixerManager.onFinished(this.object, (event) => {
      if (event.action !== action) return;
      this._finishUnsub?.();
      this._finishUnsub = null;
      if (returnTo) {
        this.setState(returnTo, this.crossfadeDuration);
      }
    });
  }

  /**
   * @param {string} locomotionState e.g. walk | run
   */
  setLocomotion(locomotionState) {
    this.setState(locomotionState);
  }

  /**
   * Toggle between walk and run (falls back to idle if missing).
   */
  toggleWalkRun() {
    if (this.currentState === 'run' && this.states.walk) {
      this.setState('walk');
    } else if (this.states.run) {
      this.setState('run');
    } else if (this.states.walk) {
      this.setState('walk');
    }
  }

  dispose() {
    this._finishUnsub?.();
    this._finishUnsub = null;
  }
}
