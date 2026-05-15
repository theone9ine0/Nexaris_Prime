import { Cluster } from './Cluster.js';

/**
 * Creates and removes clusters. Animation via {@link import('../core/AnimationSystem.js').AnimationSystem}.
 */
export class ClusterManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/AnimationSystem.js').AnimationSystem | null} [animationSystem]
   */
  constructor(scene, animationSystem = null) {
    this.scene = scene;
    this.animationSystem = animationSystem;
    /** @type {Map<string, Cluster>} */
    this.clusters = new Map();
  }

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem | null} system
   */
  setAnimationSystem(system) {
    for (const cluster of this.clusters.values()) {
      this._unregisterCluster(cluster);
    }
    this.animationSystem = system;
    for (const cluster of this.clusters.values()) {
      this._registerCluster(cluster);
    }
  }

  /**
   * @param {import('./Cluster.js').ClusterOptions} options
   * @returns {Cluster}
   */
  createCluster(options) {
    if (!options?.id) {
      throw new Error('createCluster requires options.id');
    }
    if (this.clusters.has(options.id)) {
      this.removeCluster(options.id);
    }
    const cluster = new Cluster(options);
    cluster.addTo(this.scene);
    this.clusters.set(options.id, cluster);
    this._registerCluster(cluster);
    return cluster;
  }

  /**
   * @param {Cluster} cluster
   */
  _registerCluster(cluster) {
    if (!this.animationSystem) return;
    if (cluster.animations.length > 0) {
      this.animationSystem.register(cluster);
    }
    for (const shard of cluster.shards) {
      if (shard.animation !== 'none') {
        this.animationSystem.register(shard);
      }
    }
  }

  /**
   * @param {Cluster} cluster
   */
  _unregisterCluster(cluster) {
    if (!this.animationSystem) return;
    this.animationSystem.unregister(cluster);
    for (const shard of cluster.shards) {
      this.animationSystem.unregister(shard);
    }
  }

  removeCluster(id) {
    const cluster = this.clusters.get(id);
    if (!cluster) return false;
    this._unregisterCluster(cluster);
    cluster.removeFrom(this.scene);
    cluster.dispose();
    this.clusters.delete(id);
    return true;
  }

  getCluster(id) {
    return this.clusters.get(id);
  }

  getAllClusters() {
    return [...this.clusters.values()];
  }

  /** @deprecated AnimationSystem.update drives animation */
  update(_deltaTime) {}

  clear() {
    for (const id of [...this.clusters.keys()]) {
      this.removeCluster(id);
    }
  }
}
