import { Shard } from './Shard.js';

/**
 * Creates, tracks, and animates all shards in a scene.
 */
export class ShardManager {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    /** @type {Map<string, Shard>} */
    this.shards = new Map();
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
    return shard;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  removeShard(id) {
    const shard = this.shards.get(id);
    if (!shard) return false;
    shard.removeFrom(this.scene);
    shard.dispose();
    this.shards.delete(id);
    return true;
  }

  /**
   * @param {string} id
   * @returns {Shard | undefined}
   */
  getShard(id) {
    return this.shards.get(id);
  }

  /**
   * @returns {Shard[]}
   */
  getAllShards() {
    return [...this.shards.values()];
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    for (const shard of this.shards.values()) {
      shard.update(deltaTime);
    }
  }

  clear() {
    for (const id of [...this.shards.keys()]) {
      this.removeShard(id);
    }
  }
}
