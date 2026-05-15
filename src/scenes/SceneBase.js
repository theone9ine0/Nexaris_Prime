import * as THREE from 'three';
import { ShardManager } from '../shards/ShardManager.js';
import { ClusterManager } from '../clusters/ClusterManager.js';
import { disposeSceneGraph } from '../core/disposeSceneGraph.js';

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
    this._built = false;
    this._elapsed = 0;
  }

  /**
   * Create shards, clusters, lights, and environment. Called once before enter.
   */
  build() {
    if (this._built) return this;

    this.scene.background = this.scene.background ?? new THREE.Color(0x000000);
    this.scene.userData.cameraPosition = this.cameraPosition;

    this.shardManager = new ShardManager(this.scene);
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
    this.shardManager?.clear();
    this.clusterManager?.clear();
    disposeSceneGraph(this.scene);
    this.shardManager = null;
    this.clusterManager = null;
    this._built = false;
  }
}
