import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';

/**
 * Minimal test dimension for PR26 verification.
 */
export class ExampleScene extends SceneBase {
  constructor() {
    super('example');
    this.cameraPosition.set(0, 0.2, 5);
    this.scene.background = new THREE.Color(0x050510);
  }

  _buildContent() {
    this.scene.add(new THREE.AmbientLight(0x223355, 0.6));

    this.shardManager.createShard({
      id: 'example_a',
      color: 0x88aaff,
      position: { x: -0.8, y: 0.3, z: 0.5 },
      animation: 'pulse',
    });

    this.shardManager.createShard({
      id: 'example_b',
      color: 0x66ccff,
      position: { x: 0.8, y: -0.2, z: 0.6 },
      animation: 'glow',
    });

    this.clusterManager.createCluster({
      id: 'example_cluster',
      layout: 'circle',
      layoutOptions: { radius: 0.8 },
      position: { x: 0, y: 0, z: -1.5 },
      animation: ['rotate'],
      shardSpecs: [
        { id: 'ex_c1', color: 0x5577cc, animation: 'pulse' },
        { id: 'ex_c2', color: 0x6688dd, animation: 'pulse' },
        { id: 'ex_c3', color: 0x7799ee, animation: 'pulse' },
      ],
    });
  }

  configureEffects(effects) {
    effects.applyPreset({
      bloom: { strength: 0.35, radius: 0.5, threshold: 0.22 },
      colorGrading: {
        saturation: 1.05,
        tint: 0x7a9ec8,
        tintStrength: 0.12,
        vignette: 0.2,
      },
    });
  }
}
