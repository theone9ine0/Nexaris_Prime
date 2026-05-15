import * as THREE from 'three';
import { getSlotDef, AVATAR_SLOTS } from './avatarSlots.js';
import { avatarPresetStore } from './presetStore.js';

/**
 * @typedef {import('../core/ModelManager.js').ModelManager} ModelManager
 */

/**
 * @typedef {{
 *   baseColor?: string | number,
 *   emissive?: string | number,
 *   emissiveIntensity?: number,
 *   metalness?: number,
 *   roughness?: number,
 *   map?: string,
 * }} MaterialConfig
 */

/**
 * @typedef {{
 *   id?: string,
 *   url: string,
 *   bone: string,
 *   position?: { x?: number, y?: number, z?: number },
 *   rotation?: { x?: number, y?: number, z?: number },
 *   scale?: number | { x?: number, y?: number, z?: number },
 * }} AccessoryConfig
 */

/**
 * @typedef {{
 *   version?: number,
 *   colors?: Record<string, string | number>,
 *   materials?: Record<string, MaterialConfig>,
 *   parts?: Record<string, string>,
 *   accessories?: AccessoryConfig[],
 * }} AvatarCustomizationConfig
 */

/**
 * @typedef {{
 *   baseObject: THREE.Object3D,
 *   modelManager: ModelManager,
 *   customization?: AvatarCustomizationConfig,
 *   presetStore?: import('./presetStore.js').AvatarPresetStore,
 * }} AvatarCustomizerOptions
 */

const CONFIG_VERSION = 1;

/**
 * PR34 — modular avatar part swapping, materials, accessories, and presets.
 */
export class AvatarCustomizer {
  /**
   * @param {AvatarCustomizerOptions} options
   */
  constructor(options) {
    this.object = options.baseObject;
    this.modelManager = options.modelManager;
    this.presetStore = options.presetStore ?? avatarPresetStore;

    this.skeleton = AvatarCustomizer._findSkeleton(this.object);

    /** @type {Map<string, THREE.Object3D[]>} */
    this._meshesBySlot = new Map();
    /** @type {Map<string, THREE.Group>} */
    this._partRoots = new Map();
    /** @type {Map<string, string>} */
    this._partUrls = new Map();
    /** @type {Map<string, THREE.Group>} */
    this._accessories = new Map();
    /** @type {AccessoryConfig[]} */
    this._accessoryConfigs = [];
    /** @type {Map<string, string | number>} */
    this._colors = new Map();
    /** @type {Map<string, MaterialConfig>} */
    this._materialConfigs = new Map();
    /** @type {Set<THREE.Object3D>} */
    this._hiddenOriginals = new Set();
    /** @type {Map<string, THREE.Material[]>} */
    this._slotMaterials = new Map();
    /** @type {Map<string, THREE.Material>} */
    this._materialPool = new Map();

    this._indexSlotMeshes();

    if (options.customization) {
      this.applyCustomization(options.customization).catch((err) => {
        console.warn('[AvatarCustomizer] Initial customization failed:', err);
      });
    }
  }

  /**
   * @param {AvatarCustomizationConfig} config
   */
  async applyCustomization(config) {
    if (config.colors) {
      for (const [slot, color] of Object.entries(config.colors)) {
        this.setColor(slot, color);
      }
    }

    if (config.materials) {
      for (const [slot, matCfg] of Object.entries(config.materials)) {
        this.setMaterial(slot, matCfg);
      }
    }

    if (config.parts) {
      for (const [slot, url] of Object.entries(config.parts)) {
        await this.setPart(slot, url);
      }
    }

    if (config.accessories?.length) {
      await this.clearAccessories();
      for (const acc of config.accessories) {
        await this.attachAccessory(acc.url, acc.bone, acc);
      }
    }
  }

