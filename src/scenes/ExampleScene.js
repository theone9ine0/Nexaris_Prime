import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { SAMPLE_FOX_GLB } from '../assets/modelUrls.js';

/**
 * Minimal test dimension — shards, clusters, and PR30 GLB clones.
 */
export class ExampleScene extends SceneBase {
  constructor() {
    super('example');
    this.cameraPosition.set(0, 0.2, 5);
    this.scene.background = new THREE.Color(0x050510);
    /** @type {THREE.Object3D[]} */
    this._modelClones = [];
    this._modelsLoading = false;
  }

  _buildContent() {
    this.scene.add(new THREE.AmbientLight(0x223355, 0.6));
    const key = new THREE.DirectionalLight(0xaaccff, 1.1);
    key.position.set(2, 4, 3);
    this.scene.add(key);

    this.shardManager.createShard({
      id: 'example_a',
      color: 0x88aaff,
      position: { x: -0.8, y: 0.3, z: 0.5 },
      animation: 'pulse',
    });

    this.shardManager.createShard({
      id: 'example_b',
      color: 0x66ccff,
      position: { x: 0.8, y: -0.2, z: 0.6 },
      animation: 'glow',
    });

    this.clusterManager.createCluster({
      id: 'example_cluster',
      layout: 'circle',
      layoutOptions: { radius: 0.8 },
      position: { x: 0, y: 0, z: -1.5 },
      animation: ['rotate'],
      shardSpecs: [
        { id: 'ex_c1', color: 0x5577cc, animation: 'pulse' },
        { id: 'ex_c2', color: 0x6688dd, animation: 'pulse' },
        { id: 'ex_c3', color: 0x7799ee, animation: 'pulse' },
      ],
    });
  }

  /**
   * @param {string | null} previousSceneId
   */
  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    this._loadExampleModels();
  }

  /**
   * @param {string | null} nextSceneId
   */
  onExit(nextSceneId) {
    this._disposeExampleModels();
    super.onExit(nextSceneId);
  }

  async _loadExampleModels() {
    if (this._modelsLoading || this._modelClones.length > 0) return;
    this._modelsLoading = true;

    const placements = [
      { x: -1.2, y: -0.4, z: 0.2, rotY: 0.4 },
      { x: 0, y: -0.5, z: 0.5, rotY: 0 },
      { x: 1.2, y: -0.4, z: 0.2, rotY: -0.4 },
    ];

    try {
      for (let i = 0; i < placements.length; i++) {
        const { object, animations } = await modelManager.cloneModel(SAMPLE_FOX_GLB);
        const p = placements[i];
        object.position.set(p.x, p.y, p.z);
        object.rotation.y = p.rotY;
        object.scale.setScalar(0.008);
        object.userData.exampleCloneIndex = i;

        if (animations.length > 0) {
          object.userData.animationClips = animations;
          object.userData.hasSkinnedAnimation = true;
        }

        this.scene.add(object);
        this._modelClones.push(object);
      }
    } catch (err) {
      console.warn('[ExampleScene] GLB load failed:', err);
    } finally {
      this._modelsLoading = false;
    }
  }

  _disposeExampleModels() {
    for (const clone of this._modelClones) {
      modelManager.disposeClone(clone);
    }
    this._modelClones = [];
    this._modelsLoading = false;
  }

  configureEffects(effects) {
    effects.applyPreset({
      bloom: { strength: 0.35, radius: 0.5, threshold: 0.22 },
      colorGrading: {
        saturation: 1.05,
        tint: 0x7a9ec8,
        tintStrength: 0.12,
        vignette: 0.2,
      },
    });
  }
}
