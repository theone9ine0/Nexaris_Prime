/** @type {import('./index.js').DimensionTemplate} */
export const floatingIslands = {
  id: 'floatingIslands',
  name: 'Floating Islands',
  palette: {
    sky: 0x87b8ff,
    ground: 0x4a7c59,
    accent: 0xffd966,
    fog: 0xa8c8e8,
  },
  lighting: {
    ambient: 0x8899bb,
    ambientIntensity: 0.55,
    directional: 0xfff0cc,
    directionalIntensity: 1.1,
    directionalPosition: [4, 12, 6],
  },
  fog: { color: 0xa8c8e8, near: 14, far: 48 },
  terrain: 'floating',
  propTypes: ['rock', 'tree', 'crystal'],
  propDensity: 0.32,
  shardAnimation: 'pulse',
  shardCount: [4, 8],
  npcCount: [1, 3],
  portalCount: [1, 3],
  effects: {
    bloom: { strength: 0.28, radius: 0.45, threshold: 0.25 },
    colorGrading: { saturation: 1.1, tint: 0x88aacc, tintStrength: 0.08, vignette: 0.15 },
  },
};
