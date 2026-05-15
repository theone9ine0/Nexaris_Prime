import * as THREE from 'three';
import { createPortalSurfaceMaterial } from './PortalShader.js';
import {
  isProceduralSceneId,
  seedFromProceduralSceneId,
  getMultiverseDepth,
} from '../multiverse/proceduralSceneId.js';

/**
 * @typedef {import('../core/SceneManager.js').SceneManager} SceneManager
 * @typedef {'ring' | 'arch' | 'crystal' | 'void' | 'cyber'} PortalFrameStyle
 */

/**
 * @typedef {{
 *   id: string,
 *   position?: THREE.Vector3 | { x?: number, y?: number, z?: number },
 *   targetSceneId?: string | null,
 *   targetSeed?: number,
 *   color?: number,
 *   colorOuter?: number,
 *   radius?: number,
 *   frameStyle?: PortalFrameStyle,
 *   visualTheme?: string,
 *   shaderVariant?: number,
 *   isProcedural?: boolean,
 *   sceneManager?: SceneManager | null,
 *   onActivate?: (portal: Portal) => void,
 * }} PortalOptions
 */

/**
 * PR14 / PR14.5 — dimensional portal with themed shader surface and scene transitions.
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
    this.targetSeed =
      options.targetSeed ??
      (this.targetSceneId ? seedFromProceduralSceneId(this.targetSceneId) : undefined);
    this.sceneManager = options.sceneManager ?? null;
    this.onActivate = options.onActivate ?? null;
    this.isProcedural = options.isProcedural ?? isProceduralSceneId(this.targetSceneId);
    this.visualTheme = options.visualTheme ?? null;

    const color = options.color ?? 0x66ccff;
    const colorOuter = options.colorOuter ?? color;
    const radius = options.radius ?? 0.9;
    this._radius = radius;
    this._baseEmissive = 0.55;
    this._hoverEmissive = 1.15;
    this._phase = Math.random() * Math.PI * 2;
    this._open = 1;
    this._anim = null;

    const frameStyle = options.frameStyle ?? 'ring';
    this.portalMesh = this._createFrame(frameStyle, radius, color);
    this.add(this.portalMesh);

    this.portalSurface = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.78, 32),
      createPortalSurfaceMaterial({
        colorInner: color,
        colorOuter,
        shaderVariant: options.shaderVariant ?? 0,
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
   * @param {PortalFrameStyle} style
   * @param {number} radius
   * @param {number} color
   * @returns {THREE.Object3D}
   */
  _createFrame(style, radius, color) {
    if (style === 'crystal') {
      return this._createCrystalFrame(radius, color);
    }
    if (style === 'void') {
      return this._createVoidFrame(radius, color);
    }
    if (style === 'cyber') {
      return this._createCyberFrame(radius, color);
    }
    if (style === 'arch') {
      return this._createArchFrame(radius, color);
    }
    return this._createRingFrame(radius, color);
  }

  /**
   * @param {number} radius
   * @param {number} color
   */
  _createFrameMaterial(radius, color) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: this._baseEmissive,
      metalness: 0.75,
      roughness: 0.2,
    });
  }

  /**
   * @param {number} radius
   * @param {number} color
   */
  _createRingFrame(radius, color) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 12, 36),
      this._createFrameMaterial(radius, color),
    );
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  /**
   * @param {number} radius
   * @param {number} color
   */
  _createArchFrame(radius, color) {
    const frameMat = this._createFrameMaterial(radius, color);
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

  /**
   * @param {number} radius
   * @param {number} color
   */
  _createCrystalFrame(radius, color) {
    const group = new THREE.Group();
    const mat = this._createFrameMaterial(radius, color);
    mat.metalness = 0.9;
    mat.roughness = 0.1;
    for (let i = 0; i < 6; i++) {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12, 0),
        mat,
      );
      const angle = (i / 6) * Math.PI * 2;
      shard.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.15, Math.sin(angle) * radius);
      shard.rotation.set(angle, angle * 0.5, 0);
      group.add(shard);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.05, 8, 24),
      mat,
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    return group;
  }

  /**
   * @param {number} radius
   * @param {number} color
   */
  _createVoidFrame(radius, color) {
    const dark = new THREE.MeshStandardMaterial({
      color: 0x050508,
      emissive: color,
      emissiveIntensity: 0.35,
      metalness: 0.95,
      roughness: 0.05,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.06, 12, 36),
      dark,
    );
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  /**
   * @param {number} radius
   * @param {number} color
   */
  _createCyberFrame(radius, color) {
    const group = new THREE.Group();
    const mat = this._createFrameMaterial(radius, color);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.07, 12, 32),
      mat,
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    for (let i = 0; i < 4; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, 0.15),
        mat,
      );
      const angle = (i / 4) * Math.PI * 2;
      box.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      group.add(box);
    }
    return group;
  }

  _bindInteraction(color) {
    const hitMesh = this.portalSurface;
    const self = this;

    this._interactive = {
      id: this.id,
      mesh: hitMesh,
      metadata: {
        title: this.isProcedural ? 'Procedural Portal' : 'Portal',
        type: 'portal',
        payload: {
          targetSceneId: this.targetSceneId,
          targetSeed: this.targetSeed,
          procedural: this.isProcedural,
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
  }

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

  setTargetScene(sceneId) {
    this.targetSceneId = sceneId;
    this.isProcedural = isProceduralSceneId(sceneId);
    this.targetSeed = seedFromProceduralSceneId(sceneId) ?? this.targetSeed;
    if (this._interactive?.metadata?.payload) {
      this._interactive.metadata.payload.targetSceneId = sceneId;
      this._interactive.metadata.payload.procedural = this.isProcedural;
    }
  }

  playOpenAnimation(duration = 0.35) {
    return this._animateOpen(1, duration);
  }

  playCloseAnimation(duration = 0.3) {
    return this._animateOpen(0, duration);
  }

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
      const depth = getMultiverseDepth(this.sceneManager.currentScene);
      await this.sceneManager.transitionViaPortal(this.targetSceneId, {
        preservePlayer: true,
        transition: 'warp',
        duration: 0.85,
        targetSeed: this.targetSeed,
        depth,
        isProcedural: this.isProcedural,
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
        if (child.material && !Array.isArray(child.material)) {
          child.material.dispose();
        }
      }
    });
    delete this.portalSurface.userData.interactive;
  }
}
