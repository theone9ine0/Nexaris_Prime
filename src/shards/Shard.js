import * as THREE from 'three';

/**
 * @typedef {{
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
 * Foundational Nexaris object: a textured or colored 3D plane with idle motion.
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
    this._phase = Math.random() * Math.PI * 2;
    this._elapsed = 0;

    const width = options.width ?? 1;
    const height = options.height ?? 1;
    const geometry = new THREE.PlaneGeometry(width, height);

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

    this.mesh = new THREE.Mesh(geometry, this._material);
    this.mesh.userData = { type: 'shard', shardId: this.id };

    this.root = new THREE.Group();
    this.root.name = `shard:${this.id}`;
    this.root.userData = { type: 'shard', shardId: this.id };
    this.root.add(this.mesh);

    this._applyTransform(options);
    this._basePosition = this.root.position.clone();
    this._baseRotation = this.root.rotation.clone();
    this._baseScale = this.root.scale.clone();
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
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (this.animation === 'none') return;

    this._elapsed += deltaTime;
    const t = this._elapsed + this._phase;

    this.root.position.y = this._basePosition.y + Math.sin(t * 1.2) * 0.06;
    this.root.rotation.z = this._baseRotation.z + Math.sin(t * 0.4) * 0.05;

    const pulse = (Math.sin(t * 2.5) + 1) * 0.5;

    if (this.animation === 'pulse' || this.animation === 'both') {
      const s = 1 + pulse * 0.05;
      this.root.scale.set(
        this._baseScale.x * s,
        this._baseScale.y * s,
        this._baseScale.z,
      );
    }

    if (
      (this.animation === 'glow' || this.animation === 'both') &&
      'emissiveIntensity' in this._material
    ) {
      this._material.emissiveIntensity = 0.35 + pulse * 0.5;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this._material.dispose();
    if (this._material.map) {
      this._material.map.dispose();
    }
  }
}
