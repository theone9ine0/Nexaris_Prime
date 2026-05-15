import * as THREE from 'three';
import { ShardManager } from '../shards/ShardManager.js';
import { ClusterManager } from '../clusters/ClusterManager.js';
import { disposeSceneGraph } from '../core/disposeSceneGraph.js';
import { modelManager } from '../core/ModelManager.js';

/**
 * Base class for Nexaris dimensions. Each subclass owns a THREE.Scene and world systems.
 */
export class SceneBase {
  /**
   * @param {string} id unique scene key
   */
  constructor(id) {
    this.id = id;
    this.scene = new THREE.Scene();
    this.cameraPosition = new THREE.Vector3(0, 0, 4);
    this.shardManager = null;
    this.clusterManager = null;
    /** @type {THREE.Scene | null} CSS3D overlay scene (set by SceneManager) */
    this.cssScene = null;
    /** @type {import('../core/ModelManager.js').ModelManager | null} */
    this.modelManager = null;
    /** @type {import('../avatars/AvatarController.js').AvatarController | null} */
    this.player = null;
    /** @type {import('../npc/NPCManager.js').NPCManager | null} */
    this.npcManager = null;
    this._built = false;
    this._elapsed = 0;
  }

  /**
   * @param {import('../avatars/AvatarController.js').AvatarController | null} avatar
   */
  setPlayer(avatar) {
    this.player = avatar;
  }

  /**
   * Create shards, clusters, lights, and environment. Called once before enter.
   */
  build() {
    if (this._built) return this;

    this.scene.background = this.scene.background ?? new THREE.Color(0x000000);
    this.scene.userData.cameraPosition = this.cameraPosition;

    this.shardManager = new ShardManager(this.scene, null, this.cssScene);
    this.clusterManager = new ClusterManager(this.scene);
    this._buildContent();
    this._built = true;
    return this;
  }

  /**
   * Override to populate the scene graph.
   */
  _buildContent() {}

  /**
   * @param {string | null} previousSceneId
   */
  onEnter(previousSceneId) {
    this._elapsed = 0;
  }

  /**
   * @param {string | null} nextSceneId
   */
  onExit(nextSceneId) {}

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this._elapsed += deltaTime;
    this.player?.update(deltaTime);
    this.npcManager?.update(deltaTime);
  }

  /**
   * @param {import('../effects/EffectsManager.js').EffectsManager} _effectsManager
   */
  configureEffects(_effectsManager) {}

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem | null} animationSystem
   * @param {import('../effects/EffectsManager.js').EffectsManager | null} effectsManager
   */
  bindSystems(animationSystem, effectsManager) {
    this.shardManager?.setAnimationSystem(animationSystem);
    this.clusterManager?.setAnimationSystem(animationSystem);
    if (effectsManager) {
      this.configureEffects(effectsManager);
    }
  }

  dispose() {
    this._disposePlayer();
    this.npcManager?.dispose();
    this.npcManager = null;
    this.shardManager?.clear();
    this.clusterManager?.clear();
    disposeSceneGraph(this.scene);
    this.shardManager = null;
    this.clusterManager = null;
    this._built = false;
  }

  _disposePlayer() {
    if (!this.player) return;
    this.player.dispose();
    modelManager.disposeClone(this.player.object);
    this.setPlayer(null);
  }
}
