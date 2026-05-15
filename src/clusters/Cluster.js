import * as THREE from 'three';
import { Shard } from '../shards/Shard.js';
import { LayoutEngine } from './LayoutEngine.js';
import {
  rotateAnimation,
  pulseAnimation,
  driftAnimation,
  applyAnimations,
} from '../core/animationHelpers.js';

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
 * Groups shards with shared layout and group-level motion.
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

    this._animations = this._buildAnimations();
  }

  /**
   * @returns {import('../core/animationHelpers.js').AnimationState[]}
   */
  _buildAnimations() {
    const list = [];
    if (this.animations.includes('rotate')) {
      list.push(rotateAnimation(this.root, 'y', 0.22));
    }
    if (this.animations.includes('pulse')) {
      list.push(pulseAnimation(this.root, 0.06, 1.8));
    }
    if (this.animations.includes('drift')) {
      list.push(
        driftAnimation(this.root, { x: 0.55, y: 0.85, z: 0.4 }, 1),
      );
    }
    return list;
  }

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

  addShard(shard) {
    if (this.shards.includes(shard)) return;
    this.shards.push(shard);
    this.root.add(shard.root);
    this.applyLayout(this.layout, this.layoutOptions);
  }

  removeShard(shardId) {
    const index = this.shards.findIndex((s) => s.id === shardId);
    if (index < 0) return false;
    const [shard] = this.shards.splice(index, 1);
    this.root.remove(shard.root);
    return true;
  }

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

  addTo(parent) {
    parent.add(this.root);
  }

  removeFrom(parent) {
    parent.remove(this.root);
  }

  setPosition(position) {
    if (position.x !== undefined) this.root.position.x = position.x;
    if (position.y !== undefined) this.root.position.y = position.y;
    if (position.z !== undefined) this.root.position.z = position.z;
    this._basePosition.copy(this.root.position);
    for (const anim of this._animations) {
      if (anim.basePosition) anim.basePosition.copy(this.root.position);
    }
  }

  /**
   * Group-level animation only (child shards updated via AnimationSystem).
   * @param {number} deltaTime
   */
  updateAnimation(deltaTime) {
    if (this._animations.length === 0) return;
    applyAnimations(this._animations, deltaTime);
  }

  /** @deprecated Use AnimationSystem */
  update(deltaTime) {
    this.updateAnimation(deltaTime);
  }

  dispose() {
    for (const shard of this.shards) {
      shard.dispose();
    }
    this.shards = [];
  }
}
