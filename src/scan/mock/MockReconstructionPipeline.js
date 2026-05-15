import * as THREE from 'three';
import { createStylizedPlaceholderMesh } from './StylizedHumanoidTemplate.js';

/**
 * Mock async photogrammetry reconstruction (no ML).
 */
export class MockReconstructionPipeline {
  /**
   * @param {{ delayMs?: number }} [options]
   */
  constructor(options = {}) {
    this.delayMs = options.delayMs ?? 900;
  }

  /**
   * @param {import('../types.js').PhotoSet} photoSet
   * @returns {Promise<{ mesh: THREE.Group, bodyEstimate: import('../types.js').BodyEstimate }>}
   */
  async reconstructMesh(photoSet) {
    await this._delay(this.delayMs);
    const slotCount = Object.keys(photoSet).filter(Boolean).length;
    const stylization = THREE.MathUtils.clamp(0.55 + slotCount * 0.06, 0.6, 0.95);

    const mesh = createStylizedPlaceholderMesh({
      stylization,
      accent: 0x66ccff,
    });

    const bodyEstimate = {
      height: 1.65 + Math.random() * 0.12,
      shoulderWidth: 0.42 + Math.random() * 0.06,
      stylization,
    };

    return { mesh, bodyEstimate };
  }

  /**
   * @returns {Promise<void>}
   */
  async estimateBody() {
    await this._delay(this.delayMs * 0.4);
  }

  /**
   * @param {number} ms
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
