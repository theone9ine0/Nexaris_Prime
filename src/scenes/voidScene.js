import * as THREE from 'three';
import { ShardManager } from '../shards/ShardManager.js';

/**
 * @param {import('../scene/SceneManager.js').SceneContext} _ctx
 * @returns {import('../scene/SceneManager.js').SceneInstance}
 */
export function createVoidScene(_ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208);
  scene.userData.cameraPosition = new THREE.Vector3(0, 0.2, 5);

  const shardManager = new ShardManager(scene);

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array(
          Array.from({ length: 400 * 3 }, () => (Math.random() - 0.5) * 30),
        ),
        3,
      ),
    ),
    new THREE.PointsMaterial({ color: 0x99bbee, size: 0.04, transparent: true }),
  );
  scene.add(stars);
  scene.add(new THREE.AmbientLight(0x0a0a18, 0.5));

  shardManager.createShard({
    id: 'void_anchor',
    color: 0x6688cc,
    position: { x: 0, y: 0, z: 0.5 },
    animation: 'both',
  });

  return {
    scene,
    shardManager,
    configureEffects(effects) {
      effects.setSceneEffects({
        bloom: { strength: 0.6, radius: 0.65, threshold: 0.12 },
        colorGrading: { saturation: 0.95, tint: 0x334466, vignette: 0.4 },
      });
    },
    update(_delta, time) {
      stars.rotation.y = time * 0.03;
    },
    dispose() {
      shardManager.clear();
      stars.geometry.dispose();
      stars.material.dispose();
    },
  };
}
