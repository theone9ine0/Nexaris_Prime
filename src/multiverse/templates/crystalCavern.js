/** @type {import('./index.js').DimensionTemplate} */
export const crystalCavern = {
  id: 'crystalCavern',
  name: 'Crystal Cavern',
  palette: {
    sky: 0x0a0818,
    ground: 0x2a1a3a,
    accent: 0xaa66ff,
    fog: 0x1a1030,
  },
  lighting: {
    ambient: 0x442266,
    ambientIntensity: 0.45,
    directional: 0xcc88ff,
    directionalIntensity: 0.85,
    directionalPosition: [-3, 8, 2],
  },
  fog: { color: 0x1a1030, near: 8, far: 36 },
  terrain: 'cavern',
  propTypes: ['crystal', 'rock', 'ruins'],
  propDensity: 0.38,
  shardAnimation: 'glow',
  shardCount: [6, 12],
  npcCount: [0, 2],
  portalCount: [1, 2],
  effects: {
    bloom: { strength: 0.55, radius: 0.6, threshold: 0.15 },
    colorGrading: { saturation: 1.2, tint: 0x8844cc, tintStrength: 0.18, vignette: 0.28 },
  },
};
