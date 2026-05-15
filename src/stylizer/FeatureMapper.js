import * as THREE from 'three';

/**
 * Maps extracted photo features → stylized anime parameters (never photorealistic).
 */
export class FeatureMapper {
  /**
   * @param {import('./types.js').ExtractedFaceFeatures} extracted
   * @returns {import('./types.js').StylizedFaceParams}
   */
  static map(extracted) {
    const skin = new THREE.Color(extracted.skinTone);
    skin.offsetHSL(0, -0.15, 0.12);

    const shadow = skin.clone();
    shadow.offsetHSL(0, 0.02, -0.18);

    const highlight = skin.clone();
    highlight.offsetHSL(0.02, -0.1, 0.22);

    const hair = FeatureMapper._toonifyColor(extracted.hairColor, { satBoost: 0.25, lightBoost: 0.05 });
    const eyes = FeatureMapper._toonifyColor(extracted.eyeColor, { satBoost: 0.4, lightBoost: 0.1 });

    const aspect = extracted.faceWidth / Math.max(extracted.faceHeight, 0.01);
    let faceShape = 'oval';
    if (aspect > 0.92) faceShape = 'round';
    else if (aspect < 0.78) faceShape = 'heart';

    let eyeVariant = 'almond';
    if (extracted.eyeSize > 0.12) eyeVariant = 'wide';
    else if (extracted.eyeSpacing < 0.28) eyeVariant = 'round';

    let eyebrowStyle = 'soft';
    if (extracted.eyebrowCurve > 0.65) eyebrowStyle = 'sharp';
    else if (extracted.eyebrowCurve < 0.4) eyebrowStyle = 'gentle';

    return {
      skinGradient: {
        base: skin.getHex(),
        shadow: shadow.getHex(),
        highlight: highlight.getHex(),
      },
      hairColor: hair,
      eyeColor: eyes,
      eyeVariant,
      eyebrowStyle,
      faceShape,
      blushIntensity: THREE.MathUtils.clamp(0.25 + extracted.eyeSize * 1.5, 0.15, 0.55),
      stylizationLevel: 0.92,
    };
  }

  /**
   * @param {number} hex
   * @param {{ satBoost?: number, lightBoost?: number }} opts
   */
  static _toonifyColor(hex, opts = {}) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, opts.satBoost ?? 0.2, opts.lightBoost ?? 0.08);
    const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    if (lum < 0.15) c.offsetHSL(0, 0, 0.15);
    if (lum > 0.85) c.offsetHSL(0, -0.05, -0.08);
    return c.getHex();
  }
}
