import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { AnimationStateMachine } from '../core/AnimationStateMachine.js';
import { SAMPLE_FOX_GLB } from '../assets/modelUrls.js';

/** Khronos Fox clip names */
const FOX_CLIPS = {
  idle: 'Survey',
  walk: 'Walk',
  run: 'Run',
};

/**
 * Example dimension — shards, GLB clones, and PR31 skeletal animation demo.
 */
export class ExampleScene extends SceneBase {
  constructor() {
    super('example');
    this.cameraPosition.set(0, 0.2, 5);
    this.scene.background = new THREE.Color(0x050510);

    /** @type {THREE.Object3D[]} */
    this._modelClones = [];
    /** @type {THREE.Object3D | null} */
    this._heroModel = null;
    /** @type {AnimationStateMachine | null} */
    this._heroStateMachine = null;
    /** @type {object | null} */
    this._heroInteractive = null;
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

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem | null} animationSystem
   * @param {import('../effects/EffectsManager.js').EffectsManager | null} effectsManager
   */
  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;
    if (this._heroModel && animationSystem) {
      this._setupHeroAnimation(animationSystem);
    }
  }

  async _loadExampleModels() {
    if (this._modelsLoading || this._modelClones.length > 0) return;
    this._modelsLoading = true;

    const sidePlacements = [
      { x: -1.5, y: -0.45, z: 0.1, rotY: 0.5 },
      { x: 1.5, y: -0.45, z: 0.1, rotY: -0.5 },
    ];

    try {
      const { object, animations } = await modelManager.cloneModel(SAMPLE_FOX_GLB);
      object.position.set(0, -0.55, 0.6);
      object.rotation.y = 0;
      object.scale.setScalar(0.01);
      object.name = 'hero_fox';
      this.scene.add(object);
      this._heroModel = object;
      this._modelClones.push(object);

      if (this._animationSystem) {
        this._setupHeroAnimation(this._animationSystem);
      }

      for (let i = 0; i < sidePlacements.length; i++) {
        const { object: clone, animations: cloneAnims } =
          await modelManager.cloneModel(SAMPLE_FOX_GLB);
        const p = sidePlacements[i];
        clone.position.set(p.x, p.y, p.z);
        clone.rotation.y = p.rotY;
        clone.scale.setScalar(0.007);

        if (cloneAnims.length > 0 && this._animationSystem?.mixerManager) {
          const mm = this._animationSystem.mixerManager;
          mm.createMixer(clone, cloneAnims);
          const idle =
            cloneAnims.find((c) => c.name === FOX_CLIPS.idle)?.name ??
            cloneAnims[0].name;
          mm.play(clone, idle, { fadeIn: 0 });
        }

        this.scene.add(clone);
        this._modelClones.push(clone);
      }

      if (animations.length === 0) {
        console.warn('[ExampleScene] Fox model has no animation clips');
      }
    } catch (err) {
      console.warn('[ExampleScene] GLB load failed:', err);
    } finally {
      this._modelsLoading = false;
    }
  }

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem} animationSystem
   */
  _setupHeroAnimation(animationSystem) {
    if (!this._heroModel) return;

    const animations =
      this._heroModel.userData.animationClips ??
      this._heroModel.userData.animations ??
      [];

    const mm = animationSystem.mixerManager;
    mm.createMixer(this._heroModel, animations);

    const clipNames = mm.getClipNames(this._heroModel);
    const resolveClip = (preferred, fallback) =>
      clipNames.includes(preferred) ? preferred : fallback;

    const idleClip = resolveClip(FOX_CLIPS.idle, clipNames[0]);
    const walkClip = resolveClip(FOX_CLIPS.walk, idleClip);
    const runClip = resolveClip(FOX_CLIPS.run, walkClip);

    this._heroStateMachine?.dispose();
    this._heroStateMachine = new AnimationStateMachine(mm, this._heroModel, {
      defaultState: 'idle',
      crossfadeDuration: 0.3,
      states: {
        idle: { clip: idleClip, loop: THREE.LoopRepeat },
        walk: { clip: walkClip, loop: THREE.LoopRepeat, timeScale: 1 },
        run: { clip: runClip, loop: THREE.LoopRepeat, timeScale: 1.2 },
      },
    });
    this._heroStateMachine.setState('idle', 0);

    this._heroInteractive = this._createHeroInteractive(this._heroModel);
  }

  /**
   * @param {THREE.Object3D} root
   */
  _createHeroInteractive(root) {
    let hitMesh = null;
    root.traverse((child) => {
      if (child.isMesh && !hitMesh) hitMesh = child;
    });
    if (!hitMesh) return null;

    const self = this;
    const interactive = {
      id: 'hero_fox',
      mesh: hitMesh,
      onHoverEnter() {
        hitMesh.material.emissive?.setHex?.(0x224466);
        if (hitMesh.material.emissiveIntensity !== undefined) {
          hitMesh.material.emissiveIntensity = 0.35;
        }
      },
      onHoverExit() {
        if (hitMesh.material.emissiveIntensity !== undefined) {
          hitMesh.material.emissiveIntensity = 0.1;
        }
      },
      onClick() {
        self.triggerHeroEmote();
      },
    };

    hitMesh.userData.interactive = interactive;
    return interactive;
  }

  triggerHeroEmote() {
    const sm = this._heroStateMachine;
    if (!sm || !this._animationSystem) return;

    const clips = this._animationSystem.mixerManager.getClipNames(this._heroModel);
    const emoteClip = clips.includes(FOX_CLIPS.walk)
      ? FOX_CLIPS.walk
      : clips.includes(FOX_CLIPS.idle)
        ? FOX_CLIPS.idle
        : clips[0];

    if (emoteClip) {
      sm.triggerOneShot(emoteClip, { fadeIn: 0.12 });
    }
  }

  /**
   * InputSystem key handler (example scene only).
   * @param {string} code KeyboardEvent.code
   */
  handleKeyDown(code) {
    if (!this._heroStateMachine) return;

    if (code === 'KeyW') {
      this._heroStateMachine.setLocomotion('walk');
    }
    if (code === 'KeyR') {
      this._heroStateMachine.setLocomotion('run');
    }
    if (code === 'KeyI') {
      this._heroStateMachine.setLocomotion('idle');
    }
    if (code === 'KeyT') {
      this._heroStateMachine.toggleWalkRun();
    }
  }

  /**
   * @param {object} target interactive target from InteractionSystem
   */
  onInteractClick(target) {
    if (target === this._heroInteractive || target?.id === 'hero_fox') {
      this.triggerHeroEmote();
    }
  }

  _disposeExampleModels() {
    this._heroStateMachine?.dispose();
    this._heroStateMachine = null;
    this._heroInteractive = null;
    this._heroModel = null;

    if (this._animationSystem?.mixerManager) {
      for (const clone of this._modelClones) {
        this._animationSystem.mixerManager.removeMixer(clone);
      }
    }

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
