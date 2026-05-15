import * as THREE from 'three';
import { getSlotDef } from '../avatars/avatarSlots.js';
import { StylizedFaceMesh } from './templates/StylizedFaceMesh.js';

/**
 * Applies stylized face textures + overlay mesh to VRM while preserving rig & spring bones.
 */
export class VRMFaceApplicator {
  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {import('./types.js').StylizedFaceResult} faceResult
   * @param {import('../vrm/VRMAvatar.js').VRMAvatar | null} [vrmAvatar]
   */
  static apply(vrm, faceResult, vrmAvatar = null) {
    VRMFaceApplicator.applyHeadTexture(vrm, faceResult.texture);
    VRMFaceApplicator._applyHairTint(vrm, faceResult.params.hairColor);

    const headBone =
      vrm.humanoid?.getNormalizedBoneNode('head') ??
      vrm.humanoid?.getRawBoneNode('head') ??
      null;

    if (headBone) {
      const existing = headBone.getObjectByName('NexarisStylizedFace');
      existing?.traverse((c) => {
        if (c.isMesh) {
          c.geometry?.dispose();
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => m?.dispose());
        }
      });
      existing?.removeFromParent();

      const overlay = new StylizedFaceMesh(faceResult.params);
      overlay.attachToHead(headBone);
      vrm.scene.userData.stylizedFaceMesh = overlay.root;
    }

    vrm.scene.userData.faceStylized = true;
    vrm.scene.userData.stylizedFaceParams = faceResult.params;

    if (vrmAvatar) {
      vrmAvatar.applyStylizedFace(faceResult.params, {
        eyeGlow: 0.35,
        smileBias: 0.08,
      });
    }
  }

  /**
   * Apply texture only to head/face meshes (not full body).
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {THREE.Texture} texture
   */
  static applyHeadTexture(vrm, texture) {
    const patterns = getSlotDef('head').meshPatterns;
    let applied = 0;

    vrm.scene.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();
      const isHead = patterns.some((p) => name.includes(p));
      if (!isHead) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat) continue;
        if ('map' in mat) {
          mat.map = texture;
          mat.needsUpdate = true;
        }
        if ('emissive' in mat && mat.emissive) {
          mat.emissive.setHex(0x223344);
          mat.emissiveIntensity = 0.08;
        }
        if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.5, 0.72);
        applied++;
      }
    });

    if (applied === 0) {
      console.warn('[VRMFaceApplicator] No head materials matched; applying to first mesh with map');
      vrm.scene.traverse((child) => {
        if (!child.isMesh || applied > 0) return;
        const mat = child.material;
        if (mat && 'map' in mat) {
          mat.map = texture;
          mat.needsUpdate = true;
          applied++;
        }
      });
    }

    vrm.scene.userData.stylizedFaceTexture = texture;
    return applied;
  }

  /**
   * @param {import('@pixiv/three-vrm').VRM} vrm
   * @param {number} hairColor
   */
  static _applyHairTint(vrm, hairColor) {
    const patterns = getSlotDef('hair').meshPatterns;
    const color = new THREE.Color(hairColor);

    vrm.scene.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();
      if (!patterns.some((p) => name.includes(p))) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (mat && 'color' in mat) {
          mat.color.lerp(color, 0.55);
          mat.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Remove stylized face overlay from VRM.
   * @param {import('@pixiv/three-vrm').VRM} vrm
   */
  static removeOverlay(vrm) {
    const headBone =
      vrm.humanoid?.getNormalizedBoneNode('head') ??
      vrm.humanoid?.getRawBoneNode('head') ??
      null;
    const overlay = headBone?.getObjectByName('NexarisStylizedFace');
    overlay?.removeFromParent();
    vrm.scene.userData.stylizedFaceMesh = null;
  }
}
