import { VRMExpressionPresetName } from '@pixiv/three-vrm';

/**
 * Nexaris expression aliases → VRM preset names.
 */
export const VRM_EXPRESSION_ALIASES = {
  neutral: VRMExpressionPresetName.Neutral,
  happy: VRMExpressionPresetName.Happy,
  angry: VRMExpressionPresetName.Angry,
  sad: VRMExpressionPresetName.Sad,
  surprised: VRMExpressionPresetName.Surprised,
  relaxed: VRMExpressionPresetName.Relaxed,
  blink: VRMExpressionPresetName.Blink,
  blinkLeft: VRMExpressionPresetName.BlinkLeft,
  blinkRight: VRMExpressionPresetName.BlinkRight,
  aa: VRMExpressionPresetName.Aa,
  a: VRMExpressionPresetName.Aa,
  ih: VRMExpressionPresetName.Ih,
  i: VRMExpressionPresetName.Ih,
  ou: VRMExpressionPresetName.Ou,
  u: VRMExpressionPresetName.Ou,
  ee: VRMExpressionPresetName.Ee,
  e: VRMExpressionPresetName.Ee,
  oh: VRMExpressionPresetName.Oh,
  o: VRMExpressionPresetName.Oh,
};

/** @typedef {keyof typeof VRM_EXPRESSION_ALIASES} VRMExpressionAlias */

/**
 * @param {string} name
 * @returns {string}
 */
export function resolveExpressionName(name) {
  const key = /** @type {VRMExpressionAlias} */ (name.toLowerCase());
  return VRM_EXPRESSION_ALIASES[key] ?? name;
}

/**
 * @param {import('@pixiv/three-vrm').VRM} vrm
 * @returns {string[]}
 */
export function listAvailableExpressions(vrm) {
  if (!vrm.expressionManager) return [];
  return Object.keys(vrm.expressionManager.expressionMap);
}
