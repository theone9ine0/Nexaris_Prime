import * as THREE from 'three';
import { applyEasing } from '../animation/Easing.js';
import { EffectsManager } from '../effects/EffectsManager.js';
import { AnimationSystem } from '../animation/index.js';
import { disposeSceneGraph } from './disposeSceneGraph.js';

/**
 * @typedef {'fade' | 'warp'} TransitionType
 */

/**
 * @typedef {{
 *   scene: THREE.Scene,
 *   shardManager?: import('../shards/ShardManager.js').ShardManager,
 *   clusterManager?: import('../clusters/ClusterManager.js').ClusterManager,
 *   update?: (delta: number, elapsed: number) => void,
 *   configureEffects?: (effects: EffectsManager) => void,
 *   dispose: () => void,
 * }} SceneInstance
 */

/**
 * @typedef {(ctx: SceneContext) => SceneInstance | Promise<SceneInstance>} SceneFactory
 */

/**
 * @typedef {{
 *   renderer: THREE.WebGLRenderer,
 *   camera: THREE.PerspectiveCamera,
 *   container: HTMLElement,
 *   cssRenderer?: import('three/examples/jsm/renderers/CSS3DRenderer.js').CSS3DRenderer,
 *   cssScene?: THREE.Scene,
 * }} SceneManagerOptions
 */

/**
 * @typedef {SceneManagerOptions & {
 *   effectsManager: EffectsManager | null,
 *   animationSystem: AnimationSystem | null,
 * }} SceneContext
 */

/**
 * PR26 Scene Manager.
 *
 * - `register(id, factory)` — register scenes by ID
 * - `load(id)` / `start(id)` — on-demand load and initial activation
 * - `goTo(id, { transition: 'fade' | 'warp' })` — switch with transition
 * - `unload(id)` — dispose cached scene and free GPU resources
 */
export class SceneManager {
  /**
   * @param {SceneManagerOptions} options
   */
  constructor(options) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.container = options.container;
    this.cssRenderer = options.cssRenderer ?? null;
    this.cssScene = options.cssScene ?? new THREE.Scene();

    /** @type {Map<string, SceneFactory>} */
    this._registry = new Map();
    /** @type {Map<string, SceneInstance>} */
    this._loaded = new Map();

    /** @type {string | null} */
    this.activeId = null;
    /** @type {SceneInstance | null} */
    this.activeScene = null;
    this.effectsManager = null;
    this.animationSystem = null;

    this._elapsed = 0;
    /** @type {import('./SceneManager.js').TransitionState | null} */
    this._transition = null;