  /**
   * @param {string} slot
   * @param {string} modelUrl
   */
  async setPart(slot, modelUrl) {
    getSlotDef(slot);

    const { object: partRoot } = await this.modelManager.cloneModel(modelUrl);
    partRoot.name = `avatar_part_${slot}`;

    const anchor = this._getOrCreatePartRoot(slot);
    this._clearPartChildren(anchor);

    const skinnedMeshes = [];
    const staticMeshes = [];
    partRoot.traverse((child) => {
      if (child.isSkinnedMesh) skinnedMeshes.push(child);
      else if (child.isMesh) staticMeshes.push(child);
    });

    let extractedMeshes = false;

    if (skinnedMeshes.length > 0 && this.skeleton) {
      extractedMeshes = true;
      for (const mesh of skinnedMeshes) {
        mesh.removeFromParent();
        AvatarCustomizer._rebindSkinnedMesh(mesh, this.skeleton);
        anchor.add(mesh);
      }
    } else if (staticMeshes.length > 0) {
      extractedMeshes = true;
      const bone = AvatarCustomizer._findBoneForSlot(this.object, slot);
      const parent = bone ?? anchor;
      for (const mesh of staticMeshes) {
        mesh.removeFromParent();
        parent.add(mesh);
      }
    } else {
      partRoot.removeFromParent();
      anchor.add(partRoot);
    }

    this._hideSlotMeshes(slot);
    this._partUrls.set(slot, modelUrl);

    if (extractedMeshes) {
      this.modelManager.disposeClone(partRoot);
    }
  }

  /**
   * @param {string} slot
   * @param {MaterialConfig} materialConfig
   */
  setMaterial(slot, materialConfig) {
    getSlotDef(slot);
    this._materialConfigs.set(slot, { ...materialConfig });

    const meshes = this._getMeshesForSlot(slot);
    for (const mesh of meshes) {
      const materials = this._ensureMeshMaterials(mesh, slot);
      for (const mat of materials) {
        AvatarCustomizer._applyMaterialConfig(mat, materialConfig);
      }
    }
  }

  /**
   * @param {string} slot
   * @param {string | number} color
   */
  setColor(slot, color) {
    getSlotDef(slot);
    this._colors.set(slot, color);

    const meshes = this._getMeshesForSlot(slot);
    const threeColor = new THREE.Color(color);

    for (const mesh of meshes) {
      const materials = this._ensureMeshMaterials(mesh, slot);
      for (const mat of materials) {
        if ('color' in mat) mat.color.copy(threeColor);
      }
    }
  }

  /**
   * @param {string} modelUrl
   * @param {string} boneName
   * @param {Omit<AccessoryConfig, 'url' | 'bone'> & { id?: string }} [options]
   * @returns {Promise<string>}
   */
  async attachAccessory(modelUrl, boneName, options = {}) {
    const id = options.id ?? `acc_${this._accessories.size}_${boneName}`;
    const { object } = await this.modelManager.cloneModel(modelUrl);

    const anchor = new THREE.Group();
    anchor.name = `accessory_${id}`;

    const bone =
      this.object.getObjectByName(boneName) ??
      AvatarCustomizer._findBone(this.object, [boneName]);

    if (bone) {
      bone.add(anchor);
    } else {
      this.object.add(anchor);
      console.warn(
        `[AvatarCustomizer] Bone "${boneName}" not found; accessory parented to avatar root.`,
      );
    }

    anchor.add(object);

    if (options.position) {
      anchor.position.set(
        options.position.x ?? 0,
        options.position.y ?? 0,
        options.position.z ?? 0,
      );
    }
    if (options.rotation) {
      anchor.rotation.set(
        options.rotation.x ?? 0,
        options.rotation.y ?? 0,
        options.rotation.z ?? 0,
      );
    }
    if (options.scale !== undefined) {
      if (typeof options.scale === 'number') {
        anchor.scale.setScalar(options.scale);
      } else {
        anchor.scale.set(
          options.scale.x ?? 1,
          options.scale.y ?? 1,
          options.scale.z ?? 1,
        );
      }
    }

    this._accessories.set(id, anchor);
    this._accessoryConfigs.push({
      id,
      url: modelUrl,
      bone: boneName,
      position: options.position,
      rotation: options.rotation,
      scale: options.scale,
    });

    return id;
  }

