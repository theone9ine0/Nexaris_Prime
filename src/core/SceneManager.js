import * as THREE from 'three';
import { applyEasing } from '../animation/Easing.js';
import { EffectsManager } from '../effects/index.js';
import { AnimationSystem } from './AnimationSystem.js';
import { modelManager } from './ModelManager.js';

/**
 * @typedef {'fade' | 'warp'} TransitionType
 */

/**
 * @typedef {{
 *   renderer: THREE.WebGLRenderer,
 *   camera: THREE.PerspectiveCamera,
 *   container: HTMLElement,
 *   cssRenderer?: import('three/examples/jsm/renderers/CSS3DRenderer.js').CSS3DRenderer,
 *   cssScene?: THREE.Scene,
 *   inputSystem?: import('./InputSystem.js').InputSystem,
 *   cameraController?: import('./CameraController.js').CameraController,
 *   interactionSystem?: import('./InteractionSystem.js').InteractionSystem,
 * }} SceneManagerOptions
 */

/**
 * PR26 — modular dimension manager with class-based scenes.
 *
 * - `registerScene(id, sceneInstance)`
 * - `loadScene(id)` — build scene content without activating
 * - `unloadCurrentScene()` — tear down active dimension
 * - `transitionTo(id, { transition, duration })` — fade or dimensional warp
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
    this.inputSystem = options.inputSystem ?? null;
    this.cameraController = options.cameraController ?? null;
    this.interactionSystem = options.interactionSystem ?? null;

    /** @type {Map<string, import('../scenes/SceneBase.js').SceneBase>} */
    this._registry = new Map();

    /** @type {import('../scenes/SceneBase.js').SceneBase | null} */
    this.currentScene = null;
    /** @type {string | null} */
    this.currentSceneId = null;
    /** @type {import('../scenes/SceneBase.js').SceneBase | null} */
    this.previousScene = null;
    /** @type {string | null} */
    this.previousSceneId = null;

    this.effectsManager = null;
    this.animationSystem = null;

    this._elapsed = 0;
    /** @type {TransitionState | null} */
    this._transition = null;

    this._overlay = document.createElement('di' + 'v');
    this._overlay.className = 'scene-transition';
    this._overlay.style.opacity = '0';
    this._overlay.style.pointerEvents = 'none';
    this.container.appendChild(this._overlay);
  }

  /** @deprecated use currentSceneId */
  get activeId() {
    return this.currentSceneId;
  }

  /** @deprecated use currentScene */
  get activeScene() {
    return this.currentScene;
  }

  /**
   * @param {string} id
   * @param {import('../scenes/SceneBase.js').SceneBase} sceneInstance
   */
  registerScene(id, sceneInstance) {
    if (!id || !sceneInstance) {
      throw new Error('registerScene requires id and sceneInstance');
    }
    if (sceneInstance.id && sceneInstance.id !== id) {
      sceneInstance.id = id;
    } else if (!sceneInstance.id) {
      sceneInstance.id = id;
    }
    this._registry.set(id, sceneInstance);
  }

  /** @param {string} id @param {import('../scenes/SceneBase.js').SceneBase} sceneInstance */
  register(id, sceneInstance) {
    this.registerScene(id, sceneInstance);
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
   * @returns {{
   *   sceneId: string | null,
   *   shardManager?: import('../shards/ShardManager.js').ShardManager,
   *   clusterManager?: import('../clusters/ClusterManager.js').ClusterManager,
   * }}
   */
  getActiveWorld() {
    return {
      sceneId: this.currentSceneId,
      shardManager: this.currentScene?.shardManager ?? undefined,
      clusterManager: this.currentScene?.clusterManager ?? undefined,
    };
  }

  /**
   * @returns {import('../scenes/SceneBase.js').SceneBase | null}
   */
  getActiveScene() {
    return this.currentScene;
  }

  /**
   * @returns {boolean}
   */
  isTransitioning() {
    return this._transition !== null;
  }

  /**
   * Build a registered scene without making it active.
   * @param {string} id
   * @returns {import('../scenes/SceneBase.js').SceneBase}
   */
  loadScene(id) {
    const scene = this._registry.get(id);
    if (!scene) {
      throw new Error(`Scene not registered: ${id}`);
    }
    scene.build();
    return scene;
  }

  /**
   * Dispose the active scene and per-scene systems.
   */
  /**
   * @param {{ skipOnExit?: boolean }} [options]
   */
  unloadCurrentScene(options = {}) {
    if (!this.currentScene) return;

    if (!options.skipOnExit) {
      this.currentScene.onExit(null);
    }
    this.effectsManager?.dispose();
    this.effectsManager = null;
    this.animationSystem = null;

    this.previousScene = this.currentScene;
    this.previousSceneId = this.currentSceneId;

    this.currentScene.dispose();
    this.currentScene = null;
    this.currentSceneId = null;
  }

  /**
   * Rebuild effects and animation after world mutation (e.g. anchor load).
   */
  rebindSystems() {
    const scene = this.currentScene;
    if (!scene) return;

    this.effectsManager?.dispose();
    this.effectsManager = new EffectsManager(this.renderer, scene.scene, this.camera);

    this.animationSystem = new AnimationSystem();
    scene.bindSystems(this.animationSystem, this.effectsManager);
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../scenes/SceneBase.js').SceneBase>}
   */
  async _activate(id) {
    const registered = this._registry.get(id);
    if (registered) {
      registered.cssScene = this.cssScene;
      registered.modelManager = modelManager;
      registered.inputSystem = this.inputSystem;
      registered.cameraController = this.cameraController;
      registered.interactionSystem = this.interactionSystem;
    }
    const scene = this.loadScene(id);
    scene.shardManager?.setCssScene(this.cssScene);
    const prevId = this.previousSceneId ?? this.currentSceneId;
    this.currentScene = scene;
    this.currentSceneId = id;
    this.rebindSystems();
    scene.onEnter(prevId);
    return scene;
  }

  /**
   * Activate initial scene without transition.
   * @param {string} id
   */
  async start(id) {
    if (!this._registry.has(id)) {
      throw new Error(`Scene not registered: ${id}`);
    }
    this.unloadCurrentScene();
    await this._activate(id);
    this._applyCameraFromScene();
    return this.currentScene;
  }

  /**
   * @param {string} id
   * @param {{ transition?: TransitionType, duration?: number, force?: boolean }} [options]
   * @returns {Promise<import('../scenes/SceneBase.js').SceneBase | null>}
   */
  async transitionTo(id, options = {}) {
    if (this._transition) {
      return null;
    }
    if (this.currentSceneId === id && !options.force) {
      return this.currentScene;
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
        startSceneScale:
          this.currentScene?.scene.scale.clone() ?? new THREE.Vector3(1, 1, 1),
      };
    });
  }

  /** @deprecated use transitionTo */
  goTo(id, options) {
    return this.transitionTo(id, options);
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
        const nextId = tr.targetId;
        if (this.currentScene) {
          this.currentScene.onExit(nextId);
        }
        this.unloadCurrentScene({ skipOnExit: true });
        await this._activate(nextId);
        if (tr.type === 'warp' && this.currentScene) {
          this.currentScene.scene.scale.set(0.2, 0.2, 0.2);
        }
      } catch (err) {
        tr.reject(err);
        this._transition = null;
        return;
      }
    }

    if (tr.swapped && tr.type === 'warp' && this.currentScene) {
      const inT = Math.max((tr.elapsed - half) / half, 0);
      const eased = applyEasing('easeOutCubic', Math.min(inT, 1));
      const scale = 0.2 + eased * 0.8;
      this.currentScene.scene.scale.set(scale, scale, scale);
    }

    if (tr.elapsed >= tr.duration) {
      this._overlay.style.opacity = '0';
      this.camera.fov = tr.startCameraFov;
      this.camera.updateProjectionMatrix();
      this._applyCameraFromScene();
      this.camera.rotation.set(0, 0, 0);
      if (this.currentScene) {
        this.currentScene.scene.scale.set(1, 1, 1);
      }
      const scene = this.currentScene;
      tr.resolve(scene);
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

    if (tr.phase === 'out' && this.currentScene) {
      const pull = 1 - eased * 0.65;
      this.currentScene.scene.scale.copy(tr.startSceneScale).multiplyScalar(pull);
      this.camera.position.z = tr.startCameraPos.z * (1 - eased * 0.4);
      this.camera.rotation.y = eased * 0.6;
    } else if (tr.swapped && this.currentScene) {
      this.camera.position.z = tr.startCameraPos.z * (0.6 + eased * 0.4);
      this.camera.rotation.y = (1 - eased) * 0.6;
    }

    this.camera.fov = tr.startCameraFov + Math.sin(t * Math.PI) * 8;
    this.camera.updateProjectionMatrix();
  }

  _applyCameraFromScene() {
    const cam =
      this.currentScene?.cameraPosition ??
      this.currentScene?.scene.userData?.cameraPosition;
    if (cam) {
      this.camera.position.copy(cam);
    }
  }

  /**
   * @param {number} delta
   */
  update(delta) {
    this._elapsed += delta;

    if (this._transition) {
      this._advanceTransition(delta);
    }

    this.currentScene?.update(delta);
    this.animationSystem?.update(delta);
    this.effectsManager?.update(delta);
  }

  render() {
    if (!this.currentScene) {
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
    this.unloadCurrentScene();
    this._overlay.remove();
    this._registry.clear();
  }
}

/**
 * @typedef {{
 *   type: TransitionType,
 *   duration: number,
 *   elapsed: number,
 *   phase: 'out' | 'in',
 *   swapped: boolean,
 *   resolve: (scene: import('../scenes/SceneBase.js').SceneBase | null) => void,
 *   reject: (err: unknown) => void,
 *   targetId: string,
 *   startCameraPos: THREE.Vector3,
 *   startCameraFov: number,
 *   startSceneScale: THREE.Vector3,
 * }} TransitionState
 */