    this._overlay = document.createElement('di' + 'v');
    this._overlay.className = 'scene-transition';
    this._overlay.style.opacity = '0';
    this._overlay.style.pointerEvents = 'none';
    this.container.appendChild(this._overlay);
  }

  /**
   * @param {string} id
   * @param {SceneFactory} factory
   */
  register(id, factory) {
    if (!id || typeof factory !== 'function') {
      throw new Error('register requires id and factory');
    }
    this._registry.set(id, factory);
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isRegistered(id) {
    return this._registry.has(id);
  }

  /**
   * @returns {string[]}
   */
  getRegisteredIds() {
    return [...this._registry.keys()];
  }

  /**
   * Active scene world handles for anchors and tooling.
   * @returns {{
   *   sceneId: string | null,
   *   shardManager?: import('../shards/ShardManager.js').ShardManager,
   *   clusterManager?: import('../clusters/ClusterManager.js').ClusterManager,
   * }}
   */
  getActiveWorld() {
    return {
      sceneId: this.activeId,
      shardManager: this.activeScene?.shardManager,
      clusterManager: this.activeScene?.clusterManager,
    };
  }

  /**
   * @returns {SceneInstance | null}
   */
  getActiveScene() {
    return this.activeScene;
  }

  /**
   * @returns {boolean} true when a transition is running
   */
  isTransitioning() {
    return this._transition !== null;
  }

  /**
   * Dispose a cached scene without activating another.
   * @param {string} id
   * @returns {boolean}
   */
  unload(id) {
    if (this.activeId === id) {
      this._disposeActive();
      return true;
    }
    if (!this._loaded.has(id)) return false;
    this._unload(id);
    return true;
  }

  /**
   * Rebuild effects and animation after world mutation (e.g. anchor load).
   */
  rebindSystems() {
    const instance = this.activeScene;
    if (!instance) return;

    this.effectsManager?.dispose();
    this.effectsManager = new EffectsManager(
      this.renderer,
      instance.scene,
      this.camera,
    );
    instance.configureEffects?.(this.effectsManager);

    if (instance.shardManager) {
      this.animationSystem = new AnimationSystem({
        shardManager: instance.shardManager,
        clusterManager: instance.clusterManager ?? null,
      });
    } else {
      this.animationSystem = null;
    }
  }

  /**
   * Load a scene without switching the active view.
   * @param {string} id
   * @returns {Promise<SceneInstance>}
   */
  async load(id) {
    if (this._loaded.has(id)) {
      return this._loaded.get(id);
    }
    const factory = this._registry.get(id);
    if (!factory) {
      throw new Error(`Scene not registered: ${id}`);
    }
    const instance = await factory(this._createContext());
    this._loaded.set(id, instance);
    return instance;
  }

  /**
   * Activate initial scene without a transition.
   * @param {string} id
   * @returns {Promise<SceneInstance>}
   */
  async start(id) {
    if (!this._registry.has(id)) {
      throw new Error(`Scene not registered: ${id}`);
    }
    this._disposeActive();
    await this._activate(id);
    const cam = this.activeScene?.scene.userData?.cameraPosition;
    if (cam) {
      this.camera.position.copy(cam);
    }
    this.camera.rotation.set(0, 0, 0);
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    return this.activeScene;
  }

  /**
   * @param {string} id
   * @param {{ transition?: TransitionType, duration?: number, force?: boolean }} [options]
   * @returns {Promise<SceneInstance | null>}
   */
  async goTo(id, options = {}) {
    if (this._transition) {
      return null;
    }
    if (this.activeId === id && !options.force) {
      return this.activeScene;
    }
    if (!this._registry.has(id)) {
      throw new Error(`Scene not registered: ${id}`);
    }

    const transition = options.transition ?? 'fade';
    const duration = options.duration ?? 0.75;

    return new Promise((resolve, reject) => {
      this._transition = {
        type: transition,
        duration,
        elapsed: 0,
        phase: 'out',
        swapped: false,
        resolve,
        reject,
        targetId: id,
        startCameraPos: this.camera.position.clone(),
        startCameraFov: this.camera.fov,
        startSceneScale: this.activeScene?.scene.scale.clone() ?? new THREE.Vector3(1, 1, 1),
      };
    });
  }

  /**
   * @returns {SceneContext}
   */
  _createContext() {
    return {
      renderer: this.renderer,
      camera: this.camera,
      container: this.container,
      cssRenderer: this.cssRenderer,
      cssScene: this.cssScene,
      effectsManager: this.effectsManager,
      animationSystem: this.animationSystem,
    };
  }

  /**
   * @param {string} id
   */
  _unload(id) {
    const instance = this._loaded.get(id);
    if (!instance) return;
    instance.dispose();
    disposeSceneGraph(instance.scene);
    this._loaded.delete(id);
  }

  /**
   * Tear down the active scene and effects.
   */
  _disposeActive() {
    if (this.activeId) {
      this._unload(this.activeId);
    }
    this.activeScene = null;
    this.activeId = null;

    this.effectsManager?.dispose();
    this.effectsManager = null;
    this.animationSystem = null;
  }

  /**
   * @param {string} id
   */
  async _activate(id) {
    let instance = this._loaded.get(id);
    if (!instance) {
      instance = await this.load(id);
    }

    this.activeId = id;
    this.activeScene = instance;
    this.rebindSystems();
  }

  /**
   * @param {number} delta
   */
  async _advanceTransition(delta) {
    const tr = this._transition;
    if (!tr) return;

    tr.elapsed += delta;
    const half = tr.duration * 0.5;
    const t = Math.min(tr.elapsed / tr.duration, 1);

    if (tr.type === 'fade') {
      const overlayOpacity =
        tr.phase === 'out'
          ? applyEasing('easeInOutCubic', Math.min(tr.elapsed / half, 1))
          : 1 - applyEasing('easeInOutCubic', Math.max((tr.elapsed - half) / half, 0));
      this._overlay.style.opacity = String(overlayOpacity);
    } else {
      this._applyWarpVisuals(tr, t);
    }

    if (!tr.swapped && tr.elapsed >= half) {
      tr.swapped = true;
      tr.phase = 'in';
      try {
        this._disposeActive();
        await this._activate(tr.targetId);
        if (tr.type === 'warp') {
          this.activeScene.scene.scale.set(0.2, 0.2, 0.2);
        }
      } catch (err) {
        tr.reject(err);
        this._transition = null;
        return;
      }
    }

    if (tr.swapped && tr.type === 'warp') {
      const inT = Math.max((tr.elapsed - half) / half, 0);
      const eased = applyEasing('easeOutCubic', Math.min(inT, 1));
      const scale = 0.2 + eased * 0.8;
      this.activeScene.scene.scale.set(scale, scale, scale);
    }

    if (tr.elapsed >= tr.duration) {
      this._overlay.style.opacity = '0';
      this.camera.fov = tr.startCameraFov;
      this.camera.updateProjectionMatrix();
      const cam = this.activeScene?.scene.userData?.cameraPosition;
      if (cam) {
        this.camera.position.copy(cam);
      }
      this.camera.rotation.set(0, 0, 0);
      if (this.activeScene) {
        this.activeScene.scene.scale.set(1, 1, 1);
      }
      const instance = this.activeScene;
      tr.resolve(instance);
      this._transition = null;
    }
  }

  /**
   * @param {NonNullable<SceneManager['_transition']>} tr
   * @param {number} t
   */
  _applyWarpVisuals(tr, t) {
    const half = 0.5;
    const phaseT = t < half ? t / half : (t - half) / half;
    const eased = applyEasing('easeInOutCubic', phaseT);

    if (tr.phase === 'out' && this.activeScene) {
      const pull = 1 - eased * 0.65;
      this.activeScene.scene.scale.copy(tr.startSceneScale).multiplyScalar(pull);
      this.camera.position.z = tr.startCameraPos.z * (1 - eased * 0.4);
      this.camera.rotation.y = eased * 0.6;
    } else if (tr.swapped && this.activeScene) {
      this.camera.position.z = tr.startCameraPos.z * (0.6 + eased * 0.4);
      this.camera.rotation.y = (1 - eased) * 0.6;
    }

    this.camera.fov = tr.startCameraFov + Math.sin(t * Math.PI) * 8;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param {number} delta
   */
  update(delta) {
    this._elapsed += delta;

    if (this._transition) {
      this._advanceTransition(delta);
    }

    this.activeScene?.update?.(delta, this._elapsed);
    this.animationSystem?.update(delta);
    this.effectsManager?.update(delta);
  }

  render() {
    if (!this.activeScene) {
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.render(new THREE.Scene(), this.camera);
      return;
    }

    this.effectsManager?.render();
    if (this.cssRenderer) {
      this.cssRenderer.render(this.cssScene, this.camera);
    }
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  setSize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.effectsManager?.setSize(width, height);
    this.cssRenderer?.setSize(width, height);
  }

  dispose() {
    this._disposeActive();
    for (const id of [...this._loaded.keys()]) {
      this._unload(id);
    }
    this._overlay.remove();
    this._registry.clear();
  }
}
