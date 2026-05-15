import * as THREE from 'three';
import { createPortalSurfaceMaterial } from './PortalShader.js';

/**
 * @typedef {import('../core/SceneManager.js').SceneManager} SceneManager
 */

/**
 * @typedef {{
 *   id: string,
 *   position?: THREE.Vector3 | { x?: number, y?: number, z?: number },
 *   targetSceneId?: string | null,
 *   targetSeed?: number,
 *   color?: number,
 *   radius?: number,
 *   frameStyle?: 'ring' | 'arch',
 *   sceneManager?: SceneManager | null,
 *   onActivate?: (portal: Portal) => void,
 * }} PortalOptions
 */

/**
 * PR14 — clickable dimensional portal with shader surface and scene transitions.
 */
export class Portal extends THREE.Group {
  /**
   * @param {PortalOptions} options
   */
  constructor(options) {
    super();
    this.id = options.id;
    this.name = `portal_${this.id}`;
    this.targetSceneId = options.targetSceneId ?? null;
    this.targetSeed = options.targetSeed;
    this.sceneManager = options.sceneManager ?? null;
    this.onActivate = options.onActivate ?? null;

    const color = options.color ?? 0x66ccff;
    const radius = options.radius ?? 0.9;
    this._radius = radius;
    this._baseEmissive = 0.55;
    this._hoverEmissive = 1.15;
    this._phase = Math.random() * Math.PI * 2;
    this._open = 1;
    this._anim = null;

    this.portalMesh = this._createFrame(options.frameStyle ?? 'ring', radius, color);
    this.add(this.portalMesh);

    this.portalSurface = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.78, 32),
      createPortalSurfaceMaterial({
        colorInner: color,
        colorOuter: color,
      }),
    );
    this.portalSurface.rotation.x = Math.PI / 2;
    this.add(this.portalSurface);

    const pos = options.position;
    if (pos instanceof THREE.Vector3) {
      this.position.copy(pos);
    } else if (pos) {
      this.position.set(pos.x ?? 0, pos.y ?? 0, pos.z ?? 0);
    }

    this._bindInteraction(color);
  }

  /**
   * @param {'ring' | 'arch'} style
   * @param {number} radius
   * @param {number} color
   * @returns {THREE.Object3D}
   */
  _createFrame(style, radius, color) {
    const frameMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: this._baseEmissive,
      metalness: 0.75,
      roughness: 0.2,
    });

    if (style === 'arch') {
      const group = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.07, 10, 32, Math.PI),
        frameMat,
      );
      torus.rotation.x = Math.PI / 2;
      torus.rotation.z = Math.PI;
      group.add(torus);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 1.6, 0.12, 0.12),
        frameMat,
      );
      base.position.y = -0.05;
      group.add(base);
      return group;
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 12, 36),
      frameMat,
    );
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  /**
   * @param {number} color
   */
  _bindInteraction(color) {
    const hitMesh = this.portalSurface;
    const self = this;

    this._interactive = {
      id: this.id,
      mesh: hitMesh,
      metadata: {
        title: 'Portal',
        type: 'portal',
        payload: {
          targetSceneId: this.targetSceneId,
          targetSeed: this.targetSeed,
        },
      },
      onHoverEnter() {
        self._setGlow(self._hoverEmissive, 1.1);
      },
      onHoverExit() {
        self._setGlow(self._baseEmissive, 0.65);
      },
      onClick() {
        self.activate();
      },
    };
    hitMesh.userData.interactive = this._interactive;

    this.traverse((child) => {
      if (child.isMesh && child !== hitMesh) {
        child.userData.portalFrame = true;
      }
    });
  }

  /**
   * @param {number} frameIntensity
   * @param {number} surfaceGlow
   */
  _setGlow(frameIntensity, surfaceGlow) {
    this.portalMesh.traverse((child) => {
      if (child.isMesh && child.material?.emissiveIntensity != null) {
        child.material.emissiveIntensity = frameIntensity;
      }
    });
    const mat = this.portalSurface.material;
    if (mat?.uniforms?.uGlow) {
      mat.uniforms.uGlow.value = surfaceGlow;
    }
  }

  /**
   * @param {string} sceneId
   */
  setTargetScene(sceneId) {
    this.targetSceneId = sceneId;
    if (this._interactive?.metadata?.payload) {
      this._interactive.metadata.payload.targetSceneId = sceneId;
    }
  }

  playOpenAnimation(duration = 0.35) {
    return this._animateOpen(1, duration);
  }

  playCloseAnimation(duration = 0.3) {
    return this._animateOpen(0, duration);
  }

  /**
   * @param {number} target
   * @param {number} duration
   */
  _animateOpen(target, duration) {
    if (this._anim) {
      cancelAnimationFrame(this._anim);
      this._anim = null;
    }

    const start = this._open;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const step = () => {
        const t = Math.min((performance.now() - startTime) / (duration * 1000), 1);
        const eased = t * t * (3 - 2 * t);
        this._open = start + (target - start) * eased;
        const mat = this.portalSurface.material;
        if (mat?.uniforms?.uOpen) {
          mat.uniforms.uOpen.value = this._open;
        }
        if (t < 1) {
          this._anim = requestAnimationFrame(step);
        } else {
          this._anim = null;
          resolve();
        }
      };
      step();
    });
  }

  async activate() {
    if (this.sceneManager?.isTransitioning?.()) return;
    if (this.sceneManager?.dialogueManager?.isActive) return;

    await this.playCloseAnimation(0.25);

    if (this.targetSceneId && this.sceneManager) {
      await this.sceneManager.transitionViaPortal(this.targetSceneId, {
        preservePlayer: true,
        transition: 'warp',
        duration: 0.85,
      });
      await this.playOpenAnimation(0.35);
      return;
    }

    this.onActivate?.(this);
    await this.playOpenAnimation(0.35);
  }

  addTo(parent) {
    parent.add(this);
  }

  /**
   * @param {number} elapsed
   */
  update(elapsed) {
    this._phase += 0.02;
    const mat = this.portalSurface.material;
    if (mat?.uniforms) {
      mat.uniforms.uTime.value = elapsed;
    }
    this.portalMesh.rotation.z = this._phase * 0.35;
    this.position.y += Math.sin(this._phase) * 0.0006;
  }

  dispose() {
    if (this._anim) {
      cancelAnimationFrame(this._anim);
    }
    this.parent?.remove(this);
    this.portalSurface.geometry.dispose();
    this.portalSurface.material.dispose();
    this.portalMesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    });
    delete this.portalSurface.userData.interactive;
  }
}
