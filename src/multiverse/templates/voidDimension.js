/** @type {import('./index.js').DimensionTemplate} */
export const voidDimension = {
  id: 'voidDimension',
  name: 'Void Dimension',
  palette: {
    sky: 0x020208,
    ground: 0x0a0a14,
    accent: 0x6688cc,
    fog: 0x020210,
  },
  lighting: {
    ambient: 0x0a0a18,
    ambientIntensity: 0.5,
    directional: 0x99bbee,
    directionalIntensity: 0.6,
    directionalPosition: [2, 6, 4],
  },
  fog: { color: 0x020210, near: 6, far: 32 },
  terrain: 'void',
  propTypes: ['artifact', 'ruins'],
  propDensity: 0.2,
  shardAnimation: 'both',
  shardCount: [2, 6],
  npcCount: [0, 1],
  portalCount: [1, 2],
  effects: {
    bloom: { strength: 0.6, radius: 0.65, threshold: 0.12 },
    colorGrading: { saturation: 0.9, tint: 0x334466, tintStrength: 0.2, vignette: 0.35 },
  },
};
