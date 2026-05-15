import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { VRMUtils } from '@pixiv/three-vrm';
import { nexarisVRMLoader } from '../vrm/VRMLoader.js';

/**
 * @typedef {import('three/examples/jsm/loaders/GLTFLoader.js').GLTF} GLTF
 */

/**
 * @typedef {{
 *   gltf: GLTF,
 *   scene: THREE.Group,
 *   animations: THREE.AnimationClip[],
 * }} CachedModelEntry
 */

/**
 * @typedef {{
 *   object: THREE.Object3D,
 *   animations: THREE.AnimationClip[],
 * }} ClonedModel
 */

/**
 * @typedef {import('@pixiv/three-vrm').VRM} VRM
 */

/**
 * @typedef {{
 *   vrm: VRM,
 *   meta: import('@pixiv/three-vrm-core').VRMMeta,
 *   animations: THREE.AnimationClip[],
 * }} CachedVRMEntry
 */

/**
 * @typedef {{
 *   vrm: VRM,
 *   object: THREE.Object3D,
 *   animations: THREE.AnimationClip[],
 *   metadata: import('@pixiv/three-vrm-core').VRMMeta,
 * }} ClonedVRM
 */

/**
 * @typedef {{
 *   dracoPath?: string | false,
 * }} ModelManagerOptions
 */

const DEFAULT_DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

/**
 * PR30 — load, cache, and clone GLB/GLTF assets for characters, props, and environments.
 */
export class ModelManager {
  /**
   * @param {ModelManagerOptions} [options]
   */
  constructor(options = {}) {
    /** @type {Map<string, CachedModelEntry>} */
    this._cache = new Map();
    /** @type {Map<string, Promise<GLTF>>} */
    this._pending = new Map();

    /** @type {Map<string, CachedVRMEntry>} */
    this._vrmCache = new Map();
    /** @type {Map<string, ArrayBuffer>} */
    this._vrmBuffers = new Map();
    /** @type {Map<string, Promise<VRM>>} */
    this._vrmPending = new Map();

    this._loader = new GLTFLoader();

    if (options.dracoPath !== false) {
      this._dracoLoader = new DRACOLoader();
      this._dracoLoader.setDecoderPath(options.dracoPath ?? DEFAULT_DRACO_PATH);
      this._loader.setDRACOLoader(this._dracoLoader);
    }
  }

