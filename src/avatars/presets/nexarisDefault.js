import { SAMPLE_DUCK_GLB } from '../../assets/modelUrls.js';

/**
 * Default Nexaris avatar customization preset (demo).
 * @type {import('../AvatarCustomizer.js').AvatarCustomizationConfig}
 */
export const NEXARIS_DEFAULT_PRESET = {
  version: 1,
  colors: {
    body: '#4a88cc',
    outfit: '#2a4466',
  },
  materials: {
    body: {
      emissive: '#2244aa',
      emissiveIntensity: 0.35,
      metalness: 0.65,
      roughness: 0.35,
    },
  },
  accessories: [
    {
      id: 'hat_duck',
      url: SAMPLE_DUCK_GLB,
      bone: 'Head',
      scale: 0.12,
      position: { x: 0, y: 0.35, z: 0.05 },
      rotation: { x: 0, y: 0.4, z: 0 },
    },
    {
      id: 'hand_tool',
      url: SAMPLE_DUCK_GLB,
      bone: 'LeftHand',
      scale: 0.08,
      position: { x: 0.05, y: 0.05, z: 0 },
      rotation: { x: 0, y: 0, z: 0.5 },
    },
  ],
};
