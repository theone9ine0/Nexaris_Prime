import * as THREE from 'three';
import {
  floatAnimation,
  pulseAnimation,
  glowPulseAnimation,
  applyAnimations,
} from '../core/animationHelpers.js';

/**
 * @typedef {Object} ShardMetadata
 * @property {string} [title]
 * @property {string} [type]
 * @property {unknown} [payload]
 */

/**
 * @typedef {ShardMetadata & {
 *   id: string,
 *   position?: { x?: number, y?: number, z?: number },
 *   rotation?: { x?: number, y?: number, z?: number },
 *   scale?: { x?: number, y?: number, z?: number } | number,
 *   color?: number | string,
 *   texture?: THREE.Texture,
 *   width?: number,
 *   height?: number,
 *   animation?: 'pulse' | 'glow' | 'both' | 'none',
 * }} ShardOptions
 */

/**
 * Foundational Nexaris object: a textured or colored 3D plane.
 * Implements PR12 interaction callbacks for hover, click, and selection.
 */
export class Shard {
  /**
   * @param {ShardOptions} options
   */
  constructor(options) {
    if (!options?.id) {
      throw new Error('Shard requires options.id');
    }

    this.id = options.id;
    this.animation = options.animation ?? 'pulse';

    this.metadata = {
      title: options.title ?? this.id,
      type: options.type ?? 'shard',
      payload: options.payload ?? null,
    };

    const width = options.width ?? 1;
    const height = options.height ?? 1;
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.computeBoundingSphere();

    if (options.texture) {
      options.texture.colorSpace = THREE.SRGBColorSpace;
      this._material = new THREE.MeshStandardMaterial({
        map: options.texture,
        side: THREE.DoubleSide,
        transparent: true,
        metalness: 0.05,
        roughness: 0.6,
      });
    } else {
      const color = new THREE.Color(options.color ?? 0x66aaff);
      this._material = new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        emissive: color.clone().multiplyScalar(0.4),
        emissiveIntensity: 0.45,
        metalness: 0.08,
        roughness: 0.45,
      });
    }

    this._baseEmissiveIntensity =
      'emissiveIntensity' in this._material ? this._material.emissiveIntensity : 0;

    this.mesh = new THREE.Mesh(geometry, this._material);
    this.mesh.userData = {
      type: 'shard',
      shardId: this.id,
      interactive: this,
    };

    this.root = new THREE.Group();
    this.root.name = `shard:${this.id}`;
    this.root.userData = { type: 'shard', shardId: this.id, interactive: this };
    this.root.add(this.mesh);

    this._applyTransform(options);
    this._basePosition = this.root.position.clone();
    this._baseRotation = this.root.rotation.clone();
    this._baseScale = this.root.scale.clone();

    this._hovered = false;
    this._selected = false;
    this._clickFlash = 0;

    /** @type {import('../core/animationHelpers.js').AnimationState[]} */
    this._animations = this._buildAnimations();
  }

  /**
   * @returns {import('../core/animationHelpers.js').AnimationState[]}
   */
  _buildAnimations() {
    if (this.animation === 'none') return [];

    const list = [floatAnimation(this.root, 0.06, 1.2)];

    if (this.animation === 'pulse' || this.animation === 'both') {
      list.push(pulseAnimation(this.root, 0.05, 2.5));
    }

    if (
      (this.animation === 'glow' || this.animation === 'both') &&
      'emissiveIntensity' in this._material
    ) {
      list.push(glowPulseAnimation(this._material, 0.5, 2.5));
    }

    return list;
  }

  /**
   * @param {ShardOptions} options
   */
  _applyTransform(options) {
    const pos = options.position ?? {};
    this.root.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);

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

  onHoverEnter() {
    this._hovered = true;
    this._applyInteractionEmissive();
  }

  onHoverExit() {
    this._hovered = false;
    this._applyInteractionEmissive();
  }

  onClick() {
    this._clickFlash = 0.35;
    this._applyInteractionEmissive();
  }

  onSelect() {
    this._selected = true;
    this._applyInteractionEmissive();
  }

  onDeselect() {
    this._selected = false;
    this._applyInteractionEmissive();
  }

  /**
   * Boost emissive on top of animation-driven glow.
   */
  _applyInteractionEmissive() {
    if (!('emissiveIntensity' in this._material)) return;

    let boost = 0;
    if (this._hovered) boost += 0.35;
    if (this._selected) boost += 0.5;
    if (this._clickFlash > 0) {
      boost += 0.65 * Math.sin((1 - this._clickFlash / 0.35) * Math.PI);
    }

    const glowAnim = this._animations.find((a) => a.type === 'glowPulse');
    const base = glowAnim
      ? this._material.emissiveIntensity
      : this._baseEmissiveIntensity;

    this._material.emissiveIntensity = base + boost;
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
   * @param {number} deltaTime
   */
  updateAnimation(deltaTime) {
    if (this._clickFlash > 0) {
      this._clickFlash = Math.max(0, this._clickFlash - deltaTime);
    }

    if (this._animations.length > 0) {
      applyAnimations(this._animations, deltaTime);
    }

    if (this._hovered || this._selected || this._clickFlash > 0) {
      this._applyInteractionEmissive();
    }
  }

  /** @deprecated Use AnimationSystem */
  update(deltaTime) {
    this.updateAnimation(deltaTime);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this._material.dispose();
    if (this._material.map) {
      this._material.map.dispose();
    }
  }
}
