import * as THREE from 'three';

/**
 * @typedef {{
 *   id: string,
 *   position: THREE.Vector3 | { x?: number, y?: number, z?: number },
 *   targetSeed: number,
 *   color?: number,
 *   radius?: number,
 *   onActivate?: (portal: Portal) => void,
 * }} PortalOptions
 */

/**
 * PR14 — dimensional portal (ring mesh + interaction hook).
 */
export class Portal {
  /**
   * @param {PortalOptions} options
   */
  constructor(options) {
    this.id = options.id;
    this.targetSeed = options.targetSeed;
    this.onActivate = options.onActivate ?? null;

    const color = options.color ?? 0x66ccff;
    const radius = options.radius ?? 0.85;

    this.group = new THREE.Group();
    this.group.name = `portal_${this.id}`;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 12, 32),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.65,
        metalness: 0.7,
        roughness: 0.25,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.72, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    core.rotation.x = Math.PI / 2;
    this.group.add(core);

    const pos = options.position;
    if (pos instanceof THREE.Vector3) {
      this.group.position.copy(pos);
    } else {
      this.group.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
    }

    this._ring = ring;
    this._core = core;
    this._phase = Math.random() * Math.PI * 2;

    const self = this;
    this._interactive = {
      id: this.id,
      mesh: ring,
      metadata: { title: 'Portal', type: 'portal', payload: { targetSeed: this.targetSeed } },
      onHoverEnter() {
        ring.material.emissiveIntensity = 1;
      },
      onHoverExit() {
        ring.material.emissiveIntensity = 0.65;
      },
      onClick() {
        self.activate();
      },
    };
    ring.userData.interactive = this._interactive;
  }

  addTo(parent) {
    parent.add(this.group);
  }

  activate() {
    this.onActivate?.(this);
  }

  /**
   * @param {number} elapsed
   */
  update(elapsed) {
    this._phase += 0.02;
    this._ring.rotation.z = this._phase;
    this._core.material.opacity = 0.15 + Math.sin(this._phase * 2) * 0.08;
    this.group.position.y += Math.sin(this._phase) * 0.0008;
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this._ring.geometry.dispose();
    this._core.geometry.dispose();
    this._ring.material.dispose();
    this._core.material.dispose();
    delete this._ring.userData.interactive;
  }
}