  /**
   * @param {string} url
   * @returns {CachedModelEntry | null}
   */
  getCached(url) {
    return this._cache.get(url) ?? null;
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  isLoaded(url) {
    return this._cache.has(url);
  }

  /**
   * Load a GLB/GLTF file (cached). Returns the raw GLTF result.
   * @param {string} url
   * @returns {Promise<GLTF>}
   */
  loadModel(url) {
    if (!url) {
      return Promise.reject(new Error('loadModel requires a url'));
    }

    const cached = this._cache.get(url);
    if (cached) {
      return Promise.resolve(cached.gltf);
    }

    const inflight = this._pending.get(url);
    if (inflight) {
      return inflight;
    }

    const promise = new Promise((resolve, reject) => {
      this._loader.load(
        url,
        (gltf) => {
          try {
            this._prepareSceneGraph(gltf.scene);
            const animations = gltf.animations?.length
              ? [...gltf.animations]
              : [];

            this._cache.set(url, {
              gltf,
              scene: gltf.scene,
              animations,
            });
            this._pending.delete(url);
            resolve(gltf);
          } catch (err) {
            this._pending.delete(url);
            reject(err);
          }
        },
        undefined,
        (error) => {
          this._pending.delete(url);
          const message = error instanceof Error ? error.message : String(error);
          reject(new Error(`ModelManager failed to load "${url}": ${message}`));
        },
      );
    });

    this._pending.set(url, promise);
    return promise;
  }

  /**
   * Load and clone a model, returning object + animation clips for avatars / NPCs.
   * @param {string} url
   * @returns {Promise<ClonedModel>}
   */
  async loadCharacter(url) {
    return this.cloneModel(url);
  }

  /**
   * Clone a model for NPC spawning (alias).
   * @param {string} url
   * @returns {Promise<ClonedModel>}
   */
  async loadNPC(url) {
    return this.cloneModel(url);
  }

  /**
   * Load a clone for avatar part swapping (skinned or static meshes).
   * @param {string} url
   * @returns {Promise<ClonedModel>}
   */
  async loadAvatarPart(url) {
    return this.cloneModel(url);
  }

  /**
   * Clone a cached model for instancing in the scene.
   * Uses SkeletonUtils for skinned / animated assets.
   * @param {string} url
   * @returns {Promise<ClonedModel>}
   */
  /**
   * @param {string} url
   * @returns {Promise<VRM>}
   */
  async loadVRM(url) {
    if (!url) {
      return Promise.reject(new Error('loadVRM requires a url'));
    }

    const cached = this._vrmCache.get(url);
    if (cached) {
      return cached.vrm;
    }

    const inflight = this._vrmPending.get(url);
    if (inflight) {
      return inflight;
    }

    const promise = this._fetchAndParseVRM(url).then((entry) => {
      this._vrmCache.set(url, entry);
      this._vrmPending.delete(url);
      return entry.vrm;
    });

    this._vrmPending.set(url, promise);
    return promise;
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  isVRMLoaded(url) {
    return this._vrmCache.has(url);
  }

  /**
   * @param {string} url
   * @returns {CachedVRMEntry | null}
   */
  getCachedVRM(url) {
    return this._vrmCache.get(url) ?? null;
  }

  /**
   * Instantiate a new VRM from cached buffer (humanoid, blendshapes, spring bones).
   * @param {string} url
   * @returns {Promise<ClonedVRM>}
   */
  async cloneVRM(url) {
    await this.loadVRM(url);
    const entry = await this._createVRMInstance(url);
    const object = entry.vrm.scene;
    object.name = `${object.name || 'vrm'}_clone`;
    object.userData.vrm = entry.vrm;
    object.userData.modelUrl = url;
    object.userData.isVRM = true;

    const animations = entry.animations.map((clip) => clip.clone());
    object.userData.animations = animations;
    object.userData.animationClips = animations;

    return {
      vrm: entry.vrm,
      object,
      animations,
      metadata: entry.meta,
    };
  }

  /**
   * @param {string} url
   * @returns {Promise<CachedVRMEntry>}
   */
  async _fetchAndParseVRM(url) {
    const buffer = await this._fetchVRMBuffer(url);
    return this._parseVRMBuffer(url, buffer, true);
  }

  /**
   * @param {string} url
   * @returns {Promise<CachedVRMEntry>}
   */
  async _createVRMInstance(url) {
    const buffer = await this._fetchVRMBuffer(url);
    return this._parseVRMBuffer(url, buffer, false);
  }

  /**
   * @param {string} url
   * @returns {Promise<ArrayBuffer>}
   */
  async _fetchVRMBuffer(url) {
    const cached = this._vrmBuffers.get(url);
    if (cached) return cached;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ModelManager failed to fetch VRM "${url}": ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    this._vrmBuffers.set(url, buffer);
    return buffer;
  }

  /**
   * @param {string} url
   * @param {ArrayBuffer} buffer
   * @param {boolean} cacheTemplate
   * @returns {Promise<CachedVRMEntry>}
   */
  async _parseVRMBuffer(url, buffer, cacheTemplate) {
    const { vrm, gltf } = await nexarisVRMLoader.parse(buffer, url);

    this._prepareSceneGraph(vrm.scene);
    vrm.scene.traverse((child) => {
      child.frustumCulled = true;
    });

    const animations = gltf.animations?.length ? [...gltf.animations] : [];

    if (cacheTemplate) {
      vrm.scene.userData.isVRMTemplate = true;
    }

    return { vrm, meta: vrm.meta, animations };
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  unloadVRM(url) {
    const entry = this._vrmCache.get(url);
    if (!entry) return false;

    VRMUtils.deepDispose(entry.vrm);
    this._vrmCache.delete(url);
    this._vrmBuffers.delete(url);
    return true;
  }

  /**
   * @param {THREE.Object3D} object
   */
  disposeVRMClone(object) {
    const vrm = object.userData?.vrm;
    object.parent?.remove(object);
    if (vrm) {
      VRMUtils.deepDispose(vrm);
    }
  }

  async cloneModel(url) {
    await this.loadModel(url);
    const entry = this._cache.get(url);
    if (!entry) {
      throw new Error(`Model not in cache after load: ${url}`);
    }

    const object = cloneSkinnedModel(entry.scene);
    object.name = `${entry.scene.name || 'model'}_clone`;

    const animations = entry.animations.map((clip) => clip.clone());
    object.userData.animations = animations;
    object.userData.animationClips = animations;
    object.userData.modelUrl = url;

    return { object, animations };
  }

  /**
   * @param {string[]} urls
   * @returns {Promise<GLTF[]>}
   */
  async preload(urls) {
    const results = await Promise.allSettled(urls.map((url) => this.loadModel(url)));
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(
        `[ModelManager] preload: ${failures.length}/${urls.length} failed`,
        failures.map((f) => /** @type {PromiseRejectedResult} */ (f).reason),
      );
    }
    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => /** @type {PromiseFulfilledResult<GLTF>} */ (r).value);
  }

  /**
   * @param {string} url
   * @returns {boolean}
   */
  unload(url) {
    const entry = this._cache.get(url);
    if (!entry) return false;

    entry.scene.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        ModelManager._disposeMaterial(child.material);
      }
    });
    this._cache.delete(url);
    return true;
  }

  clear() {
    for (const url of [...this._cache.keys()]) {
      this.unload(url);
    }
    for (const url of [...this._vrmCache.keys()]) {
      this.unloadVRM(url);
    }
    this._pending.clear();
    this._vrmPending.clear();
  }

  /**
   * Remove a clone from the scene graph and dispose GPU resources unique to the clone.
   * @param {THREE.Object3D} object
   */
  disposeClone(object) {
    object.parent?.remove(object);
    object.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        ModelManager._disposeMaterial(child.material);
      }
    });
  }

  /**
   * @param {THREE.Object3D} root
   */
  _prepareSceneGraph(root) {
    root.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const mat of materials) {
            if (mat && 'side' in mat) {
              mat.side = THREE.FrontSide;
            }
          }
        }
      }
    });
  }

  /**
   * @param {THREE.Material | THREE.Material[] | undefined} material
   */
  static _disposeMaterial(material) {
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const mat of list) {
      mat.dispose();
      for (const key of Object.keys(mat)) {
        const value = mat[key];
        if (value?.isTexture) {
          value.dispose();
        }
      }
    }
  }

  dispose() {
    this.clear();
    this._dracoLoader?.dispose();
  }
}

/** Shared instance for scenes and main.js */
export const modelManager = new ModelManager();
