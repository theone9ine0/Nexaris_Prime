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

/** Default Nexaris visual style: soft glow, subtle blue tint. */
export const NEXARIS_EFFECTS_PRESET = {
  bloom: { strength: 0.38, radius: 0.52, threshold: 0.22 },
  colorGrading: {
    saturation: 1.08,
    contrast: 1.04,
    brightness: 0.0,
    tint: 0x7a9ec8,
    tintStrength: 0.14,
    vignette: 0.26,
  },
};

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
 * Modular PR3 post-processing: RenderPass → Bloom → Color grading → Output.
 */
export class EffectsManager {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{ resolutionScale?: number }} [options]
   */
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this._resolutionScale = options.resolutionScale ?? 1;

    this._bloomEnabled = true;
    this._colorGradingEnabled = true;
    this._bloom = { ...NEXARIS_EFFECTS_PRESET.bloom };
    this._colorGrading = { ...NEXARIS_EFFECTS_PRESET.colorGrading };

    this._bloomLayer = new THREE.Layers();
    this._bloomLayer.set(BLOOM_LAYER);
    /** @type {Map<string, { object: THREE.Object3D, options: ObjectEffectOptions, meshes: THREE.Mesh[] }>} */
    this._objectEffects = new Map();
    this._darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    /** @type {Record<string, THREE.Material | THREE.Material[]>} */
    this._savedMaterials = {};

    const { width, height } = this._getSize();

    this._renderPass = new RenderPass(scene, camera);

    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      this._bloom.strength,
      this._bloom.radius,
      this._bloom.threshold,
    );

    this._colorGradingPass = new ShaderPass(ColorGradingShader);
    this._outputPass = new OutputPass();

    /** @type {EffectComposer} */
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(this._renderPass);
    this.composer.addPass(this._bloomPass);
    this.composer.addPass(this._colorGradingPass);
    this.composer.addPass(this._outputPass);

    // Selective bloom path (when per-object glow/bloom is registered)
    this._bloomComposer = new EffectComposer(renderer);
    this._bloomComposer.renderToScreen = false;
    this._bloomComposer.addPass(new RenderPass(scene, camera));
    this._selectiveBloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      this._bloom.strength,
      this._bloom.radius,
      this._bloom.threshold,
    );
    this._bloomComposer.addPass(this._selectiveBloomPass);

    this._mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(BloomMixShader.uniforms),
        vertexShader: BloomMixShader.vertexShader,
        fragmentShader: BloomMixShader.fragmentShader,
      }),
      'baseTexture',
    );
    this._mixPass.needsSwap = true;

    this._colorGradingPassSelective = new ShaderPass(ColorGradingShader);
    this._selectiveComposer = new EffectComposer(renderer);
    this._selectiveComposer.addPass(new RenderPass(scene, camera));
    this._selectiveComposer.addPass(this._mixPass);
    this._selectiveComposer.addPass(this._colorGradingPassSelective);
    this._selectiveComposer.addPass(new OutputPass());

    this._configureRenderer();
    this._applyColorGradingUniforms();
    this._syncBloomPasses();
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
    return {
      width: size.x || window.innerWidth,
      height: size.y || window.innerHeight,
    };
  }

  _composerSize(width, height) {
    return {
      width: Math.max(1, Math.floor(width * this._resolutionScale)),
      height: Math.max(1, Math.floor(height * this._resolutionScale)),
    };
  }

  _syncBloomPasses() {
    const strength = this._bloomEnabled ? this._bloom.strength : 0;
    for (const pass of [this._bloomPass, this._selectiveBloomPass]) {
      pass.strength = strength;
      pass.radius = this._bloom.radius;
      pass.threshold = this._bloom.threshold;
    }
    this._mixPass.uniforms.bloomStrength.value = strength;
  }

  _applyColorGradingUniforms() {
    const enabled = this._colorGradingEnabled;
    for (const pass of [this._colorGradingPass, this._colorGradingPassSelective]) {
      const u = pass.uniforms;
      const cg = this._colorGrading;
      u.saturation.value = enabled ? cg.saturation : 1;
      u.contrast.value = enabled ? cg.contrast : 1;
      u.brightness.value = cg.brightness;
      u.tint.value.set(cg.tint);
      u.tintStrength.value = enabled ? cg.tintStrength : 0;
      u.vignette.value = enabled ? cg.vignette : 0;
    }
  }

  enableBloom() {
    this._bloomEnabled = true;
    this._syncBloomPasses();
  }

  disableBloom() {
    this._bloomEnabled = false;
    this._syncBloomPasses();
  }

  /** @returns {boolean} */
  isBloomEnabled() {
    return this._bloomEnabled;
  }

  /**
   * @param {number} value
   */
  setBloomStrength(value) {
    this._bloom.strength = value;
    this._syncBloomPasses();
  }

  /**
   * @param {number} value
   */
  setBloomRadius(value) {
    this._bloom.radius = value;
    this._syncBloomPasses();
  }

  /**
   * @param {number} value
   */
  setBloomThreshold(value) {
    this._bloom.threshold = value;
    this._syncBloomPasses();
  }

  enableColorGrading() {
    this._colorGradingEnabled = true;
    this._applyColorGradingUniforms();
  }

  disableColorGrading() {
    this._colorGradingEnabled = false;
    this._applyColorGradingUniforms();
  }

  /**
   * @param {Partial<typeof NEXARIS_EFFECTS_PRESET.colorGrading>} options
   */
  setColorGrading(options = {}) {
    Object.assign(this._colorGrading, options);
    this._applyColorGradingUniforms();
  }

  /**
   * @param {number} scale 0.25–1, composer internal resolution scale
   */
  setResolutionScale(scale) {
    this._resolutionScale = Math.max(0.25, Math.min(1, scale));
    const { width, height } = this._getSize();
    this.setSize(width, height);
  }

  /**
   * @param {Partial<typeof NEXARIS_EFFECTS_PRESET>} preset
   */
  applyPreset(preset = NEXARIS_EFFECTS_PRESET) {
    if (preset.bloom) {
      Object.assign(this._bloom, preset.bloom);
      this._syncBloomPasses();
    }
    if (preset.colorGrading) {
      Object.assign(this._colorGrading, preset.colorGrading);
      this._applyColorGradingUniforms();
    }
  }

  /**
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

  removeObjectEffect(id) {
    const entry = this._objectEffects.get(id);
    if (!entry) return;
    entry.object.traverse((child) => {
      if (child.isMesh) child.layers.disable(BLOOM_LAYER);
    });
    delete entry.object.userData.effectsId;
    this._objectEffects.delete(id);
  }

  _hasSelectiveBloom() {
    if (!this._bloomEnabled) return false;
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
          mat.emissiveIntensity = base * boost;
        }
      }
    }
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  setSize(width, height) {
    const { width: cw, height: ch } = this._composerSize(width, height);
    this.composer.setSize(cw, ch);
    this._selectiveComposer.setSize(cw, ch);
    this._bloomComposer.setSize(cw, ch);
    this._bloomPass.setSize(cw, ch);
    this._selectiveBloomPass.setSize(cw, ch);
    this.renderer.setSize(width, height);
  }

  /** Render via EffectComposer (use instead of renderer.render). */
  render() {
    if (this._hasSelectiveBloom()) {
      this.scene.traverse(this._darkenNonBloomed.bind(this));
      this._bloomComposer.render();
      this.scene.traverse(this._restoreMaterial.bind(this));
      this._mixPass.uniforms.bloomTexture.value =
        this._bloomComposer.readBuffer.texture;
      this._selectiveComposer.render();
    } else {
      this.composer.render();
    }
  }

  dispose() {
    this.composer.dispose();
    this._selectiveComposer.dispose();
    this._bloomComposer.dispose();
    this._darkMaterial.dispose();
    this._mixPass.fullscreenMaterial.dispose();
    this._colorGradingPass.fullscreenMaterial?.dispose();
    this._colorGradingPassSelective.fullscreenMaterial?.dispose();
    this._objectEffects.clear();
  }
}
