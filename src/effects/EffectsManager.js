import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ColorGradingShader } from './shaders/ColorGradingShader.js';
import { BloomMixShader } from './shaders/BloomMixShader.js';

/** Layer mask for selective per-object bloom. */
export const BLOOM_LAYER = 1;

/**
 * @typedef {{
 *   glow?: boolean,
 *   bloom?: boolean,
 *   pulseGlow?: boolean,
 *   emissive?: number | string,
 *   emissiveIntensity?: number,
 * }} ObjectEffectOptions
 */

/**
 * @typedef {{
 *   bloom?: { strength?: number, radius?: number, threshold?: number },
 *   colorGrading?: {
 *     saturation?: number,
 *     contrast?: number,
 *     brightness?: number,
 *     tint?: number | string,
 *     tintStrength?: number,
 *     vignette?: number,
 *   },
 *   glow?: { intensity?: number },
 * }} SceneEffectOptions
 */

/**
 * PR3 post-processing pipeline.
 *
 * Scene-wide: UnrealBloomPass + ColorGradingShader (+ ACES tone mapping).
 * Per-object: selective bloom layers + emissive glow / pulseGlow.
 *
 * Pipeline (no selective objects): RenderPass → Bloom → Grade → Output
 * Pipeline (selective bloom):      bloom pass + mix pass → Grade → Output
 */
export class EffectsManager {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const { width, height } = this._getSize();
    this._bloomLayer = new THREE.Layers();
    this._bloomLayer.set(BLOOM_LAYER);

    /** @type {Map<string, { object: THREE.Object3D, options: ObjectEffectOptions, meshes: THREE.Mesh[] }>} */
    this._objectEffects = new Map();

    this._darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    /** @type {Record<string, THREE.Material | THREE.Material[]>} */
    this._savedMaterials = {};

