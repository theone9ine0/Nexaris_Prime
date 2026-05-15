import * as THREE from 'three';
import { SAMPLE_VRM_URL } from '../assets/modelUrls.js';
import { modelManager } from '../core/ModelManager.js';
import { REQUIRED_PHOTO_SLOTS } from './types.js';
import { MockReconstructionPipeline } from './mock/MockReconstructionPipeline.js';
import { MockTextureStitcher } from './mock/MockTextureStitcher.js';
import { VRMRiggingHelper } from './mock/VRMRiggingHelper.js';
import { FaceStylizer } from '../stylizer/FaceStylizer.js';
import { FaceTextureGenerator } from '../stylizer/FaceTextureGenerator.js';

/**
 * @typedef {import('./types.js').PhotoSet} PhotoSet
 * @typedef {import('./types.js').PhotoPreviewSet} PhotoPreviewSet
 * @typedef {import('./types.js').BodyEstimate} BodyEstimate
 * @typedef {import('../avatars/AvatarCustomizer.js').AvatarCustomizationConfig} AvatarCustomizationConfig
 * @typedef {import('@pixiv/three-vrm').VRM} VRM
 */

/**
 * Shared scan session for cross-scene avatar spawn (PR43).
 */
export const scanSession = {
  /** @type {string | null} */
  lastScanUrl: null,
  /** @type {string | null} */
  lastScanId: null,
  /** @type {AvatarCustomizationConfig | null} */
  lastCustomization: null,
  /** @type {HTMLCanvasElement | null} */
  lastStitchedCanvas: null,
  /** @type {import('../stylizer/types.js').StylizedFaceParams | null} */
  lastFaceStylization: null,
  /** @type {HTMLCanvasElement | null} */
  lastFaceTextureCanvas: null,
};

/**
 * PR43 — mock photogrammetry → stylized VRM pipeline.
 */
export class AvatarScanManager {
  /**
   * @param {{
   *   templateVrmUrl?: string,
   *   modelManager?: import('../core/ModelManager.js').ModelManager,
   * }} [options]
   */
  constructor(options = {}) {
    this.templateVrmUrl = options.templateVrmUrl ?? SAMPLE_VRM_URL;
    this.modelManager = options.modelManager ?? modelManager;

    this._reconstruction = new MockReconstructionPipeline();
    this._stitcher = new MockTextureStitcher();
    this.faceStylizer = new FaceStylizer();

    /** @type {PhotoSet} */
    this.photoSet = {};
    /** @type {PhotoPreviewSet} */
    this.previewUrls = {};
    /** @type {THREE.Group | null} */
    this.placeholderMesh = null;
    /** @type {BodyEstimate | null} */
    this.bodyEstimate = null;
    /** @type {HTMLCanvasElement | null} */
    this.stitchedCanvas = null;
    /** @type {THREE.CanvasTexture | null} */
    this.stitchedTexture = null;
    /** @type {ArrayBuffer | null} */
    this._exportBuffer = null;

    this.scanId = null;
    this.scanUrl = null;
    this.status = 'idle';
    this.progress = 0;

    /** @type {AvatarCustomizationConfig} */
    this.customizationConfig = {
      version: 1,
      colors: { body: 0xaaccff },
      materials: {
        body: { emissiveIntensity: 0.2, roughness: 0.72 },
      },
    };

    /** @type {((progress: number, message: string) => void) | null} */
    this.onProgress = null;

    /** @type {import('../stylizer/types.js').StylizedFaceResult | null} */
    this.faceStylizationResult = null;
    this.faceStylized = false;
  }

  /**
   * @returns {boolean}
   */
  hasFrontPhoto() {
    return !!this.photoSet.front;
  }

  /**
   * PR45 — stylize face from front photo (anime, non-realistic).
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} [vrmAvatar]
   */
  async stylizeFace(vrm, vrmAvatar = null) {
    const front = this.photoSet.front;
    if (!front) {
      throw new Error('Front face photo required for stylization');
    }

    this._setProgress(0.1, 'Extracting stylized features…');
    await this.faceStylizer.stylizeFromPhoto(front, vrm, vrmAvatar);
    this.faceStylizationResult = this.faceStylizer.result;
    this.faceStylized = true;

    const params = this.faceStylizationResult.params;
    this.applyCustomization({
      colors: {
        head: params.skinGradient.base,
        hair: params.hairColor,
        body: this.customizationConfig.colors?.body ?? 0xaaccff,
      },
      materials: {
        head: { emissiveIntensity: 0.12, roughness: 0.78 },
        hair: { roughness: 0.65 },
      },
    });

    scanSession.lastFaceStylization = params;
    scanSession.lastFaceTextureCanvas = this.faceStylizationResult.canvas;

    this._setProgress(1, 'Stylized face applied!');
    return this.faceStylizationResult;
  }

  /**
   * Re-apply saved face stylization from scanSession (cross-scene).
   * @param {VRM} vrm
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} [vrmAvatar]
   */
  async restoreFaceStylization(vrm, vrmAvatar = null) {
    const params = scanSession.lastFaceStylization;
    const canvas = scanSession.lastFaceTextureCanvas;
    if (!params || !canvas) return null;

    const { texture } = FaceTextureGenerator.generate(params);
    this.faceStylizationResult = { mesh: null, texture, canvas, params };
    this.faceStylized = true;
    VRMRiggingHelper.applyStylizedFace(vrm, this.faceStylizationResult, vrmAvatar);
    return this.faceStylizationResult;
  }

