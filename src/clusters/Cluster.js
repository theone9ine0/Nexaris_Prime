import * as THREE from 'three';
import { Shard } from '../shards/Shard.js';
import { LayoutEngine } from './LayoutEngine.js';

/**
 * @typedef {'circle' | 'spiral' | 'grid'} ClusterLayout
 * @typedef {'rotate' | 'pulse' | 'drift'} ClusterAnimation
 */

/**
 * @typedef {{
 *   id: string,
 *   shards?: import('../shards/Shard.js').Shard[],
 *   shardSpecs?: import('../shards/Shard.js').ShardOptions[],
 *   layout?: ClusterLayout,
 *   layoutOptions?: { radius?: number, spacing?: number },
 *   position?: { x?: number, y?: number, z?: number },
 *   rotation?: { x?: number, y?: number, z?: number },
 *   scale?: { x?: number, y?: number, z?: number } | number,
 *   animation?: ClusterAnimation | ClusterAnimation[] | 'none',
 * }} ClusterOptions
 */

/**
 * Groups shards with shared layout and group-level motion (rotate, pulse, drift).
 */
export class Cluster {
  /**
   * @param {ClusterOptions} options
   */
  constructor(options) {
    if (!options?.id) {
      throw new Error('Cluster requires options.id');
    }

    this.id = options.id;
    this.layout = options.layout ?? 'circle';
    this.layoutOptions = options.layoutOptions ?? {};

    const animations = options.animation ?? ['rotate', 'drift'];
    this.animations =
      animations === 'none'
        ? []
        : Array.isArray(animations)
          ? animations
          : [animations];

    this._phase = Math.random() * Math.PI * 2;
    this._elapsed = 0;

    this.root = new THREE.Group();
    this.root.name = `cluster:${this.id}`;
    this.root.userData = { type: 'cluster', clusterId: this.id };

    /** @type {import('../shards/Shard.js').Shard[]} */
    this.shards = [];

    if (options.shards?.length) {
      for (const shard of options.shards) {
        this.addShard(shard);
      }
    } else if (options.shardSpecs?.length) {
      for (const spec of options.shardSpecs) {
        this.addShard(new Shard(spec));
      }
    }

    this._applyTransform(options);
    this._basePosition = this.root.position.clone();
    this._baseRotation = this.root.rotation.clone();
    this._baseScale = this.root.scale.clone();

    if (this.shards.length > 0) {
      this.applyLayout(this.layout, this.layoutOptions);
    }
  }

  /**
   * @param {ClusterOptions} options
   */
  _applyTransform(options) {
    const pos = options.position ?? {};
    this.root.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? -3);

    const rot = options.rotation ?? {};
    this.root.rotation.set(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0);

    const scale = options.scale;
    if (typeof scale === 'number') {
      this.root.scale.setScalar(scale);
    } else {
      const s = scale ?? {};
      this.root.scale.set(s.x ?? 1, s.y ?? 1, s.z ?? 1);
    }
  }

  /**
   * @param {import('../shards/Shard.js').Shard} shard
   */
  addShard(shard) {
    if (this.shards.includes(shard)) return;
    this.shards.push(shard);
    this.root.add(shard.root);
    this.applyLayout(this.layout, this.layoutOptions);
  }

  /**
   * @param {string} shardId
   * @returns {boolean}
   */
  removeShard(shardId) {
    const index = this.shards.findIndex((s) => s.id === shardId);
    if (index < 0) return false;
    const [shard] = this.shards.splice(index, 1);
    this.root.remove(shard.root);
    return true;
  }

  /**
   * @param {ClusterLayout} [layout]
   * @param {{ radius?: number, spacing?: number }} [options]
   */
  applyLayout(layout = this.layout, options = {}) {
    this.layout = layout;
    this.layoutOptions = { ...this.layoutOptions, ...options };

    const positions = LayoutEngine.compute(
      this.shards.length,
      { x: 0, y: 0, z: 0 },
      this.layout,
      this.layoutOptions,
    );

    this.shards.forEach((shard, i) => {
      const pos = positions[i] ?? { x: 0, y: 0, z: 0 };
      shard.setPosition(pos);
    });
  }

  /**
   * @param {THREE.Scene | THREE.Group} parent
   */
  addTo(parent) {
    parent.add(this.root);
  }

  /**
   * @param {THREE.Scene | THREE.Group} parent
   */
  removeFrom(parent) {
    parent.remove(this.root);
  }

  /**
   * @param {{ x?: number, y?: number, z?: number }} position
   */
  setPosition(position) {
    if (position.x !== undefined) this.root.position.x = position.x;
    if (position.y !== undefined) this.root.position.y = position.y;
    if (position.z !== undefined) this.root.position.z = position.z;
    this._basePosition.copy(this.root.position);
  }

  /**
   * Group + child shard animation.
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (this.animations.length > 0) {
      this._elapsed += deltaTime;
      const t = this._elapsed + this._phase;
      const pulse = (Math.sin(t * 1.8) + 1) * 0.5;

      if (this.animations.includes('rotate')) {
        this.root.rotation.y = this._baseRotation.y + t * 0.22;
      }

      if (this.animations.includes('pulse')) {
        const s = 1 + pulse * 0.06;
        this.root.scale.set(
          this._baseScale.x * s,
          this._baseScale.y * s,
          this._baseScale.z,
        );
      } else {
        this.root.scale.copy(this._baseScale);
      }

      if (this.animations.includes('drift')) {
        this.root.position.x = this._basePosition.x + Math.sin(t * 0.55) * 0.1;
        this.root.position.y = this._basePosition.y + Math.sin(t * 0.85) * 0.08;
        this.root.position.z = this._basePosition.z + Math.cos(t * 0.4) * 0.06;
      } else {
        this.root.position.copy(this._basePosition);
      }
    }

    for (const shard of this.shards) {
      shard.update(deltaTime);
    }
  }

  dispose() {
    for (const shard of this.shards) {
      shard.dispose();
    }
    this.shards = [];
  }
}