    this._sceneEffects = {
      bloom: { strength: 0.42, radius: 0.55, threshold: 0.18 },
      colorGrading: {
        saturation: 1.12,
        contrast: 1.06,
        brightness: 0.0,
        tint: 0x88aacc,
        tintStrength: 0.14,
        vignette: 0.28,
      },
      glow: { intensity: 1.0 },
    };

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      this._sceneEffects.bloom.strength,
      this._sceneEffects.bloom.radius,
      this._sceneEffects.bloom.threshold,
    );

    this._colorGradingPass = new ShaderPass(ColorGradingShader);
    this._outputPass = new OutputPass();

    // Scene-wide pipeline: render → bloom → grade → output
    this._simpleComposer = new EffectComposer(renderer);
    this._simpleComposer.addPass(new RenderPass(scene, camera));
    this._simpleComposer.addPass(this._bloomPass);
    this._simpleComposer.addPass(this._colorGradingPass);
    this._outputPassSimple = new OutputPass();
    this._simpleComposer.addPass(this._outputPassSimple);

    // Selective bloom pipeline (per-object layers)
    this._bloomComposer = new EffectComposer(renderer);
    this._bloomComposer.renderToScreen = false;
    this._bloomComposer.addPass(new RenderPass(scene, camera));
    this._bloomComposer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(width, height),
        this._sceneEffects.bloom.strength,
        this._sceneEffects.bloom.radius,
        this._sceneEffects.bloom.threshold,
      ),
    );
    this._selectiveBloomPass = this._bloomComposer.passes[1];

    this._mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(BloomMixShader.uniforms),
        vertexShader: BloomMixShader.vertexShader,
        fragmentShader: BloomMixShader.fragmentShader,
      }),
      'baseTexture',
    );
    this._mixPass.needsSwap = true;
    this._mixPass.uniforms.bloomStrength.value = this._getMixStrength();

    this._colorGradingPassSelective = new ShaderPass(ColorGradingShader);
    this._finalComposer = new EffectComposer(renderer);
    this._finalComposer.addPass(new RenderPass(scene, camera));
    this._finalComposer.addPass(this._mixPass);
    this._finalComposer.addPass(this._colorGradingPassSelective);
    this._finalComposer.addPass(new OutputPass());

    this._applyColorGradingUniforms();
    this._configureRenderer();
    this.setSize(width, height);
  }

  _configureRenderer() {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _getSize() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    return { width: size.x || window.innerWidth, height: size.y || window.innerHeight };
  }

  _getMixStrength() {
    return this._sceneEffects.bloom.strength * (this._sceneEffects.glow.intensity ?? 1);
  }

  _applyColorGradingUniforms() {
    for (const pass of [this._colorGradingPass, this._colorGradingPassSelective]) {
      const u = pass.uniforms;
      const cg = this._sceneEffects.colorGrading;
      u.saturation.value = cg.saturation;
      u.contrast.value = cg.contrast;
      u.brightness.value = cg.brightness;
      u.tint.value.set(cg.tint);
      u.tintStrength.value = cg.tintStrength;
      u.vignette.value = cg.vignette;
    }
  }

  /**
   * Scene-wide bloom, color grading, and glow intensity.
   * @param {SceneEffectOptions} options
   */
  setSceneEffects(options = {}) {
    if (options.bloom) {
      Object.assign(this._sceneEffects.bloom, options.bloom);
      const { strength, radius, threshold } = this._sceneEffects.bloom;
      for (const pass of [this._bloomPass, this._selectiveBloomPass]) {
        pass.strength = strength;
        pass.radius = radius;
        pass.threshold = threshold;
      }
      this._mixPass.uniforms.bloomStrength.value = this._getMixStrength();
    }
    if (options.colorGrading) {
      Object.assign(this._sceneEffects.colorGrading, options.colorGrading);
      this._applyColorGradingUniforms();
    }
    if (options.glow) {
      Object.assign(this._sceneEffects.glow, options.glow);
      this._mixPass.uniforms.bloomStrength.value = this._getMixStrength();
    }
  }

  /**
   * @param {string} id
   * @param {THREE.Object3D} object
   * @param {ObjectEffectOptions} options
   */
  /**
   * Per-shard wrapper around {@link EffectsManager.applyObjectEffect}.
   * @param {string} id
   * @param {import('../shards/Shard.js').Shard} shard
   * @param {ObjectEffectOptions} options
   */
  applyShardEffect(id, shard, options = {}) {
    return this.applyObjectEffect(id, shard.root, options);
  }

  /**
   * @param {string} id
   * @param {THREE.Object3D} object
   * @param {ObjectEffectOptions} options
   */
  applyObjectEffect(id, object, options = {}) {
    if (!id || !object) {
      throw new Error('applyObjectEffect requires id and object');
    }

    const meshes = [];
    object.traverse((child) => {
      if (!child.isMesh) return;
      meshes.push(child);

      if (options.bloom || options.glow) {
        child.layers.enable(BLOOM_LAYER);
      }

      const mat = child.material;
      if (!mat) return;

      if (options.emissive !== undefined && 'emissive' in mat) {
        mat.emissive = new THREE.Color(options.emissive);
      }
      if (options.emissiveIntensity !== undefined && 'emissiveIntensity' in mat) {
        mat.emissiveIntensity = options.emissiveIntensity;
      }
    });

    object.userData.effectsId = id;
    this._objectEffects.set(id, { object, options, meshes });
  }

  /**
   * @param {string} id
   */
  removeObjectEffect(id) {
    const entry = this._objectEffects.get(id);
    if (!entry) return;

    entry.object.traverse((child) => {
      if (child.isMesh) {
        child.layers.disable(BLOOM_LAYER);
      }
    });
    delete entry.object.userData.effectsId;
    this._objectEffects.delete(id);
  }

  /**
   * @param {string} id
   * @returns {ObjectEffectOptions | undefined}
   */
  getObjectEffect(id) {
    return this._objectEffects.get(id)?.options;
  }

  _hasSelectiveBloom() {
    for (const { options } of this._objectEffects.values()) {
      if (options.bloom || options.glow) return true;
    }
    return false;
  }

  _darkenNonBloomed(obj) {
    if (!obj.isMesh) return;
    if (!this._bloomLayer.test(obj.layers)) {
      this._savedMaterials[obj.uuid] = obj.material;
      obj.material = this._darkMaterial;
    }
  }

  _restoreMaterial(obj) {
    if (!obj.isMesh) return;
    if (this._savedMaterials[obj.uuid]) {
      obj.material = this._savedMaterials[obj.uuid];
      delete this._savedMaterials[obj.uuid];
    }
  }

  /**
   * @param {number} _delta
   */
  update(_delta) {
    const t = performance.now() * 0.001;
    const pulse = (Math.sin(t * 2.2) + 1) * 0.5;

    for (const { options, meshes } of this._objectEffects.values()) {
      if (!options.pulseGlow && !options.glow) continue;

      const boost = options.pulseGlow ? 0.6 + pulse * 0.9 : 1.0;
      const base = options.emissiveIntensity ?? 1.2;

      for (const mesh of meshes) {
        const mat = mesh.material;
        if (mat && 'emissiveIntensity' in mat) {
          mat.emissiveIntensity = base * boost * (this._sceneEffects.glow.intensity ?? 1);
        }
      }
    }
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  setSize(width, height) {
    this._simpleComposer.setSize(width, height);
    this._finalComposer.setSize(width, height);
    this._bloomComposer.setSize(width, height);
    this._bloomPass.setSize(width, height);
    this._selectiveBloomPass.setSize(width, height);
  }

  render() {
    if (this._hasSelectiveBloom()) {
      this.scene.traverse(this._darkenNonBloomed.bind(this));
      this._bloomComposer.render();
      this.scene.traverse(this._restoreMaterial.bind(this));

      this._mixPass.uniforms.bloomTexture.value =
        this._bloomComposer.readBuffer.texture;
      this._finalComposer.render();
    } else {
      this._simpleComposer.render();
    }
  }

  dispose() {
    this._simpleComposer.dispose();
    this._finalComposer.dispose();
    this._bloomComposer.dispose();
    this._darkMaterial.dispose();
    this._mixPass.fullscreenMaterial.dispose();
    this._colorGradingPass.fullscreenMaterial?.dispose();
    this._colorGradingPassSelective.fullscreenMaterial?.dispose();
    this._objectEffects.clear();
  }
}