  /**
   * @param {PhotoSet} photoSet
   * @returns {PhotoPreviewSet}
   */
  loadPhotos(photoSet) {
    this._revokePreviews();
    this.photoSet = { ...photoSet };
    this.previewUrls = {};

    for (const [slot, file] of Object.entries(photoSet)) {
      if (file) {
        this.previewUrls[/** @type {keyof PhotoPreviewSet} */ (slot)] =
          URL.createObjectURL(file);
      }
    }

    this.status = 'loaded';
    return { ...this.previewUrls };
  }

  /**
   * @returns {boolean}
   */
  hasRequiredPhotos() {
    return REQUIRED_PHOTO_SLOTS.every((s) => this.photoSet[s]);
  }

  /**
   * @returns {Promise<THREE.Group>}
   */
  async generateMesh() {
    this._setProgress(0.15, 'Reconstructing stylized mesh…');
    const { mesh, bodyEstimate } = await this._reconstruction.reconstructMesh(this.photoSet);
    this.placeholderMesh = mesh;
    this.bodyEstimate = bodyEstimate;
    this._setProgress(0.35, 'Mesh ready (mock).');
    return mesh;
  }

  /**
   * @returns {Promise<THREE.CanvasTexture>}
   */
  async generateTexture() {
    this._setProgress(0.45, 'Stitching textures…');
    this.stitchedCanvas = await this._stitcher.stitch(this.previewUrls);
    this.stitchedTexture?.dispose();
    this.stitchedTexture = new THREE.CanvasTexture(this.stitchedCanvas);
    this.stitchedTexture.colorSpace = THREE.SRGBColorSpace;
    this._setProgress(0.6, 'Texture stitched.');
    return this.stitchedTexture;
  }

  /**
   * Full pipeline: mesh → texture → VRM registration.
   * @returns {Promise<{ scanId: string, scanUrl: string }>}
   */
  async buildScannedVRM() {
    if (!this.hasRequiredPhotos()) {
      throw new Error('Missing required photos (front, left, right, back)');
    }

    this.status = 'processing';
    this.scanId = `scan_${Date.now().toString(36)}`;

    if (!this.placeholderMesh) await this.generateMesh();
    if (!this.stitchedTexture && !this.stitchedCanvas) await this.generateTexture();

    this._setProgress(0.72, 'Rigging VRM humanoid…');
    await this._reconstruction.estimateBody();

    const buffer = await this.modelManager.fetchVRMBuffer(this.templateVrmUrl);
    this._exportBuffer = buffer.slice(0);

    await this.modelManager.registerScanVRM(this.scanId, this._exportBuffer);
    this.scanUrl = this.modelManager.getScanUrl(this.scanId);

    scanSession.lastScanId = this.scanId;
    scanSession.lastScanUrl = this.scanUrl;
    scanSession.lastCustomization = { ...this.customizationConfig };
    scanSession.lastStitchedCanvas = this.stitchedCanvas;

    this._setProgress(1, 'Stylized VRM ready!');
    this.status = 'complete';
    return { scanId: this.scanId, scanUrl: this.scanUrl };
  }

  /**
   * Apply scan look to a cloned VRM instance.
   * @param {VRM} vrm
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} [vrmAvatar]
   */
  applyScanToVRM(vrm, vrmAvatar = null) {
    if (!this.scanId) return;

    VRMRiggingHelper.applyScanMetadata(vrm, {
      scanId: this.scanId,
      bodyEstimate: this.bodyEstimate ?? undefined,
      displayName: 'Nexaris Scan Avatar',
    });

    if (this.stitchedCanvas || this.stitchedTexture) {
      VRMRiggingHelper.applyStylizedTexture(
        vrm,
        this.stitchedTexture ?? this.stitchedCanvas,
      );
    }

    VRMRiggingHelper.applyScanExpressions(vrm, vrmAvatar);

    if (this.faceStylized && this.faceStylizationResult) {
      VRMRiggingHelper.applyStylizedFace(vrm, this.faceStylizationResult, vrmAvatar);
    }
  }

  /**
   * @param {AvatarCustomizationConfig} config
   */
  applyCustomization(config) {
    this.customizationConfig = {
      ...this.customizationConfig,
      ...config,
      colors: { ...this.customizationConfig.colors, ...config.colors },
      materials: { ...this.customizationConfig.materials, ...config.materials },
      parts: { ...this.customizationConfig.parts, ...config.parts },
      accessories: config.accessories ?? this.customizationConfig.accessories,
    };
    scanSession.lastCustomization = { ...this.customizationConfig };
  }

  /**
   * @param {import('../avatars/AvatarController.js').AvatarController} avatar
   */
  async applyCustomizationToAvatar(avatar) {
    const customizer = avatar.getCustomizer();
    if (!customizer) return;
    await customizer.applyCustomization(this.customizationConfig);
  }

  /**
   * Mock VRM export (template buffer + scan metadata filename).
   * @returns {Promise<{ blob: Blob, filename: string }>}
   */
  async exportVRM() {
    if (!this._exportBuffer) {
      this._exportBuffer = await this.modelManager.fetchVRMBuffer(this.templateVrmUrl);
    }

    const blob = new Blob([this._exportBuffer], { type: 'application/octet-stream' });
    const filename = `nexaris-stylized-${this.scanId ?? 'avatar'}.vrm`;
    return { blob, filename };
  }

  /**
   * Trigger browser download of exported VRM.
   */
  async downloadVRM() {
    const { blob, filename } = await this.exportVRM();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * @param {number} p
   * @param {string} message
   */
  _setProgress(p, message) {
    this.progress = p;
    this.onProgress?.(p, message);
  }

  _revokePreviews() {
    for (const url of Object.values(this.previewUrls)) {
      if (url) URL.revokeObjectURL(url);
    }
  }

  dispose() {
    this._revokePreviews();
    this.stitchedTexture?.dispose();
    this.placeholderMesh = null;
    this.faceStylizer.dispose();
  }
}