  /**
   * @param {string} id
   */
  detachAccessory(id) {
    const anchor = this._accessories.get(id);
    if (!anchor) return;

    anchor.parent?.remove(anchor);
    anchor.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
      }
    });
    this._accessories.delete(id);
    this._accessoryConfigs = this._accessoryConfigs.filter((a) => a.id !== id);
  }

  async clearAccessories() {
    for (const id of [...this._accessories.keys()]) {
      this.detachAccessory(id);
    }
  }

  /**
   * @returns {AvatarCustomizationConfig}
   */
  exportConfig() {
    return {
      version: CONFIG_VERSION,
      colors: Object.fromEntries(this._colors),
      materials: Object.fromEntries(this._materialConfigs),
      parts: Object.fromEntries(this._partUrls),
      accessories: this._accessoryConfigs.map((a) => ({ ...a })),
    };
  }

  /**
   * @param {string | AvatarCustomizationConfig} jsonOrConfig
   */
  async importConfig(jsonOrConfig) {
    const config =
      typeof jsonOrConfig === 'string' ? JSON.parse(jsonOrConfig) : jsonOrConfig;
    await this.applyCustomization(config);
  }

  /**
   * @param {string} name
   * @param {AvatarCustomizationConfig} [config]
   */
  savePreset(name, config) {
    this.presetStore.savePreset(name, config ?? this.exportConfig());
  }

  /**
   * @param {string} name
   */
  async loadPreset(name) {
    const config = this.presetStore.loadPreset(name);
    if (!config) {
      throw new Error(`Avatar preset not found: ${name}`);
    }
    await this.applyCustomization(config);
    return config;
  }

  dispose() {
    for (const id of [...this._accessories.keys()]) {
      this.detachAccessory(id);
    }
    for (const [, root] of this._partRoots) {
      root.parent?.remove(root);
    }
    this._partRoots.clear();
    this._restoreHiddenMeshes();
    this._slotMaterials.clear();
    for (const mat of this._materialPool.values()) {
      mat.dispose();
    }
    this._materialPool.clear();
  }

  _indexSlotMeshes() {
    for (const slot of Object.keys(AVATAR_SLOTS)) {
      const meshes = AvatarCustomizer._collectMeshesForSlot(this.object, slot);
      if (meshes.length > 0) {
        this._meshesBySlot.set(slot, meshes);
      }
    }

    if (!this._meshesBySlot.has('body')) {
      const fallback = [];
      this.object.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) fallback.push(child);
      });
      if (fallback.length) this._meshesBySlot.set('body', fallback);
    }
  }

  /**
   * @param {string} slot
   * @returns {THREE.Object3D[]}
   */
  _getMeshesForSlot(slot) {
    return this._meshesBySlot.get(slot) ?? this._meshesBySlot.get('body') ?? [];
  }

  /**
   * @param {string} slot
   * @returns {THREE.Group}
   */
  _getOrCreatePartRoot(slot) {
    let root = this._partRoots.get(slot);
    if (!root) {
      root = new THREE.Group();
      root.name = `avatar_slot_${slot}`;
      this.object.add(root);
      this._partRoots.set(slot, root);
    }
    return root;
  }

  /**
   * @param {THREE.Group} anchor
   */
  _clearPartChildren(anchor) {
    while (anchor.children.length > 0) {
      const child = anchor.children[0];
      anchor.remove(child);
      if (child.isMesh || child.isSkinnedMesh) {
        child.geometry?.dispose();
      }
    }
  }

  /**
   * @param {string} slot
   */
  _hideSlotMeshes(slot) {
    for (const mesh of this._getMeshesForSlot(slot)) {
      mesh.visible = false;
      this._hiddenOriginals.add(mesh);
    }
  }

  _restoreHiddenMeshes() {
    for (const mesh of this._hiddenOriginals) {
      mesh.visible = true;
    }
    this._hiddenOriginals.clear();
  }

  /**
   * @param {THREE.Object3D} root
   * @returns {THREE.Skeleton | null}
   */
  static _findSkeleton(root) {
    let skeleton = null;
    root.traverse((child) => {
      if (!skeleton && child.isSkinnedMesh?.skeleton) {
        skeleton = child.skeleton;
      }
    });
    return skeleton;
  }

  /**
   * @param {THREE.SkinnedMesh} mesh
   * @param {THREE.Skeleton} skeleton
   */
  static _rebindSkinnedMesh(mesh, skeleton) {
    mesh.skeleton = skeleton;
    mesh.bind(skeleton, mesh.bindMatrix);
  }

  /**
   * @param {THREE.Object3D} root
   * @param {string} slot
   * @returns {THREE.Object3D[]}
   */
  static _collectMeshesForSlot(root, slot) {
    const def = getSlotDef(slot);
    const meshes = [];
    root.traverse((child) => {
      if (!child.isMesh && !child.isSkinnedMesh) return;
      const name = child.name.toLowerCase();
      if (def.meshPatterns.some((p) => name.includes(p.toLowerCase()))) {
        meshes.push(child);
      }
    });
    return meshes;
  }

  /**
   * @param {THREE.Object3D} root
   * @param {string} slot
   * @returns {THREE.Bone | null}
   */
  static _findBoneForSlot(root, slot) {
    const def = getSlotDef(slot);
    for (const pattern of def.bonePatterns) {
      const bone = AvatarCustomizer._findBone(root, [pattern]);
      if (bone) return bone;
    }
    return null;
  }

  /**
   * @param {THREE.Object3D} root
   * @param {string[]} patterns
   * @returns {THREE.Bone | null}
   */
  static _findBone(root, patterns) {
    let found = null;
    root.traverse((node) => {
      if (found || !node.isBone) return;
      const lower = node.name.toLowerCase();
      for (const pattern of patterns) {
        const p = pattern.toLowerCase();
        if (lower === p || lower.includes(p) || lower.endsWith(`:${p}`)) {
          found = node;
          break;
        }
      }
    });
    return found;
  }

  /**
   * @param {THREE.Mesh | THREE.SkinnedMesh} mesh
   * @param {string} slot
   * @returns {THREE.Material[]}
   */
  _ensureMeshMaterials(mesh, slot) {
    const raw = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const result = [];

    const pool = this._materialPool;

    for (let i = 0; i < raw.length; i++) {
      const base = raw[i];
      if (!base) continue;
      const poolKey = `${slot}:${base.uuid}`;
      let mat = pool.get(poolKey);
      if (!mat) {
        mat = base.clone();
        mat.name = `${base.name || 'mat'}_${slot}`;
        pool.set(poolKey, mat);
      }
      result.push(mat);
    }

    mesh.material = result.length === 1 ? result[0] : result;
    return result;
  }

  /**
   * @param {THREE.Material} mat
   * @param {MaterialConfig} config
   */
  static _applyMaterialConfig(mat, config) {
    if (config.baseColor !== undefined && 'color' in mat) {
      mat.color.set(config.baseColor);
    }
    if (config.emissive !== undefined && 'emissive' in mat) {
      mat.emissive.set(config.emissive);
    }
    if (config.emissiveIntensity !== undefined && 'emissiveIntensity' in mat) {
      mat.emissiveIntensity = config.emissiveIntensity;
    }
    if (config.metalness !== undefined && 'metalness' in mat) {
      mat.metalness = config.metalness;
    }
    if (config.roughness !== undefined && 'roughness' in mat) {
      mat.roughness = config.roughness;
    }
    mat.needsUpdate = true;
  }
}
