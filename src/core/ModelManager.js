import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';

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
   * Clone a cached model for instancing in the scene.
   * Uses SkeletonUtils for skinned / animated assets.
   * @param {string} url
   * @returns {Promise<ClonedModel>}
   */
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
    this._pending.clear();
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
