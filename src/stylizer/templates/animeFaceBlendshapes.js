import { VRM_EXPRESSION_ALIASES } from '../../vrm/vrmExpressions.js';

/**
 * VRM-compatible expression presets for stylized face preview / lip-sync.
 */
export const ANIME_FACE_BLENDSHAPES = {
  blink: { preset: VRM_EXPRESSION_ALIASES.blink, weight: 1 },
  smile: { preset: VRM_EXPRESSION_ALIASES.happy, weight: 0.65 },
  angry: { preset: VRM_EXPRESSION_ALIASES.angry, weight: 0.7 },
  sad: { preset: VRM_EXPRESSION_ALIASES.sad, weight: 0.65 },
  surprised: { preset: VRM_EXPRESSION_ALIASES.surprised, weight: 0.55 },
  aa: { preset: VRM_EXPRESSION_ALIASES.aa, weight: 0.8 },
  ih: { preset: VRM_EXPRESSION_ALIASES.ih, weight: 0.8 },
  ou: { preset: VRM_EXPRESSION_ALIASES.ou, weight: 0.8 },
  ee: { preset: VRM_EXPRESSION_ALIASES.ee, weight: 0.8 },
  oh: { preset: VRM_EXPRESSION_ALIASES.oh, weight: 0.8 },
};

/** @typedef {keyof typeof ANIME_FACE_BLENDSHAPES} AnimeFaceBlendshapeName */

/**
 * @param {string} name
 * @returns {{ preset: string, weight: number } | null}
 */
export function resolveAnimeBlendshape(name) {
  const key = /** @type {AnimeFaceBlendshapeName} */ (name.toLowerCase());
  return ANIME_FACE_BLENDSHAPES[key] ?? null;
}
