import { Cluster } from './Cluster.js';

/**
 * Creates, removes, and animates shard clusters in a scene.
 */
export class ClusterManager {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    /** @type {Map<string, Cluster>} */
    this.clusters = new Map();
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
    return cluster;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  removeCluster(id) {
    const cluster = this.clusters.get(id);
    if (!cluster) return false;
    cluster.removeFrom(this.scene);
    cluster.dispose();
    this.clusters.delete(id);
    return true;
  }

  /**
   * @param {string} id
   * @returns {Cluster | undefined}
   */
  getCluster(id) {
    return this.clusters.get(id);
  }

  /**
   * @returns {Cluster[]}
   */
  getAllClusters() {
    return [...this.clusters.values()];
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    for (const cluster of this.clusters.values()) {
      cluster.update(deltaTime);
    }
  }

  clear() {
    for (const id of [...this.clusters.keys()]) {
      this.removeCluster(id);
    }
  }
}
