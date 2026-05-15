import * as THREE from 'three';
import { VRMFaceApplicator } from '../../stylizer/VRMFaceApplicator.js';

/**
 * PR43 mock VRM rigging / metadata helpers (builds on PR35 loader output).
 */
export class VRMRiggingHelper {
  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {{
   *   scanId: string,
   *   bodyEstimate?: import('../types.js').BodyEstimate,
   *   displayName?: string,
   * }} options
   */
  static applyScanMetadata(vrm, options) {
    const scene = vrm.scene;
    scene.userData.scanId = options.scanId;
    scene.userData.isScannedAvatar = true;
    scene.userData.stylized = true;
    scene.userData.bodyEstimate = options.bodyEstimate ?? null;

    try {
      if (vrm.meta) {
        vrm.meta.title = options.displayName ?? 'Nexaris Scan Avatar';
      }
    } catch {
      scene.userData.scanTitle = options.displayName ?? 'Nexaris Scan Avatar';
    }

    VRMRiggingHelper._ensureHumanoidMapped(vrm);
    VRMRiggingHelper._applySpringDefaults(vrm);
    VRMRiggingHelper._ensureBlendshapePresets(vrm);
  }

  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   */
  static _ensureHumanoidMapped(vrm) {
    const humanoid = vrm.humanoid;
    if (!humanoid) return;

    const required = ['hips', 'spine', 'head', 'leftUpperArm', 'rightUpperArm'];
    for (const bone of required) {
      const node = humanoid.getNormalizedBoneNode(bone);
      if (!node) {
        console.warn(`[VRMRiggingHelper] Missing humanoid bone: ${bone}`);
      }
    }
  }

  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   */
  static _applySpringDefaults(vrm) {
    const manager = vrm.springBoneManager;
    if (!manager?.joints?.length) return;

    for (const joint of manager.joints) {
      if (!joint?.settings) continue;
      joint.settings.stiffness = Math.min(joint.settings.stiffness * 1.05, 2);
      joint.settings.gravityPower = joint.settings.gravityPower ?? 0.4;
    }
  }

  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   */
  static _ensureBlendshapePresets(vrm) {
    const em = vrm.expressionManager;
    if (!em) return;

    const names = em.expressions.map((e) => e.expressionName);
    if (!names.includes('neutral')) {
      try {
        em.setValue('neutral', 0);
      } catch {
        // preset may use different naming
      }
    }
  }

  /**
   * Apply stitched scan texture with stylized material treatment.
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {THREE.Texture | HTMLCanvasElement} textureSource
   */
  static applyStylizedTexture(vrm, textureSource) {
    const texture =
      textureSource instanceof THREE.Texture
        ? textureSource
        : new THREE.CanvasTexture(textureSource);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    let applied = 0;
    vrm.scene.traverse((child) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat || !('map' in mat)) continue;
        mat.map = texture;
        if ('emissive' in mat && mat.emissive) {
          mat.emissive.setHex(0x223355);
          mat.emissiveIntensity = 0.12;
        }
        if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.5, 0.68);
        if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0.3, 0.2);
        mat.needsUpdate = true;
        applied++;
      }
    });

    if (applied === 0) {
      console.warn('[VRMRiggingHelper] No materials updated for scan texture');
    }

    vrm.scene.userData.scanTexture = texture;
    return texture;
  }

  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} vrmAvatar
   */
  /**
   * PR45 — apply stylized anime face to VRM head.
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {import('../../stylizer/types.js').StylizedFaceResult} faceResult
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} [vrmAvatar]
   */
  static applyStylizedFace(vrm, faceResult, vrmAvatar = null) {
    VRMFaceApplicator.apply(vrm, faceResult, vrmAvatar);
    vrm.scene.userData.faceStylized = true;
  }

  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} vrmAvatar
   */
  static applyScanExpressions(vrm, vrmAvatar) {
    if (!vrmAvatar) return;
    vrmAvatar.setScanExpressionProfile({
      neutral: 0,
      happy: 0.12,
      relaxed: 0.06,
    });
    vrmAvatar.applyScanPresentation({ eyeGlow: 0.5, hairLift: 0.4 });
    vrmAvatar.playExpression('happy', 0.45, 'neutral');
  }
}
