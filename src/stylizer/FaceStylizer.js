import { FaceLandmarkExtractor } from './FaceLandmarkExtractor.js';
import { FeatureMapper } from './FeatureMapper.js';
import { FaceTextureGenerator } from './FaceTextureGenerator.js';
import { VRMFaceApplicator } from './VRMFaceApplicator.js';
import { StylizedFaceMesh } from './templates/StylizedFaceMesh.js';

/**
 * PR45 — transforms a front face photo into a stylized, anime-inspired VRM face.
 * Non-realistic; heuristic feature extraction only (no deepfake / no photoreal reconstruction).
 */
export class FaceStylizer {
  constructor() {
    /** @type {File | Blob | null} */
    this.photo = null;
    /** @type {import('./types.js').FaceFeatureSet | null} */
    this.features = null;
    /** @type {import('./types.js').StylizedFaceResult | null} */
    this.result = null;
    this.status = 'idle';
  }

  /**
   * @param {File | Blob | HTMLImageElement} photo
   */
  async loadPhoto(photo) {
    this.photo = photo instanceof HTMLImageElement ? null : photo;
    this.features = null;
    this.result = null;
    this.status = 'loaded';
    if (photo instanceof HTMLImageElement) {
      this._imageElement = photo;
    } else {
      this._imageElement = null;
    }
  }

  /**
   * Extract landmarks + colors from loaded photo.
   * @returns {Promise<import('./types.js').FaceFeatureSet>}
   */
  async extractFeatures() {
    const source = this._imageElement ?? this.photo;
    if (!source) {
      throw new Error('No photo loaded. Call loadPhoto() first.');
    }

    const raw = await FaceLandmarkExtractor.extract(source);
    const extracted = {
      skinTone: raw.skinTone,
      hairColor: raw.hairColor,
      eyeColor: raw.eyeColor,
      eyebrowCurve: raw.eyebrowCurve,
      faceWidth: raw.faceWidth,
      faceHeight: raw.faceHeight,
      eyeSpacing: raw.eyeSpacing,
      eyeSize: raw.eyeSize,
    };

    const stylized = FeatureMapper.map(extracted);
    this.features = {
      landmarks: raw.landmarks,
      extracted,
      stylized,
    };
    this.status = 'features_ready';
    return this.features;
  }

  /**
   * Build stylized face mesh + toon texture from extracted features.
   * @returns {Promise<import('./types.js').StylizedFaceResult>}
   */
  async generateStylizedFace() {
    if (!this.features) {
      await this.extractFeatures();
    }

    const params = this.features.stylized;
    const { canvas, texture } = FaceTextureGenerator.generate(params);
    const meshBuilder = new StylizedFaceMesh(params);

    this.result = {
      mesh: meshBuilder.root,
      texture,
      canvas,
      params,
    };
    this.status = 'ready';
    return this.result;
  }

  /**
   * Apply stylized face to a loaded VRM instance.
   * @param {import('@pixiv/three-vrm').VRM} vrmModel
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} [vrmAvatar]
   * @returns {Promise<import('./types.js').StylizedFaceResult>}
   */
  async applyToVRM(vrmModel, vrmAvatar = null) {
    if (!this.result) {
      await this.generateStylizedFace();
    }

    VRMFaceApplicator.apply(vrmModel, this.result, vrmAvatar);
    this.status = 'applied';
    return this.result;
  }

  /**
   * One-shot: load → extract → generate → apply.
   * @param {File | Blob} photo
   * @param {import('@pixiv/three-vrm').VRM} vrmModel
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} [vrmAvatar]
   */
  async stylizeFromPhoto(photo, vrmModel, vrmAvatar = null) {
    await this.loadPhoto(photo);
    await this.extractFeatures();
    await this.generateStylizedFace();
    return this.applyToVRM(vrmModel, vrmAvatar);
  }

  dispose() {
    this.result?.texture?.dispose();
    this.result = null;
    this.features = null;
    this.photo = null;
    this._imageElement = null;
    this.status = 'idle';
  }
}
