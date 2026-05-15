import * as THREE from 'three';
import { NPC } from './NPC.js';

/**
 * @typedef {import('../core/ModelManager.js').ModelManager} ModelManager
 * @typedef {import('../core/AnimationMixerManager.js').AnimationMixerManager} AnimationMixerManager
 */

/**
 * @typedef {import('./NPC.js').NPCOptions} NPCSpawnOptions
 */

/**
 * PR33 — spawn and update NPC instances in a scene.
 */
export class NPCManager {
  /**
   * @param {THREE.Scene} scene
   * @param {AnimationMixerManager} mixerManager
   * @param {ModelManager} modelManager
   */
  constructor(scene, mixerManager, modelManager) {
    this.scene = scene;
    this.mixerManager = mixerManager;
    this.modelManager = modelManager;

    /** @type {Set<import('./NPC.js').NPC>} */
    this.npcs = new Set();
    this._idCounter = 0;
  }

  /**
   * @param {string} url model URL
   * @param {THREE.Vector3 | { x?: number, y?: number, z?: number }} position
   * @param {Omit<NPCSpawnOptions, 'object' | 'animations' | 'mixerManager'>} [options]
   * @returns {Promise<import('./NPC.js').NPC>}
   */
  async spawnNPC(url, position, options = {}) {
    const { object, animations } = await this.modelManager.cloneModel(url);
    const pos =
      position instanceof THREE.Vector3
        ? position
        : new THREE.Vector3(position.x ?? 0, position.y ?? 0, position.z ?? 0);

    object.position.copy(pos);
    if (options.scale != null) {
      const s = options.scale;
      if (typeof s === 'number') {
        object.scale.setScalar(s);
      } else {
        object.scale.set(s.x ?? 1, s.y ?? 1, s.z ?? 1);
      }
    }

    this.scene.add(object);

    const npc = new NPC({
      object,
      animations,
      mixerManager: this.mixerManager,
      id: options.id ?? `npc_${this._idCounter++}`,
      ...options,
    });

    this.npcs.add(npc);
    return npc;
  }

  /**
   * @param {import('./NPC.js').NPC} npc
   */
  removeNPC(npc) {
    if (!this.npcs.has(npc)) return;

    npc.dispose();
    this.modelManager.disposeClone(npc.object);
    this.npcs.delete(npc);
  }

  /**
   * @returns {import('./NPC.js').NPC[]}
   */
  getAllNPCs() {
    return [...this.npcs];
  }

  /**
   * @param {THREE.Object3D} playerObject
   */
  setFollowTarget(playerObject) {
    for (const npc of this.npcs) {
      if (npc.state === 'followPlayer') {
        npc.setTarget(playerObject);
      }
    }
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    for (const npc of this.npcs) {
      npc.update(deltaTime);
    }
  }

  clear() {
    for (const npc of [...this.npcs]) {
      this.removeNPC(npc);
    }
  }

  dispose() {
    this.clear();
  }
}
