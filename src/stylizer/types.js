/**
 * @typedef {{
 *   x: number,
 *   y: number,
 *   z?: number,
 * }} FaceLandmark
 */

/**
 * Extracted (heuristic) features from a front photo — used only for stylized mapping.
 * @typedef {{
 *   skinTone: number,
 *   hairColor: number,
 *   eyeColor: number,
 *   eyebrowCurve: number,
 *   faceWidth: number,
 *   faceHeight: number,
 *   eyeSpacing: number,
 *   eyeSize: number,
 * }} ExtractedFaceFeatures
 */

/**
 * Stylized anime-equivalent parameters (non-realistic).
 * @typedef {{
 *   skinGradient: { base: number, shadow: number, highlight: number },
 *   hairColor: number,
 *   eyeColor: number,
 *   eyeVariant: 'round' | 'almond' | 'wide',
 *   eyebrowStyle: 'soft' | 'sharp' | 'gentle',
 *   faceShape: 'oval' | 'round' | 'heart',
 *   blushIntensity: number,
 *   stylizationLevel: number,
 * }} StylizedFaceParams
 */

/**
 * @typedef {{
 *   landmarks: FaceLandmark[],
 *   extracted: ExtractedFaceFeatures,
 *   stylized: StylizedFaceParams,
 * }} FaceFeatureSet
 */

/**
 * @typedef {{
 *   mesh: import('three').Group,
 *   texture: import('three').CanvasTexture,
 *   canvas: HTMLCanvasElement,
 *   params: StylizedFaceParams,
 * }} StylizedFaceResult
 */

export const FACE_BLENDSHAPE_PRESETS = [
  'blink',
  'happy',
  'angry',
  'sad',
  'surprised',
  'aa',
  'ih',
  'ou',
  'ee',
  'oh',
];
