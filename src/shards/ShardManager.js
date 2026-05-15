import { Shard } from './Shard.js';
import { VideoShard } from './VideoShard.js';

/**
 * Creates, tracks, and removes shards. Animation via {@link import('../core/AnimationSystem.js').AnimationSystem}.
 */
export class ShardManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/AnimationSystem.js').AnimationSystem | null} [animationSystem]
   * @param {THREE.Scene | null} [cssScene]
   */
  constructor(scene, animationSystem = null, cssScene = null) {
    this.scene = scene;
    this.animationSystem = animationSystem;
    this.cssScene = cssScene;
    /** @type {Map<string, Shard>} */
    this.shards = new Map();
  }

  /**
   * @param {THREE.Scene | null} cssScene
   */
  setCssScene(cssScene) {
    this.cssScene = cssScene;
    for (const shard of this.shards.values()) {
      if (shard instanceof VideoShard) {
        shard.setCssScene(cssScene);
      }
    }
  }

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem | null} system
   */
  setAnimationSystem(system) {
    for (const shard of this.shards.values()) {
      this.animationSystem?.unregister(shard);
    }
    this.animationSystem = system;
    for (const shard of this.shards.values()) {
      this._registerShard(shard);
    }
  }

  /**
   * @param {import('./Shard.js').ShardOptions} options
   * @returns {Shard}
   */
  createShard(options) {
    if (!options?.id) {
      throw new Error('createShard requires options.id');
    }
    if (this.shards.has(options.id)) {
      this.removeShard(options.id);
    }
    const shard = new Shard(options);
    shard.addTo(this.scene);
    this.shards.set(options.id, shard);
    this._registerShard(shard);
    return shard;
  }

  /**
   * @param {import('./VideoShard.js').VideoShardOptions} options
   * @returns {VideoShard}
   */
  createVideoShard(options) {
    if (!options?.id) {
      throw new Error('createVideoShard requires options.id');
    }
    if (this.shards.has(options.id)) {
      this.removeShard(options.id);
    }

    const shard = new VideoShard({
      ...options,
      cssScene: options.cssScene ?? this.cssScene,
    });
    shard.addTo(this.scene);
    this.shards.set(options.id, shard);
    this._registerShard(shard);
    return shard;
  }

  /**
   * @param {Shard} shard
   */
  _registerShard(shard) {
    if (this.animationSystem && shard.animation !== 'none') {
      this.animationSystem.register(shard);
    }
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  removeShard(id) {
    const shard = this.shards.get(id);
    if (!shard) return false;
    this.animationSystem?.unregister(shard);
    shard.removeFrom(this.scene);
    shard.dispose();
    this.shards.delete(id);
    return true;
  }

  getShard(id) {
    return this.shards.get(id);
  }

  getAllShards() {
    return [...this.shards.values()];
  }

  /** @deprecated AnimationSystem.update drives animation */
  update(_deltaTime) {}

  clear() {
    for (const id of [...this.shards.keys()]) {
      this.removeShard(id);
    }
  }
}
